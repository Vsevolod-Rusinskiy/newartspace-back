#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: service-readiness.sh --container NAME --expected-image IMAGE \
  --local-url URL --site-url URL --attempts N --delay-seconds N \
  --request-timeout-seconds N
       or NAS_DEPLOY_SERVICE_CONTAINER, NAS_DEPLOY_EXPECTED_IMAGE,
       NAS_DEPLOY_LOCAL_URL, NAS_DEPLOY_SITE_URL, NAS_DEPLOY_SERVICE_ATTEMPTS,
       NAS_DEPLOY_SERVICE_DELAY_SECONDS, NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS
USAGE
}

fail() {
  printf 'service readiness failed: %s\n' "$1" >&2
  exit 1
}

normalize_decimal() {
  local value=$1
  while [[ ${#value} -gt 1 && ${value:0:1} == 0 ]]; do
    value=${value:1}
  done
  printf '%s' "$value"
}

decimal_lt() {
  local left right
  left=$(normalize_decimal "$1")
  right=$(normalize_decimal "$2")
  if (( ${#left} < ${#right} )); then return 0; fi
  if (( ${#left} > ${#right} )); then return 1; fi
  [[ "$left" < "$right" ]]
}

decimal_gt() {
  decimal_lt "$2" "$1"
}

require_value() {
  if [[ $# -lt 2 || -z "$2" ]]; then
    usage
    exit 2
  fi
}

container=${NAS_DEPLOY_SERVICE_CONTAINER-}
expected_image=${NAS_DEPLOY_EXPECTED_IMAGE-}
local_url=${NAS_DEPLOY_LOCAL_URL-}
site_url=${NAS_DEPLOY_SITE_URL-}
attempts=${NAS_DEPLOY_SERVICE_ATTEMPTS-}
delay_seconds=${NAS_DEPLOY_SERVICE_DELAY_SECONDS-}
request_timeout_seconds=${NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS-}

while (($#)); do
  case "$1" in
    --container)
      require_value "$@"
      container=$2
      shift 2
      ;;
    --expected-image)
      require_value "$@"
      expected_image=$2
      shift 2
      ;;
    --local-url)
      require_value "$@"
      local_url=$2
      shift 2
      ;;
    --site-url)
      require_value "$@"
      site_url=$2
      shift 2
      ;;
    --attempts)
      require_value "$@"
      attempts=$2
      shift 2
      ;;
    --delay-seconds)
      require_value "$@"
      delay_seconds=$2
      shift 2
      ;;
    --request-timeout-seconds)
      require_value "$@"
      request_timeout_seconds=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$container" || -z "$expected_image" || -z "$local_url" || -z "$site_url" ||
      -z "$attempts" || -z "$delay_seconds" || -z "$request_timeout_seconds" ]]; then
  usage
  exit 2
fi
if [[ ! "$container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ||
      ! "$expected_image" =~ ^[A-Za-z0-9][A-Za-z0-9._/:@-]*$ ]]; then
  usage
  exit 2
fi
if [[ ! "$local_url" =~ ^http://127\.0\.0\.1:([0-9]{1,5})(/[^[:space:]]*)?$ ]]; then
  usage
  exit 2
fi
local_port=${BASH_REMATCH[1]}
if decimal_lt "$local_port" 1 || decimal_gt "$local_port" 65535; then
  usage
  exit 2
fi
if [[ ! "$site_url" =~ ^https://newartspace\.ru(/[^[:space:]]*)?$ ]]; then
  usage
  exit 2
fi
if [[ ! "$attempts" =~ ^[0-9]+$ || ! "$delay_seconds" =~ ^[0-9]+$ ||
      ! "$request_timeout_seconds" =~ ^[0-9]+$ ]]; then
  usage
  exit 2
fi
if decimal_lt "$attempts" 2 || decimal_gt "$attempts" 20 ||
   decimal_gt "$delay_seconds" 60 || decimal_lt "$request_timeout_seconds" 1 ||
   decimal_gt "$request_timeout_seconds" 30; then
  usage
  exit 2
fi

attempts=$(normalize_decimal "$attempts")
delay_seconds=$(normalize_decimal "$delay_seconds")
request_timeout_seconds=$(normalize_decimal "$request_timeout_seconds")

candidate_restart=
last_error='no two consecutive healthy samples'

for ((attempt=1; attempt<=attempts; attempt++)); do
  inspect_output=
  if ! inspect_output=$(docker inspect \
    --format '{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}' \
    "$container" 2>/dev/null); then
    candidate_restart=
    last_error='container inspect failed'
  elif [[ "$inspect_output" == *$'\n'* ]]; then
    candidate_restart=
    last_error='invalid container state measurement'
  else
    running=
    restart_count=
    current_image=
    extra=
    IFS='|' read -r running restart_count current_image extra <<<"$inspect_output" || true

    if [[ -n "$extra" || "$running" != true && "$running" != false ||
          ! "$restart_count" =~ ^[0-9]+$ || -z "$current_image" ]]; then
      candidate_restart=
      last_error='invalid container state measurement'
    elif [[ "$running" != true ]]; then
      candidate_restart=
      last_error='container is not running'
    elif [[ "$current_image" != "$expected_image" ]]; then
      candidate_restart=
      last_error="image mismatch: expected $expected_image, got $current_image"
    elif ! local_http_code=$(curl --fail --silent --show-error \
      --connect-timeout "$request_timeout_seconds" \
      --max-time "$request_timeout_seconds" --output /dev/null \
      --write-out '%{http_code}' --url "$local_url"); then
      candidate_restart=
      last_error='local service request failed'
    elif [[ ! "$local_http_code" =~ ^2[0-9][0-9]$ ]]; then
      candidate_restart=
      last_error="local service returned HTTP $local_http_code"
    elif ! site_http_code=$(curl --fail --silent --show-error \
      --connect-timeout "$request_timeout_seconds" \
      --max-time "$request_timeout_seconds" --output /dev/null \
      --write-out '%{http_code}' --url "$site_url"); then
      candidate_restart=
      last_error='public site request failed'
    elif [[ ! "$site_http_code" =~ ^2[0-9][0-9]$ ]]; then
      candidate_restart=
      last_error="public site returned HTTP $site_http_code"
    elif [[ -n "$candidate_restart" && "$candidate_restart" == "$restart_count" ]]; then
      printf 'service readiness passed: container=%s image=%s restart=%s attempts=%s\n' \
        "$container" "$expected_image" "$restart_count" "$attempt"
      exit 0
    else
      candidate_restart=$restart_count
      last_error='waiting for a second stable healthy sample'
    fi
  fi

  if (( attempt < attempts )); then
    sleep "$delay_seconds"
  fi
done

fail "after $attempts attempt(s): $last_error"
