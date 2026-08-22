#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PREFLIGHT="$SCRIPT_DIR/database-preflight.sh"
MOCK_BIN=$(mktemp -d)
trap 'rm -rf "$MOCK_BIN"' EXIT

cat >"$MOCK_BIN/docker" <<'MOCK_DOCKER'
#!/usr/bin/env bash
set -euo pipefail

state_file=${DOCKER_STATE_FILE:?}
record() { printf '%s\n' "$1" >>"$state_file"; }
count() { awk -v item="$1" '$0 == item { count++ } END { print count + 0 }' "$state_file"; }
record "argv:$*"

if [[ "$1" == exec && "$*" == *"sh -euc"* ]]; then
  record db-check
  case "${DOCKER_MODE:-}" in
    recovery) [[ "$(count db-check)" -eq 1 ]] && exit 11 ;;
    exhaustion) exit 11 ;;
    missing-credentials) exit 14 ;;
    query-failure) exit 12 ;;
    bad-result) exit 13 ;;
  esac
  exit 0
fi

if [[ "$1" == inspect ]]; then
  if [[ "$*" == *State.Running* ]]; then
    record inspect-running
    case "${DOCKER_MODE:-}" in
      missing) exit 1 ;;
      stopped) printf 'false\n' ;;
      *) printf 'true\n' ;;
    esac
    exit 0
  fi
  record inspect-env
  case "${DOCKER_MODE:-}" in
    missing|stopped) exit 1 ;;
    missing-credentials) printf 'POSTGRES_USER=nas\nPOSTGRES_DB=art\n' ;;
    *) printf 'POSTGRES_USER=nas\nPOSTGRES_DB=art\nPOSTGRES_PASSWORD=secret\n' ;;
  esac
  exit 0
fi

if [[ "$1" == exec && "$*" == *pg_isready* ]]; then
  record pg_isready
  case "${DOCKER_MODE:-}" in
    recovery) [[ "$(count pg_isready)" -eq 1 ]] && exit 1 ;;
    exhaustion) exit 1 ;;
  esac
  exit 0
fi

if [[ "$1" == exec && "$*" == *psql* ]]; then
  record psql
  if [[ "${DOCKER_MODE:-}" == query-failure ]]; then
    exit 1
  fi
  if [[ "${DOCKER_MODE:-}" == bad-result ]]; then
    printf '0\n'
  else
    printf '1\n'
  fi
  exit 0
fi

printf 'unexpected docker invocation: %s\n' "$*" >&2
exit 1
MOCK_DOCKER

cat >"$MOCK_BIN/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' sleep >>"${DOCKER_STATE_FILE:?}"
MOCK_SLEEP
chmod +x "$MOCK_BIN/docker" "$MOCK_BIN/sleep"

run_case() {
  local mode=$1 expected_status=$2 expected_text=$3 attempts=$4 delay=$5 expected_sleeps=$6
  local state_file output status sleeps
  state_file=$(mktemp)
  set +e
  output=$(env -u NAS_DEPLOY_DB_CONTAINER -u NAS_DEPLOY_DB_ATTEMPTS \
    -u NAS_DEPLOY_DB_DELAY_SECONDS DOCKER_MODE="$mode" DOCKER_STATE_FILE="$state_file" \
    PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" --container database --attempts "$attempts" \
    --delay-seconds "$delay" 2>&1)
  status=$?
  set -e
  sleeps=$(awk '$0 == "sleep" { count++ } END { print count + 0 }' "$state_file")
  if [[ "$status" -ne "$expected_status" || "$sleeps" -ne "$expected_sleeps" ]]; then
    printf 'FAIL %s: status=%s sleeps=%s output=%s\n' "$mode" "$status" "$sleeps" "$output" >&2
    exit 1
  fi
  if [[ -n "$expected_text" && "$output" != *"$expected_text"* ]]; then
    printf 'FAIL %s: expected output containing %q\n' "$mode" "$expected_text" >&2
    exit 1
  fi
  if [[ "$mode" == success ]]; then
    if grep -q 'inspect-env\|secret' "$state_file" || [[ "$output" == *secret* ]]; then
      printf '%s\n' 'FAIL password leaked through docker inspect/argv/output' >&2
      exit 1
    fi
    if ! grep -q 'sh -euc' "$state_file" || ! grep -q '127.0.0.1' "$state_file"; then
      printf '%s\n' 'FAIL database check did not use fixed local sh flow' >&2
      exit 1
    fi
  fi
  rm -f "$state_file"
}

run_case success 0 '' 2 1 0
run_case recovery 0 '' 3 0 1
run_case stopped 1 'running' 2 0 1
run_case missing 1 'inspect' 2 0 1
run_case missing-credentials 1 'credentials' 1 0 0
run_case query-failure 1 'SELECT 1' 2 0 1
run_case bad-result 1 'SELECT 1' 1 0 0
run_case exhaustion 1 'pg_isready' 3 0 2

run_invalid() {
  local name expected_text=$1
  shift
  local output status state_file
  state_file=$(mktemp)
  set +e
  output=$(env -u NAS_DEPLOY_DB_CONTAINER -u NAS_DEPLOY_DB_ATTEMPTS \
    -u NAS_DEPLOY_DB_DELAY_SECONDS DOCKER_STATE_FILE="$state_file" PATH="$MOCK_BIN:$PATH" \
    "$PREFLIGHT" "$@" 2>&1)
  status=$?
  set -e
  if [[ "$status" -ne 2 || "$output" != *"$expected_text"* ]]; then
    printf 'FAIL invalid config: status=%s output=%s\n' "$status" "$output" >&2
    exit 1
  fi
  if [[ -s "$state_file" ]]; then
    printf '%s\n' 'FAIL invalid config invoked docker' >&2
    exit 1
  fi
  rm -f "$state_file"
}

run_invalid 'Usage:'
run_invalid 'Usage:' --container database --attempts 0 --delay-seconds 0
run_invalid 'Usage:' --container database --attempts 9223372036854775808 --delay-seconds 0
run_invalid 'Usage:' --container database --attempts 1 --delay-seconds -1

state_file=$(mktemp)
set +e
env -u NAS_DEPLOY_DB_CONTAINER -u NAS_DEPLOY_DB_ATTEMPTS -u NAS_DEPLOY_DB_DELAY_SECONDS \
  NAS_DEPLOY_DB_CONTAINER=database NAS_DEPLOY_DB_ATTEMPTS=1 NAS_DEPLOY_DB_DELAY_SECONDS=0 \
  DOCKER_MODE=success DOCKER_STATE_FILE="$state_file" PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  printf '%s\n' 'FAIL env-only configuration was rejected' >&2
  exit 1
fi
rm -f "$state_file"

state_file=$(mktemp)
set +e
env -u NAS_DEPLOY_DB_CONTAINER -u NAS_DEPLOY_DB_ATTEMPTS -u NAS_DEPLOY_DB_DELAY_SECONDS \
  NAS_DEPLOY_DB_CONTAINER=database NAS_DEPLOY_DB_ATTEMPTS=0 NAS_DEPLOY_DB_DELAY_SECONDS=-1 \
  DOCKER_MODE=success DOCKER_STATE_FILE="$state_file" PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" \
  --container database --attempts 1 --delay-seconds 0 >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  printf '%s\n' 'FAIL CLI did not override environment configuration' >&2
  exit 1
fi
rm -f "$state_file"

printf '%s\n' 'database preflight tests passed'
