#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
READINESS="$SCRIPT_DIR/service-readiness.sh"
MOCK_BIN=$(mktemp -d)
trap 'rm -rf "$MOCK_BIN"' EXIT

cat >"$MOCK_BIN/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

state_file=${READINESS_STATE_FILE:?}
record() { printf '%s\n' "$1" >>"$state_file"; }
count() { awk -v item="$1" '$0 == item { count++ } END { print count + 0 }' "$state_file"; }

if [[ "$1" != inspect || "$*" != *State.Running* || "$*" != *RestartCount* || "$*" != *Config.Image* ]]; then
  printf 'unexpected docker invocation: %s\n' "$*" >&2
  exit 97
fi

record inspect
inspect_count=$(count inspect)
case "${READINESS_MODE:-success}" in
  missing)
    exit 1
    ;;
  stopped)
    printf 'false|0|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    ;;
  recovery)
    if [[ "$inspect_count" -eq 1 ]]; then
      printf 'false|0|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    else
      printf 'true|0|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    fi
    ;;
  wrong-image)
    printf 'true|0|ghcr.io/example/wrong:sha-deadbeef\n'
    ;;
  restart-change)
    if [[ "$inspect_count" -eq 1 ]]; then
      printf 'true|0|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    else
      printf 'true|1|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    fi
    ;;
  malformed-running)
    printf 'unknown|0|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    ;;
  malformed-restart)
    printf 'true|NaN|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    ;;
  malformed-row)
    printf 'true|0\n'
    ;;
  *)
    printf 'true|0|%s\n' "${SERVICE_EXPECTED_IMAGE:?}"
    ;;
esac
MOCK_DOCKER

cat >"$MOCK_BIN/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -euo pipefail

state_file=${READINESS_STATE_FILE:?}
record() { printf '%s\n' "$1" >>"$state_file"; }
count() { awk -v item="$1" '$0 == item { count++ } END { print count + 0 }' "$state_file"; }

joined=" $* "
if [[ "$joined" == *" -L "* || "$joined" == *" --location "* ||
      "$joined" == *" -X "* || "$joined" == *" --request "* ||
      "$joined" == *" --data "* || "$joined" == *" --data-raw "* ]]; then
  printf 'unsafe curl invocation: %s\n' "$*" >&2
  exit 97
fi
for required in --fail --silent --show-error --connect-timeout --max-time --output --write-out --url; do
  if [[ "$joined" != *" $required "* ]]; then
    printf 'missing curl option %s: %s\n' "$required" "$*" >&2
    exit 97
  fi
done
if [[ "$joined" != *" --connect-timeout ${SERVICE_TIMEOUT:?} "* ||
      "$joined" != *" --max-time ${SERVICE_TIMEOUT:?} "* ||
      "$joined" != *" --output /dev/null "* ||
      "$joined" != *" --write-out %{http_code} "* ]]; then
  printf 'incorrect curl bounds/output: %s\n' "$*" >&2
  exit 97
fi

url=
while (($#)); do
  if [[ "$1" == --url && $# -ge 2 ]]; then
    url=$2
    break
  fi
  shift
done

case "$url" in
  http://127.0.0.1:*)
    record curl-local
    if [[ "${READINESS_MODE:-}" == local-failure ]]; then exit 22; fi
    if [[ "${READINESS_MODE:-}" == http-recovery && "$(count curl-local)" -eq 1 ]]; then exit 22; fi
    if [[ "${READINESS_MODE:-}" == local-redirect ]]; then printf '302'; else printf '200'; fi
    ;;
  https://newartspace.ru/*)
    record curl-site
    if [[ "${READINESS_MODE:-}" == site-failure ]]; then exit 22; fi
    if [[ "${READINESS_MODE:-}" == site-redirect ]]; then printf '302'; else printf '200'; fi
    ;;
  *)
    printf 'unexpected readiness URL: %s\n' "$url" >&2
    exit 97
    ;;
esac
MOCK_CURL

cat >"$MOCK_BIN/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
set -euo pipefail
printf 'sleep:%s\n' "$1" >>"${READINESS_STATE_FILE:?}"
MOCK_SLEEP

chmod +x "$MOCK_BIN/docker" "$MOCK_BIN/curl" "$MOCK_BIN/sleep"

run_case() {
  local mode=$1 expected_status=$2 expected_text=$3 attempts=$4 delay=$5
  local expected_inspects=$6 expected_sleeps=$7
  local state_file output status inspections sleeps
  state_file=$(mktemp)
  set +e
  output=$(env -u NAS_DEPLOY_SERVICE_CONTAINER -u NAS_DEPLOY_EXPECTED_IMAGE \
    -u NAS_DEPLOY_LOCAL_URL -u NAS_DEPLOY_SITE_URL -u NAS_DEPLOY_SERVICE_ATTEMPTS \
    -u NAS_DEPLOY_SERVICE_DELAY_SECONDS -u NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS \
    READINESS_MODE="$mode" READINESS_STATE_FILE="$state_file" \
    SERVICE_EXPECTED_IMAGE='ghcr.io/example/service:sha-abc123' SERVICE_TIMEOUT=10 \
    PATH="$MOCK_BIN:$PATH" "$READINESS" \
    --container service --expected-image 'ghcr.io/example/service:sha-abc123' \
    --local-url 'http://127.0.0.1:3000/version' --site-url 'https://newartspace.ru/' \
    --attempts "$attempts" --delay-seconds "$delay" --request-timeout-seconds 10 2>&1)
  status=$?
  set -e
  inspections=$(awk '$0 == "inspect" { count++ } END { print count + 0 }' "$state_file")
  sleeps=$(awk 'index($0, "sleep:") == 1 { count++ } END { print count + 0 }' "$state_file")
  if [[ "$status" -ne "$expected_status" || "$inspections" -ne "$expected_inspects" || "$sleeps" -ne "$expected_sleeps" ]]; then
    printf 'FAIL %s: status=%s inspections=%s sleeps=%s output=%s\n' \
      "$mode" "$status" "$inspections" "$sleeps" "$output" >&2
    exit 1
  fi
  if [[ -n "$expected_text" && "$output" != *"$expected_text"* ]]; then
    printf 'FAIL %s: expected output containing %q, got %s\n' "$mode" "$expected_text" "$output" >&2
    exit 1
  fi
  rm -f "$state_file"
}

run_case success 0 'service readiness passed' 2 0 2 1
run_case recovery 0 'service readiness passed' 3 0 3 2
run_case restart-change 0 'service readiness passed' 3 0 3 2
run_case http-recovery 0 'service readiness passed' 3 0 3 2
run_case missing 1 'inspect failed' 2 0 2 1
run_case stopped 1 'not running' 2 0 2 1
run_case wrong-image 1 'image mismatch' 2 0 2 1
run_case local-failure 1 'local service request failed' 2 0 2 1
run_case site-failure 1 'public site request failed' 2 0 2 1
run_case local-redirect 1 'local service returned HTTP 302' 2 0 2 1
run_case site-redirect 1 'public site returned HTTP 302' 2 0 2 1
run_case malformed-running 1 'invalid container state' 2 0 2 1
run_case malformed-restart 1 'invalid container state' 2 0 2 1
run_case malformed-row 1 'invalid container state' 2 0 2 1

run_invalid() {
  local expected_status=$1
  shift
  local state_file output status
  state_file=$(mktemp)
  set +e
  output=$(env -u NAS_DEPLOY_SERVICE_CONTAINER -u NAS_DEPLOY_EXPECTED_IMAGE \
    -u NAS_DEPLOY_LOCAL_URL -u NAS_DEPLOY_SITE_URL -u NAS_DEPLOY_SERVICE_ATTEMPTS \
    -u NAS_DEPLOY_SERVICE_DELAY_SECONDS -u NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS \
    READINESS_STATE_FILE="$state_file" SERVICE_EXPECTED_IMAGE='ghcr.io/example/service:sha-abc123' \
    SERVICE_TIMEOUT=10 PATH="$MOCK_BIN:$PATH" "$READINESS" "$@" 2>&1)
  status=$?
  set -e
  if [[ "$status" -ne "$expected_status" || "$output" != *'Usage:'* || -s "$state_file" ]]; then
    printf 'FAIL invalid config: status=%s output=%s\n' "$status" "$output" >&2
    exit 1
  fi
  rm -f "$state_file"
}

run_invalid 2
run_invalid 2 --container service --expected-image image --local-url 'https://example.com/' \
  --site-url 'https://newartspace.ru/' --attempts 2 --delay-seconds 0 --request-timeout-seconds 10
run_invalid 2 --container service --expected-image image --local-url 'http://127.0.0.1:3000/' \
  --site-url 'http://newartspace.ru/' --attempts 2 --delay-seconds 0 --request-timeout-seconds 10
run_invalid 2 --container service --expected-image image --local-url 'http://127.0.0.1:3000/' \
  --site-url 'https://newartspace.ru/' --attempts 1 --delay-seconds 0 --request-timeout-seconds 10
run_invalid 2 --container service --expected-image image --local-url 'http://127.0.0.1:3000/' \
  --site-url 'https://newartspace.ru/' --attempts 21 --delay-seconds 0 --request-timeout-seconds 10
run_invalid 2 --container service --expected-image image --local-url 'http://127.0.0.1:3000/' \
  --site-url 'https://newartspace.ru/' --attempts 2 --delay-seconds 61 --request-timeout-seconds 10
run_invalid 2 --container service --expected-image image --local-url 'http://127.0.0.1:3000/' \
  --site-url 'https://newartspace.ru/' --attempts 2 --delay-seconds 0 --request-timeout-seconds 31
run_invalid 2 --container service --expected-image image --local-url 'http://127.0.0.1:3000/' \
  --site-url 'https://newartspace.ru/' --attempts 9223372036854775808 --delay-seconds 0 \
  --request-timeout-seconds 10

state_file=$(mktemp)
set +e
env -u NAS_DEPLOY_SERVICE_CONTAINER -u NAS_DEPLOY_EXPECTED_IMAGE \
  -u NAS_DEPLOY_LOCAL_URL -u NAS_DEPLOY_SITE_URL -u NAS_DEPLOY_SERVICE_ATTEMPTS \
  -u NAS_DEPLOY_SERVICE_DELAY_SECONDS -u NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS \
  NAS_DEPLOY_SERVICE_CONTAINER=service \
  NAS_DEPLOY_EXPECTED_IMAGE='ghcr.io/example/service:sha-abc123' \
  NAS_DEPLOY_LOCAL_URL='http://127.0.0.1:3000/version' \
  NAS_DEPLOY_SITE_URL='https://newartspace.ru/' NAS_DEPLOY_SERVICE_ATTEMPTS=2 \
  NAS_DEPLOY_SERVICE_DELAY_SECONDS=0 NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS=10 \
  READINESS_MODE=success READINESS_STATE_FILE="$state_file" \
  SERVICE_EXPECTED_IMAGE='ghcr.io/example/service:sha-abc123' SERVICE_TIMEOUT=10 \
  PATH="$MOCK_BIN:$PATH" "$READINESS" >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  printf '%s\n' 'FAIL env-only configuration was rejected' >&2
  exit 1
fi
rm -f "$state_file"

state_file=$(mktemp)
set +e
env -u NAS_DEPLOY_SERVICE_CONTAINER -u NAS_DEPLOY_EXPECTED_IMAGE \
  -u NAS_DEPLOY_LOCAL_URL -u NAS_DEPLOY_SITE_URL -u NAS_DEPLOY_SERVICE_ATTEMPTS \
  -u NAS_DEPLOY_SERVICE_DELAY_SECONDS -u NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS \
  NAS_DEPLOY_SERVICE_CONTAINER=wrong NAS_DEPLOY_EXPECTED_IMAGE=wrong \
  NAS_DEPLOY_LOCAL_URL='https://example.com/' NAS_DEPLOY_SITE_URL='http://example.com/' \
  NAS_DEPLOY_SERVICE_ATTEMPTS=1 NAS_DEPLOY_SERVICE_DELAY_SECONDS=99 \
  NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS=99 READINESS_MODE=success \
  READINESS_STATE_FILE="$state_file" SERVICE_EXPECTED_IMAGE='ghcr.io/example/service:sha-abc123' \
  SERVICE_TIMEOUT=10 PATH="$MOCK_BIN:$PATH" "$READINESS" \
  --container service --expected-image 'ghcr.io/example/service:sha-abc123' \
  --local-url 'http://127.0.0.1:3000/version' --site-url 'https://newartspace.ru/' \
  --attempts 2 --delay-seconds 0 --request-timeout-seconds 10 >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  printf '%s\n' 'FAIL CLI did not override environment configuration' >&2
  exit 1
fi
rm -f "$state_file"

printf '%s\n' 'service readiness tests passed'
