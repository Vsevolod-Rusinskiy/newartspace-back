#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PREFLIGHT="$SCRIPT_DIR/preflight.sh"
MOCK_BIN=$(mktemp -d)
trap 'rm -rf "$MOCK_BIN"' EXIT

cat >"$MOCK_BIN/df" <<'MOCK_DF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${DF_MODE:-}" == error ]]; then
  exit 1
fi

if [[ "${DF_MODE:-}" == error-inodes && "$*" == *-Pi* ]]; then
  exit 1
fi

if [[ "${DF_MODE:-}" == empty-bytes ]]; then
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' '/dev/mock 1000 500  50% /'
  exit 0
fi

if [[ "${DF_MODE:-}" == malformed-bytes ]]; then
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' '/dev/mock 1000 500 NaN 50% /'
  exit 0
fi

if [[ "${DF_MODE:-}" == empty-percent ]]; then
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' '/dev/mock 1000 500 100 '
  exit 0
fi

if [[ "${DF_MODE:-}" == malformed-percent ]]; then
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' '/dev/mock 1000 500 100 nope /'
  exit 0
fi

if [[ "${DF_MODE:-}" == oversized-percent ]]; then
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' '/dev/mock 1000 900 100 9223372036854775808% /'
  exit 0
fi

if [[ "${DF_MODE:-}" == empty-inodes ]]; then
  printf '%s\n' 'Filesystem Inodes IUsed IFree IUse% Mounted on' '/dev/mock 1000 500  50% /'
  exit 0
fi

if [[ "${DF_MODE:-}" == malformed-inodes ]]; then
  printf '%s\n' 'Filesystem Inodes IUsed IFree IUse% Mounted on' '/dev/mock 1000 500 nope 50% /'
  exit 0
fi

if [[ "$*" == *-Pi* ]]; then
  case "${DF_MODE:-}" in
    inodes-below) free_inodes=99 ;;
    oversized-equal) free_inodes=9223372036854775808 ;;
    oversized-above) free_inodes=18446744073709551615 ;;
    *) free_inodes=100 ;;
  esac
  printf '%s\n' 'Filesystem Inodes IUsed IFree IUse% Mounted on' "/dev/mock 1000 900 $free_inodes 10% /"
else
  case "${DF_MODE:-}" in
    bytes-below) free_bytes=99 ;;
    oversized-equal) free_bytes=9223372036854775808 ;;
    oversized-above) free_bytes=18446744073709551615 ;;
    *) free_bytes=100 ;;
  esac
  case "${DF_MODE:-}" in
    percent-below) used_percent=91 ;;
    *) used_percent=90 ;;
  esac
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' "/dev/mock 1000 900 $free_bytes ${used_percent}% /"
fi
MOCK_DF
chmod +x "$MOCK_BIN/df"

run_case() {
  local mode=$1 expected_status=$2 expected_text=$3
  local threshold_bytes=${4:-100} threshold_percent=${5:-10} threshold_inodes=${6:-100}
  local output status
  set +e
  output=$(env -u NAS_DEPLOY_MOUNTPOINT -u NAS_DEPLOY_MIN_FREE_BYTES \
    -u NAS_DEPLOY_MIN_FREE_PERCENT -u NAS_DEPLOY_MIN_FREE_INODES \
    DF_MODE="$mode" PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" \
    --mountpoint / --min-free-bytes "$threshold_bytes" \
    --min-free-percent "$threshold_percent" --min-free-inodes "$threshold_inodes" 2>&1)
  status=$?
  set -e
  if [[ "$status" -ne "$expected_status" ]]; then
    printf 'FAIL %s: expected status %s, got %s\n%s\n' "$mode" "$expected_status" "$status" "$output" >&2
    exit 1
  fi
  if [[ -n "$expected_text" && "$output" != *"$expected_text"* ]]; then
    printf 'FAIL %s: expected output containing %q\n%s\n' "$mode" "$expected_text" "$output" >&2
    exit 1
  fi
}

run_case pass 0 ''
run_case bytes-below 1 'free bytes'
run_case percent-below 1 'free percent'
run_case inodes-below 1 'free inodes'
run_case malformed-bytes 1 'measurement'
run_case empty-bytes 1 'measurement'
run_case malformed-percent 1 'measurement'
run_case empty-percent 1 'measurement'
run_case oversized-percent 1 'measurement'
run_case malformed-inodes 1 'measurement'
run_case empty-inodes 1 'measurement'
run_case error 1 'df failed'
run_case error-inodes 1 'df failed'
run_case oversized-equal 0 '' 9223372036854775808 10 9223372036854775808
run_case oversized-above 0 '' 9223372036854775808 10 9223372036854775808
run_case huge-bytes-threshold 1 'free bytes' 9223372036854775808 10 100
run_case huge-inodes-threshold 1 'free inodes' 100 10 9223372036854775808
run_case huge-percent-threshold 2 '' 100 9223372036854775808 100

set +e
env -u NAS_DEPLOY_MOUNTPOINT -u NAS_DEPLOY_MIN_FREE_BYTES \
  -u NAS_DEPLOY_MIN_FREE_PERCENT -u NAS_DEPLOY_MIN_FREE_INODES \
  NAS_DEPLOY_MOUNTPOINT=/ NAS_DEPLOY_MIN_FREE_BYTES=100 \
  NAS_DEPLOY_MIN_FREE_PERCENT=10 NAS_DEPLOY_MIN_FREE_INODES=100 \
  DF_MODE=pass PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  printf '%s\n' 'FAIL env-only configuration was rejected' >&2
  exit 1
fi

set +e
env -u NAS_DEPLOY_MOUNTPOINT -u NAS_DEPLOY_MIN_FREE_BYTES \
  -u NAS_DEPLOY_MIN_FREE_PERCENT -u NAS_DEPLOY_MIN_FREE_INODES \
  NAS_DEPLOY_MOUNTPOINT=/ NAS_DEPLOY_MIN_FREE_BYTES=9223372036854775808 \
  NAS_DEPLOY_MIN_FREE_PERCENT=9223372036854775808 \
  NAS_DEPLOY_MIN_FREE_INODES=9223372036854775808 \
  DF_MODE=pass PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" \
  --mountpoint / --min-free-bytes 100 --min-free-percent 10 --min-free-inodes 100 >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -ne 0 ]]; then
  printf '%s\n' 'FAIL CLI did not override environment configuration' >&2
  exit 1
fi

set +e
env -u NAS_DEPLOY_MOUNTPOINT -u NAS_DEPLOY_MIN_FREE_BYTES \
  -u NAS_DEPLOY_MIN_FREE_PERCENT -u NAS_DEPLOY_MIN_FREE_INODES \
  PATH="$MOCK_BIN:$PATH" "$PREFLIGHT" >/dev/null 2>&1
status=$?
set -e
if [[ "$status" -eq 0 ]]; then
  printf '%s\n' 'FAIL missing threshold was accepted' >&2
  exit 1
fi

printf '%s\n' 'preflight tests passed'
