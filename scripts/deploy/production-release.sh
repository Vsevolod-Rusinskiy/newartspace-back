#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# BEGIN NAS_RETENTION_COMMON_CORE

ATOMIC_TEMP=
LEDGER_ENTRIES=()
PROTECTED_TAGS=()
PROTECTED_TAG_IDS=()
PROTECTED_IDS=()
CONTAINER_TAGS=()
CONTAINER_IDS=()
CANDIDATE_TAGS=()
CANDIDATE_IDS=()
CANDIDATE_SIZES=()
CANDIDATE_BYTES=0
MEASURED_FREE_BYTES=
MEASURED_FREE_PERCENT=
MEASURED_FREE_INODES=
IMAGE_ID=
IMAGE_SIZE=
RELEASE_STARTED_AT=
DEPLOYED_RESTART_COUNT=

cleanup_atomic_temp() {
  if [[ -n "$ATOMIC_TEMP" && -f "$ATOMIC_TEMP" && ! -L "$ATOMIC_TEMP" ]]; then
    rm -f -- "$ATOMIC_TEMP"
  fi
}
trap cleanup_atomic_temp EXIT

fail() {
  printf 'production release failed: %s\n' "$1" >&2
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

decimal_add() {
  local left right left_index right_index carry=0 digit sum result=
  left=$(normalize_decimal "$1")
  right=$(normalize_decimal "$2")
  left_index=$((${#left} - 1))
  right_index=$((${#right} - 1))
  while (( left_index >= 0 || right_index >= 0 || carry > 0 )); do
    sum=$carry
    if (( left_index >= 0 )); then
      digit=${left:left_index:1}
      sum=$((sum + digit))
      left_index=$((left_index - 1))
    fi
    if (( right_index >= 0 )); then
      digit=${right:right_index:1}
      sum=$((sum + digit))
      right_index=$((right_index - 1))
    fi
    result="$((sum % 10))$result"
    carry=$((sum / 10))
  done
  printf '%s' "${result:-0}"
}

is_decimal() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

array_contains() {
  local needle=$1 item
  shift
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then return 0; fi
  done
  return 1
}

require_configuration() {
  local name value
  for name in \
    NAS_RETENTION_MODE NAS_RELEASE_LOCK_PATH NAS_RELEASE_LOCK_WAIT_SECONDS \
    NAS_RETENTION_STATE_DIR NAS_RETENTION_OWNER_UID NAS_RETENTION_LEDGER_NAME \
    NAS_IMAGE_REPOSITORY NAS_DEPLOY_EXPECTED_IMAGE NAS_DEPLOY_SERVICE_CONTAINER \
    NAS_DEPLOY_DB_CONTAINER NAS_DEPLOY_LOCAL_URL NAS_DEPLOY_SITE_URL \
    NAS_DEPLOY_MOUNTPOINT NAS_DEPLOY_MIN_FREE_BYTES NAS_DEPLOY_MIN_FREE_PERCENT \
    NAS_DEPLOY_MIN_FREE_INODES NAS_RETENTION_SOFT_MIN_FREE_BYTES \
    NAS_DEPLOY_DB_ATTEMPTS NAS_DEPLOY_DB_DELAY_SECONDS \
    NAS_DEPLOY_SERVICE_ATTEMPTS NAS_DEPLOY_SERVICE_DELAY_SECONDS \
    NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS NAS_RETENTION_SEED_1 \
    NAS_RETENTION_SEED_2 NAS_RETENTION_SEED_3; do
    value=${!name-}
    [[ -n "$value" && "$value" != *$'\n'* && "$value" != *$'\r'* ]] || fail "missing or invalid configuration: $name"
  done

  retention_mode=$NAS_RETENTION_MODE
  lock_path=$NAS_RELEASE_LOCK_PATH
  lock_wait_seconds=$NAS_RELEASE_LOCK_WAIT_SECONDS
  state_dir=$NAS_RETENTION_STATE_DIR
  owner_uid=$NAS_RETENTION_OWNER_UID
  ledger_name=$NAS_RETENTION_LEDGER_NAME
  ledger_path="$state_dir/$ledger_name"
  image_repository=$NAS_IMAGE_REPOSITORY
  expected_image=$NAS_DEPLOY_EXPECTED_IMAGE
  service_container=$NAS_DEPLOY_SERVICE_CONTAINER
  database_container=$NAS_DEPLOY_DB_CONTAINER
  local_url=$NAS_DEPLOY_LOCAL_URL
  site_url=$NAS_DEPLOY_SITE_URL
  mountpoint=$NAS_DEPLOY_MOUNTPOINT
  hard_min_free_bytes=$NAS_DEPLOY_MIN_FREE_BYTES
  hard_min_free_percent=$NAS_DEPLOY_MIN_FREE_PERCENT
  hard_min_free_inodes=$NAS_DEPLOY_MIN_FREE_INODES
  soft_min_free_bytes=$NAS_RETENTION_SOFT_MIN_FREE_BYTES
  database_attempts=$NAS_DEPLOY_DB_ATTEMPTS
  database_delay_seconds=$NAS_DEPLOY_DB_DELAY_SECONDS
  service_attempts=$NAS_DEPLOY_SERVICE_ATTEMPTS
  service_delay_seconds=$NAS_DEPLOY_SERVICE_DELAY_SECONDS
  request_timeout_seconds=$NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS
  seed_1=$NAS_RETENTION_SEED_1
  seed_2=$NAS_RETENTION_SEED_2
  seed_3=$NAS_RETENTION_SEED_3

  [[ "$retention_mode" == dry-run || "$retention_mode" == apply ]] || fail 'NAS_RETENTION_MODE must be dry-run or apply'
  [[ "$lock_path" == /* && "$state_dir" == /* && "$mountpoint" == /* ]] || fail 'release paths must be absolute'
  [[ "$ledger_name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || fail 'invalid ledger name'
  [[ "$image_repository" =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/[a-z0-9][a-z0-9._/-]*$ ]] || fail 'invalid image repository'
  [[ "$service_container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ && "$database_container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || fail 'invalid container configuration'
  [[ "$local_url" =~ ^http://127\.0\.0\.1:([0-9]{1,5})(/[^[:space:]]*)?$ ]] || fail 'invalid local readiness URL'
  local local_port=${BASH_REMATCH[1]}
  is_decimal "$local_port" || fail 'invalid local readiness port'
  if decimal_lt "$local_port" 1 || decimal_gt "$local_port" 65535; then fail 'invalid local readiness port'; fi
  [[ "$site_url" =~ ^https://[^/[:space:]]+(/[^[:space:]]*)?$ ]] || fail 'invalid public readiness URL'

  for value in "$lock_wait_seconds" "$owner_uid" "$hard_min_free_bytes" \
    "$hard_min_free_percent" "$hard_min_free_inodes" "$soft_min_free_bytes" \
    "$database_attempts" "$database_delay_seconds" "$service_attempts" \
    "$service_delay_seconds" "$request_timeout_seconds"; do
    is_decimal "$value" || fail 'numeric release configuration is invalid'
  done
  [[ "$lock_wait_seconds" == 300 ]] || fail 'fixed release lock wait is invalid'
  if decimal_gt "$hard_min_free_percent" 100; then fail 'invalid hard free-percent threshold'; fi
  if decimal_lt "$soft_min_free_bytes" "$hard_min_free_bytes"; then fail 'soft free-byte threshold must not be below the hard threshold'; fi
  if decimal_lt "$database_attempts" 1 || decimal_gt "$database_attempts" 10 || decimal_gt "$database_delay_seconds" 60; then
    fail 'invalid database readiness bounds'
  fi
  if decimal_lt "$service_attempts" 2 || decimal_gt "$service_attempts" 20 || decimal_gt "$service_delay_seconds" 60 || \
     decimal_lt "$request_timeout_seconds" 1 || decimal_gt "$request_timeout_seconds" 30; then
    fail 'invalid service readiness bounds'
  fi

  require_application_configuration

  exact_tag "$expected_image" || fail 'expected image is not an exact repository SHA tag'
  for value in "$seed_1" "$seed_2" "$seed_3"; do
    exact_tag "$value" || fail 'retention seed is not an exact repository SHA tag'
  done
  [[ "$seed_1" != "$seed_2" && "$seed_1" != "$seed_3" && "$seed_2" != "$seed_3" ]] || fail 'retention seeds must be distinct'
}

acquire_release_lock() {
  if [[ -L "$lock_path" ]]; then fail 'release lock path must not be a symlink'; fi
  exec 9>"$lock_path" || fail "cannot open release lock $lock_path"
  flock -w "$lock_wait_seconds" 9 || fail "release lock timeout after $lock_wait_seconds second(s)"
}

path_owner() {
  local path=$1 owner
  if owner=$(stat -c '%u' -- "$path" 2>/dev/null); then
    printf '%s' "$owner"
  elif owner=$(stat -f '%u' -- "$path" 2>/dev/null); then
    printf '%s' "$owner"
  else
    fail "cannot inspect owner for $path"
  fi
}

path_mode() {
  local path=$1 mode
  if mode=$(stat -c '%a' -- "$path" 2>/dev/null); then
    printf '%s' "$mode"
  elif mode=$(stat -f '%Lp' -- "$path" 2>/dev/null); then
    printf '%s' "$mode"
  else
    fail "cannot inspect permissions for $path"
  fi
}

ensure_state_directory() {
  local state_parent state_grandparent
  if [[ "$state_dir" != /* || "$state_dir" == / || "$state_dir" == */ ||
        "$state_dir" == *'//'* || "$state_dir" == *'/./'* || "$state_dir" == */. ||
        "$state_dir" == *'/../'* || "$state_dir" == */.. ]]; then
    fail 'retention state directory path must be absolute and normalized with a non-root parent'
  fi
  state_parent=${state_dir%/*}
  [[ -n "$state_parent" && "$state_parent" != / ]] || \
    fail 'retention state directory path must be absolute and normalized with a non-root parent'
  state_grandparent=${state_parent%/*}
  if [[ -z "$state_grandparent" ]]; then state_grandparent=/; fi

  [[ -d "$state_grandparent" && ! -L "$state_grandparent" ]] || \
    fail 'retention state grandparent must be an existing regular non-symlink directory'
  [[ "$(path_owner "$state_grandparent")" == "$owner_uid" ]] || \
    fail "retention state grandparent owner must be UID $owner_uid"

  if [[ -L "$state_parent" || -e "$state_parent" && ! -d "$state_parent" ]]; then
    fail 'retention state parent must be a regular non-symlink directory'
  fi
  if [[ ! -e "$state_parent" ]]; then
    umask 077
    mkdir -- "$state_parent" || fail "cannot create retention state parent $state_parent"
    chmod 700 "$state_parent" || fail "cannot secure retention state parent $state_parent"
  fi
  [[ -d "$state_parent" && ! -L "$state_parent" ]] || \
    fail 'retention state parent must be a regular non-symlink directory'
  [[ "$(path_owner "$state_parent")" == "$owner_uid" ]] || \
    fail "retention state parent owner must be UID $owner_uid"
  [[ "$(path_mode "$state_parent")" == 700 ]] || fail 'retention state parent permissions must be 0700'

  if [[ -L "$state_dir" ]]; then fail 'state directory must be a regular non-symlink directory'; fi
  if [[ ! -e "$state_dir" ]]; then
    umask 077
    mkdir -- "$state_dir" || fail "cannot create state directory $state_dir"
    chmod 700 "$state_dir" || fail "cannot secure state directory $state_dir"
  fi
  [[ -d "$state_dir" && ! -L "$state_dir" ]] || fail 'state directory must be a regular non-symlink directory'
  [[ "$(path_owner "$state_dir")" == "$owner_uid" ]] || fail "state directory owner must be UID $owner_uid"
  [[ "$(path_mode "$state_dir")" == 700 ]] || fail 'state directory permissions must be 0700'
}

measure_capacity() {
  local bytes_df bytes_row used_percent inode_df inode_row
  if ! bytes_df=$(df -B1 -P -- "$mountpoint" 2>&1); then fail "df failed while measuring capacity: $bytes_df"; fi
  bytes_row=$(printf '%s\n' "$bytes_df" | awk 'NR == 2 { print; exit }')
  read -r _ _ _ MEASURED_FREE_BYTES used_percent _ <<<"$bytes_row" || true
  if [[ -z "$bytes_row" || ! "$MEASURED_FREE_BYTES" =~ ^[0-9]+$ || ! "$used_percent" =~ ^[0-9]+%$ ]]; then
    fail 'invalid free bytes/free percent measurement'
  fi
  used_percent=${used_percent%%%}
  if decimal_gt "$used_percent" 100; then fail 'invalid free percent measurement'; fi
  MEASURED_FREE_PERCENT=$((100 - used_percent))

  if ! inode_df=$(df -Pi -P -- "$mountpoint" 2>&1); then fail "df failed while measuring inodes: $inode_df"; fi
  inode_row=$(printf '%s\n' "$inode_df" | awk 'NR == 2 { print; exit }')
  read -r _ _ _ MEASURED_FREE_INODES _ _ <<<"$inode_row" || true
  [[ -n "$inode_row" && "$MEASURED_FREE_INODES" =~ ^[0-9]+$ ]] || fail 'invalid free inode measurement'
  printf 'capacity: free bytes=%s free percent=%s free inodes=%s\n' \
    "$MEASURED_FREE_BYTES" "$MEASURED_FREE_PERCENT" "$MEASURED_FREE_INODES"
}

record_pre_release_inventory() {
  local container_list container output name running restart config_image image_id extra
  container_list=$(docker ps -aq) || fail 'cannot list containers for pre-release inventory'
  while IFS= read -r container; do
    [[ -n "$container" ]] || continue
    output=$(docker inspect --format '{{.Name}}|{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}' \
      "$container" 2>/dev/null) || fail "cannot inspect pre-release container $container"
    [[ -n "$output" && "$output" != *$'\n'* ]] || fail "ambiguous pre-release container $container"
    name=
    running=
    restart=
    config_image=
    image_id=
    extra=
    IFS='|' read -r name running restart config_image image_id extra <<<"$output" || true
    name=${name#/}
    if [[ -n "$extra" || ! "$name" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ||
          "$running" != true && "$running" != false || ! "$restart" =~ ^[0-9]+$ ||
          -z "$config_image" || ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
      fail "invalid pre-release container inventory for $container"
    fi
    printf 'pre-release container: name=%s running=%s restart=%s tag=%s id=%s\n' \
      "$name" "$running" "$restart" "$config_image" "$image_id"
  done <<<"$container_list"
}

check_hard_capacity() {
  if decimal_lt "$MEASURED_FREE_BYTES" "$hard_min_free_bytes"; then
    fail "free bytes $MEASURED_FREE_BYTES below hard threshold $hard_min_free_bytes"
  fi
  if decimal_lt "$MEASURED_FREE_PERCENT" "$hard_min_free_percent"; then
    fail "free percent $MEASURED_FREE_PERCENT below hard threshold $hard_min_free_percent"
  fi
  if decimal_lt "$MEASURED_FREE_INODES" "$hard_min_free_inodes"; then
    fail "free inodes $MEASURED_FREE_INODES below hard threshold $hard_min_free_inodes"
  fi
}

check_database() {
  local db_check_script attempt running check_status last_error='no successful database readiness check'
  db_check_script='if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  exit 14
fi
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 || exit 11
query_result=$(psql -X -qAt -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1") || exit 12
query_result=$(printf "%s" "$query_result" | tr -d "[:space:]")
[ "$query_result" = 1 ] || exit 13'

  for ((attempt=1; attempt<=database_attempts; attempt++)); do
    running=
    if ! running=$(docker inspect --format '{{.State.Running}}' "$database_container" 2>/dev/null); then
      last_error='database container inspect failed'
    elif [[ "$running" != true ]]; then
      last_error='database container is not running'
    else
      check_status=0
      if docker exec "$database_container" sh -euc "$db_check_script" >/dev/null 2>&1; then
        printf 'database readiness passed: container=%s attempts=%s\n' "$database_container" "$attempt"
        return 0
      else
        check_status=$?
        case "$check_status" in
          11) last_error='pg_isready failed' ;;
          12) last_error='SELECT 1 query failed' ;;
          13) last_error='SELECT 1 returned an unexpected result' ;;
          14) fail 'database container credentials are missing or empty' ;;
          *) last_error='container database check failed' ;;
        esac
      fi
    fi
    if (( attempt < database_attempts )); then sleep "$database_delay_seconds"; fi
  done
  fail "database readiness after $database_attempts attempt(s): $last_error"
}

check_service() {
  local attempt inspect_output running restart_count current_image current_image_id extra local_code site_code
  local expected_image_id
  local candidate_restart= last_error='no two consecutive healthy samples'
  read_image_metadata "$expected_image"
  expected_image_id=$IMAGE_ID
  for ((attempt=1; attempt<=service_attempts; attempt++)); do
    inspect_output=
    if ! inspect_output=$(docker inspect --format '{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}' "$service_container" 2>/dev/null); then
      candidate_restart=
      last_error='container inspect failed'
    elif [[ "$inspect_output" == *$'\n'* ]]; then
      candidate_restart=
      last_error='invalid container state measurement'
    else
      running=
      restart_count=
      current_image=
      current_image_id=
      extra=
      IFS='|' read -r running restart_count current_image current_image_id extra <<<"$inspect_output" || true
      if [[ -n "$extra" || "$running" != true && "$running" != false || ! "$restart_count" =~ ^[0-9]+$ ||
            -z "$current_image" || ! "$current_image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
        candidate_restart=
        last_error='invalid container state measurement'
      elif [[ "$running" != true ]]; then
        candidate_restart=
        last_error='container is not running'
      elif [[ "$current_image" != "$expected_image" ]]; then
        candidate_restart=
        last_error="image mismatch: expected $expected_image, got $current_image"
      elif [[ "$current_image_id" != "$expected_image_id" ]]; then
        candidate_restart=
        last_error="service image ID mismatch: expected $expected_image_id, got $current_image_id"
      elif ! local_code=$(curl --fail --silent --show-error --connect-timeout "$request_timeout_seconds" \
        --max-time "$request_timeout_seconds" --output /dev/null --write-out '%{http_code}' --url "$local_url"); then
        candidate_restart=
        last_error='local service request failed'
      elif [[ ! "$local_code" =~ ^2[0-9][0-9]$ ]]; then
        candidate_restart=
        last_error="local service returned HTTP $local_code"
      elif ! site_code=$(curl --fail --silent --show-error --connect-timeout "$request_timeout_seconds" \
        --max-time "$request_timeout_seconds" --output /dev/null --write-out '%{http_code}' --url "$site_url"); then
        candidate_restart=
        last_error='public site request failed'
      elif [[ ! "$site_code" =~ ^2[0-9][0-9]$ ]]; then
        candidate_restart=
        last_error="public site returned HTTP $site_code"
      elif [[ -n "$candidate_restart" && "$candidate_restart" == "$restart_count" ]]; then
        if [[ -z "$DEPLOYED_RESTART_COUNT" ]]; then
          DEPLOYED_RESTART_COUNT=$restart_count
        elif [[ "$restart_count" != "$DEPLOYED_RESTART_COUNT" ]]; then
          fail "restart count changed after retention: expected $DEPLOYED_RESTART_COUNT, got $restart_count"
        fi
        printf 'service readiness passed: container=%s image=%s restart=%s attempts=%s\n' \
          "$service_container" "$expected_image" "$restart_count" "$attempt"
        return 0
      else
        candidate_restart=$restart_count
        last_error='waiting for a second stable healthy sample'
      fi
    fi
    if (( attempt < service_attempts )); then sleep "$service_delay_seconds"; fi
  done
  fail "service readiness after $service_attempts attempt(s): $last_error"
}

exact_tag() {
  local tag=$1 prefix suffix
  prefix="${image_repository}:sha-"
  [[ "$tag" == "$prefix"* ]] || return 1
  suffix=${tag#"$prefix"}
  [[ "$suffix" =~ ^[0-9a-f]{40}$ ]]
}

read_image_metadata() {
  local tag=$1 output extra
  output=
  if ! output=$(docker image inspect --format '{{.Id}}|{{.Size}}' -- "$tag" 2>/dev/null); then
    fail "local image is missing for $tag"
  fi
  if [[ -z "$output" || "$output" == *$'\n'* ]]; then fail "ambiguous local image metadata for $tag"; fi
  IMAGE_ID=
  IMAGE_SIZE=
  extra=
  IFS='|' read -r IMAGE_ID IMAGE_SIZE extra <<<"$output" || true
  if [[ -n "$extra" || ! "$IMAGE_ID" =~ ^sha256:[0-9a-f]{64}$ || ! "$IMAGE_SIZE" =~ ^[0-9]+$ ]]; then
    fail "invalid local image metadata for $tag"
  fi
}

require_registry_tag() {
  docker manifest inspect "$1" >/dev/null 2>&1 || fail "registry manifest unavailable for $1"
}

atomic_write_ledger() {
  local line
  ATOMIC_TEMP=$(mktemp "$state_dir/.${ledger_name}.tmp.XXXXXX") || fail 'cannot create atomic ledger file'
  chmod 600 "$ATOMIC_TEMP" || fail 'cannot secure atomic ledger file'
  : >"$ATOMIC_TEMP"
  for line in "$@"; do printf '%s\n' "$line" >>"$ATOMIC_TEMP"; done
  sync -f "$ATOMIC_TEMP" || fail 'cannot fsync atomic ledger file'
  mv -f -- "$ATOMIC_TEMP" "$ledger_path" || fail 'cannot atomically replace ledger'
  ATOMIC_TEMP=
  sync -f "$state_dir" || fail 'cannot fsync retention state directory'
  [[ "$(path_owner "$ledger_path")" == "$owner_uid" ]] || fail "ledger owner must be UID $owner_uid"
  [[ "$(path_mode "$ledger_path")" == 600 ]] || fail 'ledger permissions must be 0600'
}

validate_protected_tail() {
  local count start index tag
  PROTECTED_TAGS=()
  PROTECTED_TAG_IDS=()
  PROTECTED_IDS=()
  count=${#LEDGER_ENTRIES[@]}
  (( count >= 3 )) || fail 'ledger must contain at least three successful images'
  start=$((count - 3))
  for ((index=start; index<count; index++)); do
    tag=${LEDGER_ENTRIES[$index]}
    read_image_metadata "$tag"
    require_registry_tag "$tag"
    PROTECTED_TAGS+=("$tag")
    PROTECTED_TAG_IDS+=("$IMAGE_ID")
    if ! array_contains "$IMAGE_ID" "${PROTECTED_IDS[@]-}"; then PROTECTED_IDS+=("$IMAGE_ID"); fi
  done
}

validate_or_seed_ledger() {
  local inspect_output running running_image running_image_id extra newest_index line count=0
  ensure_state_directory
  if [[ -L "$ledger_path" ]]; then fail 'ledger must be a regular non-symlink file'; fi
  if [[ -e "$ledger_path" ]]; then
    [[ -f "$ledger_path" && ! -L "$ledger_path" ]] || fail 'ledger must be a regular non-symlink file'
    [[ "$(path_owner "$ledger_path")" == "$owner_uid" ]] || fail "ledger owner must be UID $owner_uid"
    [[ "$(path_mode "$ledger_path")" == 600 ]] || fail 'ledger permissions must be 0600'
    LEDGER_ENTRIES=()
    while IFS= read -r line || [[ -n "$line" ]]; do
      count=$((count + 1))
      (( count <= 1000 )) || fail 'ledger contains too many entries'
      exact_tag "$line" || fail "malformed ledger entry: $line"
      if array_contains "$line" "${LEDGER_ENTRIES[@]-}"; then fail "duplicate ledger entry: $line"; fi
      LEDGER_ENTRIES+=("$line")
    done <"$ledger_path"
  else
    LEDGER_ENTRIES=("$seed_1" "$seed_2" "$seed_3")
  fi

  (( ${#LEDGER_ENTRIES[@]} >= 3 )) || fail 'ledger must contain at least three successful images'
  inspect_output=$(docker inspect --format '{{.State.Running}}|{{.Config.Image}}|{{.Image}}' "$service_container" 2>/dev/null) || \
    fail 'cannot inspect running service image'
  [[ -n "$inspect_output" && "$inspect_output" != *$'\n'* ]] || fail 'invalid running service image'
  running=
  running_image=
  running_image_id=
  extra=
  IFS='|' read -r running running_image running_image_id extra <<<"$inspect_output" || true
  [[ -z "$extra" && ( "$running" == true || "$running" == false ) ]] || fail 'invalid running service image'
  [[ "$running_image_id" =~ ^sha256:[0-9a-f]{64}$ && -n "$running_image" ]] || fail 'invalid running service image'
  [[ "$running" == true ]] || fail 'running service container is not running'
  if [[ "$running_image" != "${LEDGER_ENTRIES[${#LEDGER_ENTRIES[@]}-1]}" ]]; then
    if [[ ! -e "$ledger_path" ]]; then fail 'running image does not match newest seed'; fi
    fail 'running image does not match newest ledger success'
  fi
  validate_protected_tail
  newest_index=$((${#PROTECTED_TAG_IDS[@]} - 1))
  [[ "$running_image_id" == "${PROTECTED_TAG_IDS[$newest_index]}" ]] || \
    fail 'running service image ID does not match newest ledger tag'
  if [[ ! -e "$ledger_path" ]]; then atomic_write_ledger "${LEDGER_ENTRIES[@]}"; fi
}

record_success() {
  local existing
  read_image_metadata "$expected_image"
  require_registry_tag "$expected_image"
  if [[ "${LEDGER_ENTRIES[${#LEDGER_ENTRIES[@]}-1]}" != "$expected_image" ]]; then
    for existing in "${LEDGER_ENTRIES[@]}"; do
      [[ "$existing" != "$expected_image" ]] || fail 'expected image appears out of order in ledger'
    done
    LEDGER_ENTRIES+=("$expected_image")
    atomic_write_ledger "${LEDGER_ENTRIES[@]}"
  fi
  validate_protected_tail
}

collect_container_ids() {
  local container_list container output image_id config_image extra
  CONTAINER_IDS=()
  CONTAINER_TAGS=()
  container_list=$(docker ps -aq) || fail 'cannot list containers for retention inventory'
  while IFS= read -r container; do
    [[ -n "$container" ]] || continue
    output=$(docker inspect --format '{{.Image}}|{{.Config.Image}}' "$container" 2>/dev/null) || fail "cannot inspect container reference $container"
    [[ -n "$output" && "$output" != *$'\n'* ]] || fail "ambiguous container reference $container"
    image_id=
    config_image=
    extra=
    IFS='|' read -r image_id config_image extra <<<"$output" || true
    [[ -z "$extra" && "$image_id" =~ ^sha256:[0-9a-f]{64}$ && -n "$config_image" ]] || fail "invalid container reference $container"
    if ! array_contains "$image_id" "${CONTAINER_IDS[@]-}"; then CONTAINER_IDS+=("$image_id"); fi
    if ! array_contains "$config_image" "${CONTAINER_TAGS[@]-}"; then CONTAINER_TAGS+=("$config_image"); fi
  done <<<"$container_list"
}

select_candidates() {
  local image_list sorted_image_list tag
  CANDIDATE_TAGS=()
  CANDIDATE_IDS=()
  CANDIDATE_SIZES=()
  image_list=$(docker image ls --format '{{.Repository}}:{{.Tag}}' "$image_repository") || \
    fail 'cannot list local repository images'
  sorted_image_list=$(printf '%s\n' "$image_list" | LC_ALL=C sort -u) || fail 'cannot sort local repository images'
  while IFS= read -r tag; do
    [[ -n "$tag" ]] || continue
    exact_tag "$tag" || continue
    if array_contains "$tag" "${PROTECTED_TAGS[@]-}" || array_contains "$tag" "${CONTAINER_TAGS[@]-}"; then continue; fi
    read_image_metadata "$tag"
    if array_contains "$IMAGE_ID" "${PROTECTED_IDS[@]-}" || array_contains "$IMAGE_ID" "${CONTAINER_IDS[@]-}"; then continue; fi
    CANDIDATE_TAGS+=("$tag")
    CANDIDATE_IDS+=("$IMAGE_ID")
    CANDIDATE_SIZES+=("$IMAGE_SIZE")
  done <<<"$sorted_image_list"
}

verify_candidates() {
  local index tag id size seen_ids=()
  CANDIDATE_BYTES=0
  for ((index=0; index<${#CANDIDATE_TAGS[@]}; index++)); do
    tag=${CANDIDATE_TAGS[$index]}
    id=${CANDIDATE_IDS[$index]}
    size=${CANDIDATE_SIZES[$index]}
    exact_tag "$tag" || fail "invalid deletion candidate $tag"
    [[ "$id" =~ ^sha256:[0-9a-f]{64}$ && "$size" =~ ^[0-9]+$ ]] || fail "invalid deletion metadata for $tag"
    if array_contains "$id" "${CONTAINER_IDS[@]-}"; then fail "candidate is referenced by a container: $tag"; fi
    require_registry_tag "$tag"
    if ! array_contains "$id" "${seen_ids[@]-}"; then
      seen_ids+=("$id")
      CANDIDATE_BYTES=$(decimal_add "$CANDIDATE_BYTES" "$size")
    fi
  done
}

run_retention() {
  local index
  for ((index=0; index<${#CANDIDATE_TAGS[@]}; index++)); do
    printf 'retention candidate: tag=%s id=%s size=%s\n' \
      "${CANDIDATE_TAGS[$index]}" "${CANDIDATE_IDS[$index]}" "${CANDIDATE_SIZES[$index]}"
  done
  printf 'retention %s: candidates=%s candidate_bytes=%s\n' \
    "$retention_mode" "${#CANDIDATE_TAGS[@]}" "$CANDIDATE_BYTES"
  if [[ "$retention_mode" == apply && ${#CANDIDATE_TAGS[@]} -gt 0 ]]; then
    docker image rm -- "${CANDIDATE_TAGS[@]}" || fail 'image removal failed'
  fi
}

verify_retention_result() {
  local index tag expected_id output
  for ((index=0; index<${#PROTECTED_TAGS[@]}; index++)); do
    tag=${PROTECTED_TAGS[$index]}
    expected_id=${PROTECTED_TAG_IDS[$index]}
    read_image_metadata "$tag"
    [[ "$IMAGE_ID" == "$expected_id" ]] || fail "protected image ID changed for $tag"
  done
  if [[ "$retention_mode" == apply && ${#CANDIDATE_TAGS[@]} -gt 0 ]]; then
    for tag in "${CANDIDATE_TAGS[@]}"; do
      output=$(docker image inspect --format '{{.Id}}|{{.Size}}' -- "$tag" 2>/dev/null) || continue
      [[ -z "$output" ]] || fail "deleted candidate remains locally tagged: $tag"
    done
  fi
}

check_fresh_logs() {
  local logs
  logs=$(docker logs --since "$RELEASE_STARTED_AT" "$service_container" 2>&1) || fail 'cannot read fresh application logs'
  if grep -Eiq \
    '(^|[^[:alnum:]_])(fatal|panic|oom(kill(ed|er)?)?)([^[:alnum:]_]|$)|no([[:space:]]+|-+)space([[:space:]]+left[[:space:]]+on[[:space:]]+device|([^[:alnum:]_]|$))|migration([^[:alnum:]_]|.)*(failed|failure)' \
    <<<"$logs"; then
    fail 'fresh application logs contain a fatal pattern'
  fi
  printf 'fresh application logs passed\n'
}

compact_ledger() {
  local count=${#LEDGER_ENTRIES[@]}
  atomic_write_ledger \
    "${LEDGER_ENTRIES[$((count - 3))]}" \
    "${LEDGER_ENTRIES[$((count - 2))]}" \
    "${LEDGER_ENTRIES[$((count - 1))]}"
  LEDGER_ENTRIES=(
    "${LEDGER_ENTRIES[$((count - 3))]}"
    "${LEDGER_ENTRIES[$((count - 2))]}"
    "${LEDGER_ENTRIES[$((count - 1))]}"
  )
}

main() {
  require_configuration
  acquire_release_lock
  RELEASE_STARTED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ') || fail 'cannot record release start time'

  measure_capacity
  record_pre_release_inventory
  validate_or_seed_ledger
  check_hard_capacity
  check_database

  deploy_application
  check_database
  check_service
  record_success

  collect_container_ids
  select_candidates
  verify_candidates
  run_retention

  measure_capacity
  verify_retention_result
  check_database
  check_service
  check_fresh_logs

  if [[ "$retention_mode" == apply ]]; then compact_ledger; fi
  if decimal_lt "$MEASURED_FREE_BYTES" "$soft_min_free_bytes"; then
    fail "free bytes $MEASURED_FREE_BYTES below soft threshold $soft_min_free_bytes after healthy post-checks"
  fi
  printf 'production release passed: mode=%s image=%s\n' "$retention_mode" "$expected_image"
}

# END NAS_RETENTION_COMMON_CORE

require_application_configuration() {
  backend_deploy_script=${NAS_BACKEND_DEPLOY_SCRIPT-}
  [[ "$ledger_name" == back.successful-images ]] || fail "fixed backend ledger name is invalid"
  [[ "$image_repository" == ghcr.io/vsevolod-rusinskiy/newartspace-back ]] || fail "fixed backend image repository is invalid"
  [[ "$service_container" == back ]] || fail "fixed backend service container is invalid"
  [[ "$database_container" == database ]] || fail "fixed database container is invalid"
  [[ "$local_url" == http://127.0.0.1:3000/version ]] || fail "fixed backend local URL is invalid"
  [[ "$site_url" == https://newartspace.ru/ ]] || fail "fixed backend public URL is invalid"
  [[ "$mountpoint" == / ]] || fail "fixed deploy mountpoint is invalid"
  [[ "$hard_min_free_bytes" == 10737418240 ]] || fail "fixed hard free-byte threshold is invalid"
  [[ "$hard_min_free_percent" == 10 ]] || fail "fixed hard free-percent threshold is invalid"
  [[ "$hard_min_free_inodes" == 1000000 ]] || fail "fixed hard free-inode threshold is invalid"
  [[ "$soft_min_free_bytes" == 16106127360 ]] || fail "fixed soft free-byte threshold is invalid"
  [[ "$seed_1" == "ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d" &&
     "$seed_2" == "ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-25f399f352b311462caf53e12baa230bc1049366" &&
     "$seed_3" == "ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-492304ccfad8038d047e5228e989eedb3da04f38" ]] ||
    fail "fixed backend seed set is invalid"
  [[ "$backend_deploy_script" == /var/www/newartspace/scripts/deploy.sh ]] ||
    fail "fixed backend deploy script is invalid"
}

deploy_application() {
  local revision
  revision=${expected_image#"$image_repository:"}
  printf "Delegate backend deploy: service=back revision=%s\n" "$revision"
  "$backend_deploy_script" back "$revision" || fail "backend deploy command failed"
}

main "$@"
