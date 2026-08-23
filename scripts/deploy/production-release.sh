#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C
umask 077

EXPECTED_REPOSITORY='ghcr.io/vsevolod-rusinskiy/newartspace-back'
EXPECTED_SERVICE_CONTAINER='back'
EXPECTED_DB_CONTAINER='database'
EXPECTED_MOUNTPOINT='/'
EXPECTED_LOCAL_URL='http://127.0.0.1:3000/version'
EXPECTED_SITE_URL='https://newartspace.ru/'
EXPECTED_MIN_FREE_BYTES='10737418240'
EXPECTED_MIN_FREE_PERCENT='10'
EXPECTED_MIN_FREE_INODES='1000000'
EXPECTED_SOFT_MIN_FREE_BYTES='16106127360'
EXPECTED_DB_ATTEMPTS='3'
EXPECTED_DB_DELAY_SECONDS='5'
EXPECTED_SERVICE_ATTEMPTS='10'
EXPECTED_SERVICE_DELAY_SECONDS='5'
EXPECTED_REQUEST_TIMEOUT_SECONDS='10'
EXPECTED_SEED_OLDEST="$EXPECTED_REPOSITORY:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d"
EXPECTED_SEED_MIDDLE="$EXPECTED_REPOSITORY:sha-25f399f352b311462caf53e12baa230bc1049366"
EXPECTED_SEED_NEWEST="$EXPECTED_REPOSITORY:sha-492304ccfad8038d047e5228e989eedb3da04f38"

EXPECTED_IMAGE=''
LEDGER_PATH=''
RELEASE_STARTED_AT=''
CAPACITY_FREE_BYTES=''
CAPACITY_FREE_PERCENT=''
CAPACITY_FREE_INODES=''
SERVICE_RESTART_COUNT=''
SERVICE_IMAGE_ID=''
LEDGER_ENTRIES=()
PROTECTED_TAGS=()
PROTECTED_TAG_IDS=()
PROTECTED_IDS=()
REFERENCED_IDS=()
REFERENCED_TAGS=()
CANDIDATE_TAGS=()
CANDIDATE_IDS=()
CANDIDATE_SIZES=()
CANDIDATE_TOTAL_BYTES=0

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

array_contains() {
  local wanted=$1
  shift
  local value
  for value in "$@"; do
    if [[ "$value" == "$wanted" ]]; then
      return 0
    fi
  done
  return 1
}

require_environment_value() {
  local name=$1
  if [[ -z ${!name-} ]]; then
    fail "required configuration $name is missing or empty"
  fi
}

require_exact_configuration() {
  local name=$1
  local expected=$2
  if [[ ${!name} != "$expected" ]]; then
    fail "$name must equal $expected"
  fi
}

require_configuration() {
  local name
  for name in \
    NAS_RELEASE_GIT_SHA NAS_RETENTION_MODE NAS_RELEASE_LOCK_PATH \
    NAS_RELEASE_LOCK_WAIT_SECONDS NAS_RETENTION_STATE_DIR \
    NAS_RETENTION_OWNER_UID NAS_RELEASE_REPOSITORY \
    NAS_RELEASE_SERVICE_CONTAINER NAS_RELEASE_DB_CONTAINER \
    NAS_RELEASE_MOUNTPOINT NAS_RELEASE_LOCAL_URL NAS_RELEASE_SITE_URL \
    NAS_RELEASE_MIN_FREE_BYTES NAS_RELEASE_MIN_FREE_PERCENT \
    NAS_RELEASE_MIN_FREE_INODES NAS_RETENTION_SOFT_MIN_FREE_BYTES \
    NAS_RELEASE_DB_ATTEMPTS NAS_RELEASE_DB_DELAY_SECONDS \
    NAS_RELEASE_SERVICE_ATTEMPTS NAS_RELEASE_SERVICE_DELAY_SECONDS \
    NAS_RELEASE_REQUEST_TIMEOUT_SECONDS NAS_RETENTION_SEED_OLDEST \
    NAS_RETENTION_SEED_MIDDLE NAS_RETENTION_SEED_NEWEST \
    NAS_BACKEND_DEPLOY_SCRIPT; do
    require_environment_value "$name"
  done

  if [[ ! "$NAS_RELEASE_GIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    fail 'NAS_RELEASE_GIT_SHA must be exactly 40 lowercase hexadecimal characters'
  fi
  if [[ "$NAS_RETENTION_MODE" != dry-run && "$NAS_RETENTION_MODE" != apply ]]; then
    fail 'NAS_RETENTION_MODE must be dry-run or apply'
  fi
  if [[ ! "$NAS_RELEASE_LOCK_PATH" =~ ^/[A-Za-z0-9._/-]+$ ||
        ! "$NAS_RETENTION_STATE_DIR" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    fail 'lock and retention state paths must be absolute safe paths'
  fi
  if [[ ! "$NAS_RELEASE_LOCK_WAIT_SECONDS" =~ ^[0-9]+$ ]] ||
     decimal_lt "$NAS_RELEASE_LOCK_WAIT_SECONDS" 1 ||
     decimal_gt "$NAS_RELEASE_LOCK_WAIT_SECONDS" 600; then
    fail 'NAS_RELEASE_LOCK_WAIT_SECONDS must be between 1 and 600'
  fi
  if [[ ! "$NAS_RETENTION_OWNER_UID" =~ ^[0-9]+$ ]]; then
    fail 'NAS_RETENTION_OWNER_UID must be numeric'
  fi
  if [[ "$NAS_BACKEND_DEPLOY_SCRIPT" != /* || ! -f "$NAS_BACKEND_DEPLOY_SCRIPT" ||
        -L "$NAS_BACKEND_DEPLOY_SCRIPT" || ! -x "$NAS_BACKEND_DEPLOY_SCRIPT" ]]; then
    fail 'NAS_BACKEND_DEPLOY_SCRIPT must be an executable absolute non-symlink file'
  fi

  require_exact_configuration NAS_RELEASE_REPOSITORY "$EXPECTED_REPOSITORY"
  require_exact_configuration NAS_RELEASE_SERVICE_CONTAINER "$EXPECTED_SERVICE_CONTAINER"
  require_exact_configuration NAS_RELEASE_DB_CONTAINER "$EXPECTED_DB_CONTAINER"
  require_exact_configuration NAS_RELEASE_MOUNTPOINT "$EXPECTED_MOUNTPOINT"
  require_exact_configuration NAS_RELEASE_LOCAL_URL "$EXPECTED_LOCAL_URL"
  require_exact_configuration NAS_RELEASE_SITE_URL "$EXPECTED_SITE_URL"
  require_exact_configuration NAS_RELEASE_MIN_FREE_BYTES "$EXPECTED_MIN_FREE_BYTES"
  require_exact_configuration NAS_RELEASE_MIN_FREE_PERCENT "$EXPECTED_MIN_FREE_PERCENT"
  require_exact_configuration NAS_RELEASE_MIN_FREE_INODES "$EXPECTED_MIN_FREE_INODES"
  require_exact_configuration NAS_RETENTION_SOFT_MIN_FREE_BYTES "$EXPECTED_SOFT_MIN_FREE_BYTES"
  require_exact_configuration NAS_RELEASE_DB_ATTEMPTS "$EXPECTED_DB_ATTEMPTS"
  require_exact_configuration NAS_RELEASE_DB_DELAY_SECONDS "$EXPECTED_DB_DELAY_SECONDS"
  require_exact_configuration NAS_RELEASE_SERVICE_ATTEMPTS "$EXPECTED_SERVICE_ATTEMPTS"
  require_exact_configuration NAS_RELEASE_SERVICE_DELAY_SECONDS "$EXPECTED_SERVICE_DELAY_SECONDS"
  require_exact_configuration NAS_RELEASE_REQUEST_TIMEOUT_SECONDS "$EXPECTED_REQUEST_TIMEOUT_SECONDS"
  require_exact_configuration NAS_RETENTION_SEED_OLDEST "$EXPECTED_SEED_OLDEST"
  require_exact_configuration NAS_RETENTION_SEED_MIDDLE "$EXPECTED_SEED_MIDDLE"
  require_exact_configuration NAS_RETENTION_SEED_NEWEST "$EXPECTED_SEED_NEWEST"

  EXPECTED_IMAGE="$NAS_RELEASE_REPOSITORY:sha-$NAS_RELEASE_GIT_SHA"
  LEDGER_PATH="$NAS_RETENTION_STATE_DIR/$NAS_RELEASE_SERVICE_CONTAINER.successful-images"
}

acquire_release_lock() {
  if [[ -L "$NAS_RELEASE_LOCK_PATH" ]]; then
    fail 'release lock path must not be a symlink'
  fi
  if ! exec 9>"$NAS_RELEASE_LOCK_PATH"; then
    fail "cannot open release lock $NAS_RELEASE_LOCK_PATH"
  fi
  if ! flock -w "$NAS_RELEASE_LOCK_WAIT_SECONDS" 9; then
    fail "timed out acquiring release lock $NAS_RELEASE_LOCK_PATH"
  fi
  printf 'release lock acquired: path=%s wait_seconds=%s\n' \
    "$NAS_RELEASE_LOCK_PATH" "$NAS_RELEASE_LOCK_WAIT_SECONDS"
}

measure_capacity() {
  local phase=$1
  local bytes_output bytes_row used_percent inodes_output inodes_row
  bytes_output=''
  if ! bytes_output=$(df -B1 -P -- "$NAS_RELEASE_MOUNTPOINT" 2>&1); then
    fail "capacity measurement failed for bytes/percent: $bytes_output"
  fi
  bytes_row=$(printf '%s\n' "$bytes_output" | awk 'NR == 2 { print; exit }')
  read -r _ _ _ CAPACITY_FREE_BYTES used_percent _ <<<"$bytes_row" || true
  if [[ -z "$bytes_row" || ! "$CAPACITY_FREE_BYTES" =~ ^[0-9]+$ ||
        ! "$used_percent" =~ ^[0-9]+%$ ]]; then
    fail 'invalid or empty free bytes/free percent measurement'
  fi
  used_percent=${used_percent%%%}
  if decimal_gt "$used_percent" 100; then
    fail 'invalid free percent measurement'
  fi
  CAPACITY_FREE_PERCENT=$((100 - used_percent))

  inodes_output=''
  if ! inodes_output=$(df -Pi -P -- "$NAS_RELEASE_MOUNTPOINT" 2>&1); then
    fail "capacity measurement failed for inodes: $inodes_output"
  fi
  inodes_row=$(printf '%s\n' "$inodes_output" | awk 'NR == 2 { print; exit }')
  read -r _ _ _ CAPACITY_FREE_INODES _ _ <<<"$inodes_row" || true
  if [[ -z "$inodes_row" || ! "$CAPACITY_FREE_INODES" =~ ^[0-9]+$ ]]; then
    fail 'invalid or empty free inode measurement'
  fi

  printf 'capacity phase=%s free_bytes=%s free_percent=%s free_inodes=%s\n' \
    "$phase" "$CAPACITY_FREE_BYTES" "$CAPACITY_FREE_PERCENT" "$CAPACITY_FREE_INODES"
}

check_hard_capacity() {
  measure_capacity pre-deploy
  if decimal_lt "$CAPACITY_FREE_BYTES" "$NAS_RELEASE_MIN_FREE_BYTES"; then
    fail "free bytes $CAPACITY_FREE_BYTES below hard threshold $NAS_RELEASE_MIN_FREE_BYTES"
  fi
  if decimal_lt "$CAPACITY_FREE_PERCENT" "$NAS_RELEASE_MIN_FREE_PERCENT"; then
    fail "free percent $CAPACITY_FREE_PERCENT below hard threshold $NAS_RELEASE_MIN_FREE_PERCENT"
  fi
  if decimal_lt "$CAPACITY_FREE_INODES" "$NAS_RELEASE_MIN_FREE_INODES"; then
    fail "free inodes $CAPACITY_FREE_INODES below hard threshold $NAS_RELEASE_MIN_FREE_INODES"
  fi
  printf 'hard capacity gate passed\n'
}

check_database() {
  local phase=$1
  local db_check_script last_error running check_status attempt
  db_check_script='if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_DB:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
  exit 14
fi
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 || exit 11
query_result=$(psql -X -qAt -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1") || exit 12
query_result=$(printf "%s" "$query_result" | tr -d "[:space:]")
[ "$query_result" = 1 ] || exit 13'
  last_error='no successful database readiness check'

  for ((attempt=1; attempt<=NAS_RELEASE_DB_ATTEMPTS; attempt++)); do
    running=''
    if ! running=$(docker inspect --format '{{.State.Running}}' "$NAS_RELEASE_DB_CONTAINER" 2>/dev/null); then
      last_error='container inspect failed'
    elif [[ "$running" != true ]]; then
      last_error='database container is not running'
    else
      check_status=0
      if docker exec "$NAS_RELEASE_DB_CONTAINER" sh -euc "$db_check_script" >/dev/null 2>&1; then
        printf 'database preflight passed: phase=%s container=%s attempts=%s\n' \
          "$phase" "$NAS_RELEASE_DB_CONTAINER" "$attempt"
        return 0
      else
        check_status=$?
        case "$check_status" in
          11) last_error='pg_isready failed' ;;
          12) last_error='SELECT 1 query failed' ;;
          13) last_error='SELECT 1 returned an unexpected result' ;;
          14) fail 'database preflight failed: container credentials are missing or empty' ;;
          *) last_error='container database check failed' ;;
        esac
      fi
    fi
    if (( attempt < NAS_RELEASE_DB_ATTEMPTS )); then
      sleep "$NAS_RELEASE_DB_DELAY_SECONDS"
    fi
  done
  fail "database preflight failed during $phase after $NAS_RELEASE_DB_ATTEMPTS attempt(s): $last_error"
}

inspect_service_state() {
  local output running restart config_image image_id extra
  output=''
  if ! output=$(docker inspect \
    --format '{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}' \
    "$NAS_RELEASE_SERVICE_CONTAINER" 2>/dev/null); then
    fail "cannot inspect service container $NAS_RELEASE_SERVICE_CONTAINER"
  fi
  if [[ "$output" == *$'\n'* ]]; then
    fail 'invalid service container state measurement'
  fi
  IFS='|' read -r running restart config_image image_id extra <<<"$output" || true
  if [[ -n "$extra" || "$running" != true || ! "$restart" =~ ^[0-9]+$ ||
        -z "$config_image" || ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    fail 'invalid or unhealthy service container state'
  fi
  SERVICE_RESTART_COUNT=$restart
  SERVICE_IMAGE_ID=$image_id
  printf '%s|%s|%s\n' "$config_image" "$image_id" "$restart"
}

check_service() {
  local phase=$1
  local candidate_restart='' last_error='no two consecutive healthy samples'
  local output running restart current_image image_id extra local_http_code site_http_code attempt

  for ((attempt=1; attempt<=NAS_RELEASE_SERVICE_ATTEMPTS; attempt++)); do
    output=''
    if ! output=$(docker inspect \
      --format '{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}' \
      "$NAS_RELEASE_SERVICE_CONTAINER" 2>/dev/null); then
      candidate_restart=''
      last_error='container inspect failed'
    elif [[ "$output" == *$'\n'* ]]; then
      candidate_restart=''
      last_error='invalid container state measurement'
    else
      IFS='|' read -r running restart current_image image_id extra <<<"$output" || true
      if [[ -n "$extra" || "$running" != true && "$running" != false ||
            ! "$restart" =~ ^[0-9]+$ || -z "$current_image" ||
            ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
        candidate_restart=''
        last_error='invalid container state measurement'
      elif [[ "$running" != true ]]; then
        candidate_restart=''
        last_error='container is not running'
      elif [[ "$current_image" != "$EXPECTED_IMAGE" ]]; then
        candidate_restart=''
        last_error="image mismatch: expected $EXPECTED_IMAGE, got $current_image"
      elif ! local_http_code=$(curl --fail --silent --show-error \
        --connect-timeout "$NAS_RELEASE_REQUEST_TIMEOUT_SECONDS" \
        --max-time "$NAS_RELEASE_REQUEST_TIMEOUT_SECONDS" --output /dev/null \
        --write-out '%{http_code}' --url "$NAS_RELEASE_LOCAL_URL"); then
        candidate_restart=''
        last_error='local service request failed'
      elif [[ ! "$local_http_code" =~ ^2[0-9][0-9]$ ]]; then
        candidate_restart=''
        last_error="local service returned HTTP $local_http_code"
      elif ! site_http_code=$(curl --fail --silent --show-error \
        --connect-timeout "$NAS_RELEASE_REQUEST_TIMEOUT_SECONDS" \
        --max-time "$NAS_RELEASE_REQUEST_TIMEOUT_SECONDS" --output /dev/null \
        --write-out '%{http_code}' --url "$NAS_RELEASE_SITE_URL"); then
        candidate_restart=''
        last_error='public site request failed'
      elif [[ ! "$site_http_code" =~ ^2[0-9][0-9]$ ]]; then
        candidate_restart=''
        last_error="public site returned HTTP $site_http_code"
      elif [[ -n "$candidate_restart" && "$candidate_restart" == "$restart" ]]; then
        SERVICE_RESTART_COUNT=$restart
        SERVICE_IMAGE_ID=$image_id
        printf 'service readiness passed: phase=%s container=%s image=%s restart=%s attempts=%s\n' \
          "$phase" "$NAS_RELEASE_SERVICE_CONTAINER" "$EXPECTED_IMAGE" "$restart" "$attempt"
        return 0
      else
        candidate_restart=$restart
        last_error='waiting for a second stable healthy sample'
      fi
    fi
    if (( attempt < NAS_RELEASE_SERVICE_ATTEMPTS )); then
      sleep "$NAS_RELEASE_SERVICE_DELAY_SECONDS"
    fi
  done
  fail "service readiness failed during $phase after $NAS_RELEASE_SERVICE_ATTEMPTS attempt(s): $last_error"
}

path_uid() {
  stat -c '%u' -- "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null
}

path_mode() {
  stat -c '%a' -- "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null
}

ensure_state_directory() {
  local owner mode
  if [[ -L "$NAS_RETENTION_STATE_DIR" ]]; then
    fail 'state directory must not be a symlink'
  fi
  if [[ ! -e "$NAS_RETENTION_STATE_DIR" ]]; then
    if ! mkdir -p -- "$NAS_RETENTION_STATE_DIR"; then
      fail "cannot create retention state directory $NAS_RETENTION_STATE_DIR"
    fi
    if ! chmod 0700 "$NAS_RETENTION_STATE_DIR"; then
      fail "cannot secure retention state directory $NAS_RETENTION_STATE_DIR"
    fi
  fi
  if [[ -L "$NAS_RETENTION_STATE_DIR" || ! -d "$NAS_RETENTION_STATE_DIR" ]]; then
    fail 'state directory must be a regular non-symlink directory'
  fi
  owner=$(path_uid "$NAS_RETENTION_STATE_DIR") || fail 'cannot read state directory owner'
  mode=$(path_mode "$NAS_RETENTION_STATE_DIR") || fail 'cannot read state directory permissions'
  if [[ "$owner" != "$(normalize_decimal "$NAS_RETENTION_OWNER_UID")" ]]; then
    fail "state directory owner UID $owner does not match $NAS_RETENTION_OWNER_UID"
  fi
  if [[ "$mode" != 700 ]]; then
    fail "state directory permissions must be 700, got $mode"
  fi
}

atomic_write_ledger() {
  local temporary entry owner mode
  local entries=("$@")
  if [[ -L "$LEDGER_PATH" ]]; then
    fail 'ledger must be a regular non-symlink file'
  fi
  temporary=$(mktemp "$NAS_RETENTION_STATE_DIR/.${NAS_RELEASE_SERVICE_CONTAINER}.successful-images.tmp.XXXXXX") ||
    fail 'cannot create temporary ledger'
  if ! chmod 0600 "$temporary"; then
    rm -f -- "$temporary"
    fail 'cannot secure temporary ledger'
  fi
  : >"$temporary"
  for entry in "${entries[@]+"${entries[@]}"}"; do
    if ! printf '%s\n' "$entry" >>"$temporary"; then
      rm -f -- "$temporary"
      fail 'cannot write temporary ledger'
    fi
  done
  owner=$(path_uid "$temporary") || {
    rm -f -- "$temporary"
    fail 'cannot read temporary ledger owner'
  }
  mode=$(path_mode "$temporary") || {
    rm -f -- "$temporary"
    fail 'cannot read temporary ledger permissions'
  }
  if [[ "$owner" != "$(normalize_decimal "$NAS_RETENTION_OWNER_UID")" || "$mode" != 600 ]]; then
    rm -f -- "$temporary"
    fail 'temporary ledger ownership or permissions are unsafe'
  fi
  if ! sync -f -- "$temporary"; then
    rm -f -- "$temporary"
    fail 'cannot fsync temporary ledger'
  fi
  if ! mv -f -- "$temporary" "$LEDGER_PATH"; then
    rm -f -- "$temporary"
    fail 'cannot atomically replace ledger'
  fi
  if ! sync -f -- "$NAS_RETENTION_STATE_DIR"; then
    fail 'cannot fsync retention state directory'
  fi
}

image_details() {
  local tag=$1
  local output image_id size_bytes extra
  output=''
  if ! output=$(docker image inspect --format '{{.Id}}|{{.Size}}' "$tag" 2>/dev/null); then
    return 1
  fi
  if [[ "$output" == *$'\n'* ]]; then
    return 1
  fi
  IFS='|' read -r image_id size_bytes extra <<<"$output" || true
  if [[ -n "$extra" || ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ||
        ! "$size_bytes" =~ ^[0-9]+$ ]]; then
    return 1
  fi
  printf '%s|%s\n' "$image_id" "$size_bytes"
}

require_local_and_recoverable() {
  local tag=$1
  local details
  if ! details=$(image_details "$tag"); then
    fail "successful image is missing or invalid locally: $tag"
  fi
  if ! docker manifest inspect "$tag" >/dev/null 2>&1; then
    fail "successful image is unavailable from registry: $tag"
  fi
  printf '%s\n' "$details"
}

load_ledger() {
  local entry existing
  LEDGER_ENTRIES=()
  while IFS= read -r entry || [[ -n "$entry" ]]; do
    if [[ -z "$entry" || ! "$entry" =~ ^${NAS_RELEASE_REPOSITORY}:sha-[0-9a-f]{40}$ ]]; then
      fail "malformed or foreign ledger entry: ${entry:-<empty>}"
    fi
    for existing in "${LEDGER_ENTRIES[@]+"${LEDGER_ENTRIES[@]}"}"; do
      if [[ "$existing" == "$entry" ]]; then
        fail "duplicate ledger entry: $entry"
      fi
    done
    LEDGER_ENTRIES+=("$entry")
  done <"$LEDGER_PATH"
  if (( ${#LEDGER_ENTRIES[@]} < 3 )); then
    fail 'ledger must contain at least three successful images'
  fi
}

validate_current_ledger_tail() {
  local count start index tag details image_id size_bytes current_state current_tag current_id current_restart
  count=${#LEDGER_ENTRIES[@]}
  start=$((count - 3))
  for ((index=start; index<count; index++)); do
    tag=${LEDGER_ENTRIES[$index]}
    details=$(require_local_and_recoverable "$tag")
    IFS='|' read -r image_id size_bytes <<<"$details"
  done
  current_state=$(inspect_service_state)
  IFS='|' read -r current_tag current_id current_restart <<<"$current_state"
  tag=${LEDGER_ENTRIES[$((count - 1))]}
  details=$(image_details "$tag") || fail "newest successful image is missing locally: $tag"
  IFS='|' read -r image_id size_bytes <<<"$details"
  if [[ "$current_tag" != "$tag" || "$current_id" != "$image_id" ]]; then
    fail 'running image must equal newest successful ledger entry'
  fi
  printf 'ledger validated: entries=%s running_image=%s image_id=%s restart=%s\n' \
    "$count" "$tag" "$image_id" "$current_restart"
}

validate_or_seed_ledger() {
  local owner mode seed details image_id size_bytes current_state current_tag current_id current_restart index
  ensure_state_directory
  if [[ -L "$LEDGER_PATH" ]]; then
    fail 'ledger must be a regular non-symlink file'
  fi
  if [[ ! -e "$LEDGER_PATH" ]]; then
    for seed in "$NAS_RETENTION_SEED_OLDEST" "$NAS_RETENTION_SEED_MIDDLE" "$NAS_RETENTION_SEED_NEWEST"; do
      details=$(require_local_and_recoverable "$seed")
      IFS='|' read -r image_id size_bytes <<<"$details"
    done
    current_state=$(inspect_service_state)
    IFS='|' read -r current_tag current_id current_restart <<<"$current_state"
    details=$(image_details "$NAS_RETENTION_SEED_NEWEST") ||
      fail 'newest bootstrap image is missing locally'
    IFS='|' read -r image_id size_bytes <<<"$details"
    if [[ "$current_tag" != "$NAS_RETENTION_SEED_NEWEST" || "$current_id" != "$image_id" ]]; then
      fail 'running image must equal newest successful ledger entry'
    fi
    atomic_write_ledger "$NAS_RETENTION_SEED_OLDEST" "$NAS_RETENTION_SEED_MIDDLE" "$NAS_RETENTION_SEED_NEWEST"
    printf 'ledger bootstrapped: path=%s entries=3\n' "$LEDGER_PATH"
  fi
  if [[ -L "$LEDGER_PATH" || ! -f "$LEDGER_PATH" ]]; then
    fail 'ledger must be a regular non-symlink file'
  fi
  owner=$(path_uid "$LEDGER_PATH") || fail 'cannot read ledger owner'
  mode=$(path_mode "$LEDGER_PATH") || fail 'cannot read ledger permissions'
  if [[ "$owner" != "$(normalize_decimal "$NAS_RETENTION_OWNER_UID")" ]]; then
    fail "ledger owner UID $owner does not match $NAS_RETENTION_OWNER_UID"
  fi
  if [[ "$mode" != 600 ]]; then
    fail "ledger permissions must be 600, got $mode"
  fi
  load_ledger
  for ((index=0; index<${#LEDGER_ENTRIES[@]}-1; index++)); do
    if [[ ${LEDGER_ENTRIES[$index]} == "$EXPECTED_IMAGE" ]]; then
      fail 'release image already appears before the newest ledger entry'
    fi
  done
  validate_current_ledger_tail
}

collect_container_ids() {
  local container_output container_id inspect_output image_id config_tag extra
  REFERENCED_IDS=()
  REFERENCED_TAGS=()
  container_output=''
  if ! container_output=$(docker ps -aq --no-trunc 2>&1); then
    fail "cannot inventory running and stopped containers: $container_output"
  fi
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    inspect_output=''
    if ! inspect_output=$(docker inspect --format '{{.Image}}|{{.Config.Image}}' "$container_id" 2>/dev/null); then
      fail "cannot inspect container image reference: $container_id"
    fi
    if [[ "$inspect_output" == *$'\n'* ]]; then
      fail "ambiguous container image reference: $container_id"
    fi
    IFS='|' read -r image_id config_tag extra <<<"$inspect_output" || true
    if [[ -n "$extra" || ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ || -z "$config_tag" ]]; then
      fail "invalid container image reference: $container_id"
    fi
    if ! array_contains "$image_id" "${REFERENCED_IDS[@]+"${REFERENCED_IDS[@]}"}"; then
      REFERENCED_IDS+=("$image_id")
    fi
    if ! array_contains "$config_tag" "${REFERENCED_TAGS[@]+"${REFERENCED_TAGS[@]}"}"; then
      REFERENCED_TAGS+=("$config_tag")
    fi
  done <<<"$container_output"
  printf 'container inventory recorded: referenced_ids=%s referenced_tags=%s\n' \
    "${#REFERENCED_IDS[@]}" "${#REFERENCED_TAGS[@]}"
}

append_successful_image() {
  local count
  load_ledger
  count=${#LEDGER_ENTRIES[@]}
  if [[ ${LEDGER_ENTRIES[$((count - 1))]} == "$EXPECTED_IMAGE" ]]; then
    printf 'successful image already newest in ledger: %s\n' "$EXPECTED_IMAGE"
    return 0
  fi
  LEDGER_ENTRIES+=("$EXPECTED_IMAGE")
  atomic_write_ledger "${LEDGER_ENTRIES[@]+"${LEDGER_ENTRIES[@]}"}"
  printf 'successful image recorded: %s\n' "$EXPECTED_IMAGE"
}

set_protected_images() {
  local count start index tag details image_id size_bytes
  load_ledger
  count=${#LEDGER_ENTRIES[@]}
  start=$((count - 3))
  PROTECTED_TAGS=()
  PROTECTED_TAG_IDS=()
  PROTECTED_IDS=()
  for ((index=start; index<count; index++)); do
    tag=${LEDGER_ENTRIES[$index]}
    details=$(require_local_and_recoverable "$tag")
    IFS='|' read -r image_id size_bytes <<<"$details"
    PROTECTED_TAGS+=("$tag")
    PROTECTED_TAG_IDS+=("$image_id")
    if ! array_contains "$image_id" "${PROTECTED_IDS[@]+"${PROTECTED_IDS[@]}"}"; then
      PROTECTED_IDS+=("$image_id")
    fi
  done
  printf 'protected successful images: tags=%s distinct_ids=%s\n' \
    "${#PROTECTED_TAGS[@]}" "${#PROTECTED_IDS[@]}"
}

select_candidates() {
  local inventory line image_repository image_tag extra full_tag details image_id size_bytes seen_tag
  local seen_tags=()
  CANDIDATE_TAGS=()
  CANDIDATE_IDS=()
  CANDIDATE_SIZES=()
  collect_container_ids
  inventory=''
  if ! inventory=$(docker image ls --no-trunc --format '{{.Repository}}|{{.Tag}}' "$NAS_RELEASE_REPOSITORY" 2>&1); then
    fail "cannot inventory local application images: $inventory"
  fi
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    IFS='|' read -r image_repository image_tag extra <<<"$line" || true
    if [[ -n "$extra" || "$image_repository" != "$NAS_RELEASE_REPOSITORY" ||
          ! "$image_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
      fail "ambiguous local application image entry: $line"
    fi
    full_tag="$image_repository:$image_tag"
    for seen_tag in "${seen_tags[@]+"${seen_tags[@]}"}"; do
      if [[ "$seen_tag" == "$full_tag" ]]; then
        fail "ambiguous local image tag $full_tag"
      fi
    done
    seen_tags+=("$full_tag")
    if ! details=$(image_details "$full_tag"); then
      fail "local application image is missing or invalid: $full_tag"
    fi
    IFS='|' read -r image_id size_bytes <<<"$details"
    if array_contains "$full_tag" "${PROTECTED_TAGS[@]+"${PROTECTED_TAGS[@]}"}" ||
       array_contains "$image_id" "${PROTECTED_IDS[@]+"${PROTECTED_IDS[@]}"}" ||
       array_contains "$full_tag" "${REFERENCED_TAGS[@]+"${REFERENCED_TAGS[@]}"}" ||
       array_contains "$image_id" "${REFERENCED_IDS[@]+"${REFERENCED_IDS[@]}"}"; then
      continue
    fi
    CANDIDATE_TAGS+=("$full_tag")
    CANDIDATE_IDS+=("$image_id")
    CANDIDATE_SIZES+=("$size_bytes")
  done <<<"$inventory"
}

verify_candidates() {
  local index tag expected_id expected_size details image_id size_bytes distinct_count=0
  local counted_ids=()
  CANDIDATE_TOTAL_BYTES=0
  collect_container_ids
  for ((index=0; index<${#CANDIDATE_TAGS[@]}; index++)); do
    tag=${CANDIDATE_TAGS[$index]}
    expected_id=${CANDIDATE_IDS[$index]}
    expected_size=${CANDIDATE_SIZES[$index]}
    if [[ ! "$tag" =~ ^${NAS_RELEASE_REPOSITORY}:sha-[0-9a-f]{40}$ ]]; then
      fail "invalid exact retention candidate: $tag"
    fi
    if ! details=$(image_details "$tag"); then
      fail "retention candidate disappeared locally: $tag"
    fi
    IFS='|' read -r image_id size_bytes <<<"$details"
    if [[ "$image_id" != "$expected_id" || "$size_bytes" != "$expected_size" ]]; then
      fail "retention candidate changed during verification: $tag"
    fi
    if array_contains "$tag" "${REFERENCED_TAGS[@]+"${REFERENCED_TAGS[@]}"}" ||
       array_contains "$image_id" "${REFERENCED_IDS[@]+"${REFERENCED_IDS[@]}"}"; then
      fail "retention candidate is referenced by a container: $tag"
    fi
    if ! docker manifest inspect "$tag" >/dev/null 2>&1; then
      fail "registry manifest unavailable for candidate $tag"
    fi
    if ! array_contains "$image_id" "${counted_ids[@]+"${counted_ids[@]}"}"; then
      counted_ids+=("$image_id")
      distinct_count=$((distinct_count + 1))
      CANDIDATE_TOTAL_BYTES=$((CANDIDATE_TOTAL_BYTES + size_bytes))
    fi
    printf 'retention_candidate=%s image_id=%s size_bytes=%s\n' "$tag" "$image_id" "$size_bytes"
  done
  printf 'retention_candidate_count=%s distinct_image_count=%s estimated_bytes=%s\n' \
    "${#CANDIDATE_TAGS[@]}" "$distinct_count" "$CANDIDATE_TOTAL_BYTES"
}

run_retention() {
  printf 'retention_mode=%s\n' "$NAS_RETENTION_MODE"
  if [[ "$NAS_RETENTION_MODE" == dry-run ]]; then
    printf 'retention dry-run completed with zero image removals\n'
    return 0
  fi
  if (( ${#CANDIDATE_TAGS[@]} == 0 )); then
    printf 'retention apply completed with zero candidates\n'
    return 0
  fi
  if ! docker image rm -- "${CANDIDATE_TAGS[@]+"${CANDIDATE_TAGS[@]}"}"; then
    fail 'exact retention image removal failed'
  fi
  printf 'retention apply completed: removed_tags=%s\n' "${#CANDIDATE_TAGS[@]}"
}

verify_protected_images() {
  local index tag expected_id details image_id size_bytes
  for ((index=0; index<${#PROTECTED_TAGS[@]}; index++)); do
    tag=${PROTECTED_TAGS[$index]}
    expected_id=${PROTECTED_TAG_IDS[$index]}
    if ! details=$(image_details "$tag"); then
      fail "protected image disappeared after retention: $tag"
    fi
    IFS='|' read -r image_id size_bytes <<<"$details"
    if [[ "$image_id" != "$expected_id" ]]; then
      fail "protected image ID changed after retention: $tag"
    fi
  done
  printf 'protected image verification passed\n'
}

check_fresh_logs() {
  local logs
  logs=''
  if ! logs=$(docker logs --since "$RELEASE_STARTED_AT" "$NAS_RELEASE_SERVICE_CONTAINER" 2>&1); then
    fail 'cannot read fresh application logs'
  fi
  if printf '%s\n' "$logs" | grep -Eiq \
    '(^|[^[:alnum:]_])(fatal|panic|out[[:space:]]+of[[:space:]]+memory|oom([_-]?killed)?|no[[:space:]]+space[[:space:]]+left[[:space:]]+on[[:space:]]+device|migration[[:space:]_-]+(failed|failure|error)|(failed|failure|error)[[:space:]_-]+migration)([^[:alnum:]_]|$)'; then
    fail 'fresh application logs contain a fatal pattern'
  fi
  printf 'fresh log check passed: since=%s\n' "$RELEASE_STARTED_AT"
}

compact_ledger() {
  if [[ "$NAS_RETENTION_MODE" != apply ]]; then
    return 0
  fi
  atomic_write_ledger "${PROTECTED_TAGS[@]+"${PROTECTED_TAGS[@]}"}"
  printf 'successful image ledger compacted: entries=%s\n' "${#PROTECTED_TAGS[@]}"
}

deploy_application() {
  if ! "$NAS_BACKEND_DEPLOY_SCRIPT" back "sha-${NAS_RELEASE_GIT_SHA}"; then
    fail 'backend deploy command failed'
  fi
  printf 'backend deploy command passed: service=back revision=sha-%s\n' "$NAS_RELEASE_GIT_SHA"
}

main() {
  local post_deploy_restart
  require_configuration
  acquire_release_lock
  RELEASE_STARTED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ') || fail 'cannot record release start time'
  check_hard_capacity
  validate_or_seed_ledger
  collect_container_ids
  check_database pre-deploy

  deploy_application
  check_database post-deploy
  check_service post-deploy
  post_deploy_restart=$SERVICE_RESTART_COUNT
  append_successful_image

  set_protected_images
  select_candidates
  verify_candidates
  run_retention

  verify_protected_images
  check_database post-retention
  check_service post-retention
  if [[ "$SERVICE_RESTART_COUNT" != "$post_deploy_restart" ]]; then
    fail "service restart count changed during retention: before=$post_deploy_restart after=$SERVICE_RESTART_COUNT"
  fi
  check_fresh_logs
  measure_capacity post-retention
  printf 'post-retention verification passed\n'
  compact_ledger

  if decimal_lt "$CAPACITY_FREE_BYTES" "$NAS_RETENTION_SOFT_MIN_FREE_BYTES"; then
    fail "free bytes $CAPACITY_FREE_BYTES below soft threshold $NAS_RETENTION_SOFT_MIN_FREE_BYTES after healthy post-checks"
  fi
  printf 'production release passed: image=%s retention_mode=%s\n' "$EXPECTED_IMAGE" "$NAS_RETENTION_MODE"
}

main "$@"
