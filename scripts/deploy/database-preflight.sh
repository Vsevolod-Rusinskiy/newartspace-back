#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

usage() {
  cat >&2 <<'USAGE'
Usage: database-preflight.sh --container NAME --attempts N --delay-seconds N
       or NAS_DEPLOY_DB_CONTAINER, NAS_DEPLOY_DB_ATTEMPTS, NAS_DEPLOY_DB_DELAY_SECONDS
USAGE
}

fail() {
  printf 'database preflight failed: %s\n' "$1" >&2
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

container=${NAS_DEPLOY_DB_CONTAINER-}
attempts=${NAS_DEPLOY_DB_ATTEMPTS-}
delay_seconds=${NAS_DEPLOY_DB_DELAY_SECONDS-}

while (($#)); do
  case "$1" in
    --container)
      require_value "$@"
      container=$2
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

if [[ -z "$container" || -z "$attempts" || -z "$delay_seconds" ]]; then
  usage
  exit 2
fi
if [[ ! "$attempts" =~ ^[0-9]+$ || ! "$delay_seconds" =~ ^[0-9]+$ ]]; then
  usage
  exit 2
fi
if decimal_lt "$attempts" 1 || decimal_gt "$attempts" 10; then
  usage
  exit 2
fi
if decimal_gt "$delay_seconds" 60; then
  usage
  exit 2
fi

db_check_script='if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  exit 14
fi
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 || exit 11
query_result=$(psql -X -qAt -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1") || exit 12
query_result=$(printf "%s" "$query_result" | tr -d "[:space:]")
[ "$query_result" = 1 ] || exit 13'

last_error='no successful database readiness check'
for ((attempt=1; attempt<=attempts; attempt++)); do
  running=''
  if ! running=$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null); then
    last_error='container inspect failed'
  elif [[ "$running" != true ]]; then
    last_error='database container is not running'
  else
    check_status=0
    if docker exec "$container" sh -euc "$db_check_script" >/dev/null 2>&1; then
      printf 'database preflight passed: container=%s attempts=%s\n' "$container" "$attempt"
      exit 0
    else
      check_status=$?
      case "$check_status" in
        11) last_error='pg_isready failed' ;;
        12) last_error='SELECT 1 query failed' ;;
        13) last_error='SELECT 1 returned an unexpected result' ;;
        14) fail 'container credentials are missing or empty' ;;
        *) last_error='container database check failed' ;;
      esac
    fi
  fi

  if (( attempt < attempts )); then
    sleep "$delay_seconds"
  fi
done

fail "after $attempts attempt(s): $last_error"
