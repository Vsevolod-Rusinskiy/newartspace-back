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

extract_env() {
  local key=$1 env_dump=$2
  printf '%s\n' "$env_dump" | awk -v key="$key" '
    index($0, key "=") == 1 {
      sub("^[^=]*=", "")
      print
      exit
    }
  '
}

last_error='no successful database readiness check'
for ((attempt=1; attempt<=attempts; attempt++)); do
  running=''
  if ! running=$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null); then
    last_error='container inspect failed'
  elif [[ "$running" != true ]]; then
    last_error='database container is not running'
  else
    env_dump=''
    if ! env_dump=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$container" 2>/dev/null); then
      last_error='container credentials inspect failed'
    else
      db_user=$(extract_env POSTGRES_USER "$env_dump")
      db_name=$(extract_env POSTGRES_DB "$env_dump")
      db_password=$(extract_env POSTGRES_PASSWORD "$env_dump")
      if [[ -z "$db_user" || -z "$db_name" || -z "$db_password" ]]; then
        fail 'container credentials are missing or empty'
      fi

      if ! docker exec -e "PGPASSWORD=$db_password" "$container" pg_isready \
        -U "$db_user" -d "$db_name" >/dev/null 2>&1; then
        last_error='pg_isready failed'
      else
        query_result=''
        if ! query_result=$(docker exec -e "PGPASSWORD=$db_password" "$container" \
          psql -X -qAt -U "$db_user" -d "$db_name" -c 'SELECT 1' 2>/dev/null); then
          last_error='SELECT 1 query failed'
        else
          query_result=$(printf '%s' "$query_result" | tr -d '[:space:]')
          if [[ "$query_result" == 1 ]]; then
            printf 'database preflight passed: container=%s attempts=%s\n' "$container" "$attempt"
            exit 0
          fi
          last_error='SELECT 1 returned an unexpected result'
        fi
      fi
    fi
  fi

  if (( attempt < attempts )); then
    sleep "$delay_seconds"
  fi
done

fail "after $attempts attempt(s): $last_error"
