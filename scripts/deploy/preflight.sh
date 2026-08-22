#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

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
  if (( ${#left} < ${#right} )); then
    return 0
  fi
  if (( ${#left} > ${#right} )); then
    return 1
  fi
  if [[ "$left" < "$right" ]]; then
    return 0
  fi
  return 1
}

decimal_gt() {
  decimal_lt "$2" "$1"
}

usage() {
  cat >&2 <<'USAGE'
Usage: preflight.sh --mountpoint PATH --min-free-bytes N --min-free-percent N --min-free-inodes N
USAGE
}

fail() {
  printf 'disk/inode preflight failed: %s\n' "$1" >&2
  exit 1
}

require_value() {
  if [[ $# -lt 2 || -z "$2" ]]; then
    usage
    exit 2
  fi
}

mountpoint=
min_free_bytes=
min_free_percent=
min_free_inodes=

while (($#)); do
  case "$1" in
    --mountpoint)
      require_value "$@"
      mountpoint=$2
      shift 2
      ;;
    --min-free-bytes)
      require_value "$@"
      min_free_bytes=$2
      shift 2
      ;;
    --min-free-percent)
      require_value "$@"
      min_free_percent=$2
      shift 2
      ;;
    --min-free-inodes)
      require_value "$@"
      min_free_inodes=$2
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

if [[ -z "$mountpoint" || -z "$min_free_bytes" || -z "$min_free_percent" || -z "$min_free_inodes" ]]; then
  usage
  exit 2
fi

for threshold in "$min_free_bytes" "$min_free_percent" "$min_free_inodes"; do
  if [[ ! "$threshold" =~ ^[0-9]+$ ]]; then
    usage
    exit 2
  fi
done

if decimal_gt "$min_free_percent" 100; then
  usage
  exit 2
fi

bytes_df=''
if ! bytes_df=$(LC_ALL=C df -B1 -P -- "$mountpoint" 2>&1); then
  fail "df failed while measuring free bytes/free percent: $bytes_df"
fi

bytes_row=$(printf '%s\n' "$bytes_df" | awk 'NR == 2 { print; exit }')
read -r _ _ _ free_bytes used_percent _ <<< "$bytes_row" || true
if [[ -z "$bytes_row" || ! "$free_bytes" =~ ^[0-9]+$ || ! "$used_percent" =~ ^[0-9]+%$ ]]; then
  fail 'invalid or empty free bytes/free percent measurement'
fi

used_percent=${used_percent%%%}
if decimal_gt "$used_percent" 100; then
  fail 'invalid free percent measurement'
fi
free_percent=$((100 - used_percent))

if decimal_lt "$free_bytes" "$min_free_bytes"; then
  fail "free bytes $free_bytes below threshold $min_free_bytes"
fi
if decimal_lt "$free_percent" "$min_free_percent"; then
  fail "free percent $free_percent below threshold $min_free_percent"
fi

inodes_df=''
if ! inodes_df=$(LC_ALL=C df -Pi -P -- "$mountpoint" 2>&1); then
  fail "df failed while measuring free inodes: $inodes_df"
fi

inodes_row=$(printf '%s\n' "$inodes_df" | awk 'NR == 2 { print; exit }')
read -r _ _ _ free_inodes _ _ <<< "$inodes_row" || true
if [[ -z "$inodes_row" || ! "$free_inodes" =~ ^[0-9]+$ ]]; then
  fail 'invalid or empty free inodes measurement'
fi

if decimal_lt "$free_inodes" "$min_free_inodes"; then
  fail "free inodes $free_inodes below threshold $min_free_inodes"
fi

printf 'disk/inode preflight passed: free bytes=%s free percent=%s free inodes=%s\n' \
  "$free_bytes" "$free_percent" "$free_inodes"
