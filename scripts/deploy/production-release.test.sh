#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RELEASE="$SCRIPT_DIR/production-release.sh"

REPOSITORY='ghcr.io/vsevolod-rusinskiy/newartspace-back'
LEDGER_NAME='back.successful-images'
SEED_1="$REPOSITORY:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d"
SEED_2="$REPOSITORY:sha-25f399f352b311462caf53e12baa230bc1049366"
SEED_3="$REPOSITORY:sha-492304ccfad8038d047e5228e989eedb3da04f38"
REVISION="$REPOSITORY:sha-dddddddddddddddddddddddddddddddddddddddd"
HISTORICAL="$REPOSITORY:sha-1111111111111111111111111111111111111111"
HISTORICAL_ALIAS="$REPOSITORY:sha-2222222222222222222222222222222222222222"

ID_SEED_1='sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
ID_SEED_2='sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
ID_SEED_3='sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
ID_REVISION='sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
ID_HISTORICAL='sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
ID_DATABASE='sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

if [[ ! -x "$RELEASE" ]]; then
  printf 'FAIL: %s does not exist or is not executable\n' "$RELEASE" >&2
  exit 1
fi

CASE_ROOT=
FAKE_BIN=
FIXTURE_DIR=
RUN_STATE_DIR=
BASH_ENV_FILE=
RUN_OUTPUT=
RUN_STATUS=
TEST_FILTER=${TEST_FILTER-}
TEST_COUNT=0

cleanup_case() {
  if [[ -n "$CASE_ROOT" && -d "$CASE_ROOT" ]]; then
    rm -rf "$CASE_ROOT"
  fi
  CASE_ROOT=
}
trap cleanup_case EXIT

fail_test() {
  printf 'FAIL %s: %s\n' "${CURRENT_TEST:-unknown test}" "$1" >&2
  if [[ -n "$RUN_OUTPUT" ]]; then
    printf '%s\n' "$RUN_OUTPUT" >&2
  fi
  exit 1
}

assert_status() {
  local expected=$1
  [[ "$RUN_STATUS" -eq "$expected" ]] || fail_test "expected status $expected, got $RUN_STATUS"
}

assert_contains() {
  local needle=$1
  [[ "$RUN_OUTPUT" == *"$needle"* ]] || fail_test "output does not contain: $needle"
}

assert_not_contains() {
  local needle=$1
  [[ "$RUN_OUTPUT" != *"$needle"* ]] || fail_test "output unexpectedly contains: $needle"
}

assert_log_contains() {
  local needle=$1
  grep -Fq -- "$needle" "$FIXTURE_DIR/commands.log" || fail_test "command log does not contain: $needle"
}

assert_log_absent() {
  local needle=$1
  if grep -Fq -- "$needle" "$FIXTURE_DIR/commands.log"; then
    fail_test "command log unexpectedly contains: $needle"
  fi
}

path_owner_for_test() {
  stat -c '%u' -- "$1" 2>/dev/null || stat -f '%u' -- "$1"
}

path_mode_for_test() {
  stat -c '%a' -- "$1" 2>/dev/null || stat -f '%Lp' -- "$1"
}

assert_ledger() {
  local expected_file="$CASE_ROOT/expected-ledger"
  : >"$expected_file"
  printf '%s\n' "$@" >"$expected_file"
  if ! cmp -s "$expected_file" "$RUN_STATE_DIR/$LEDGER_NAME"; then
    fail_test 'ledger bytes differ from the expected success history'
  fi
}

assert_front_container_healthy() {
  local row name running restart config_image image_id
  row=$(awk -F '\t' '$1 == "back" { print; exit }' "$FIXTURE_DIR/containers.tsv")
  [[ -n "$row" ]] || fail_test 'healthy backend container is missing'
  IFS=$'\t' read -r name running restart config_image image_id <<<"$row"
  [[ "$name" == back && "$running" == true && "$restart" =~ ^[0-9]+$ &&
        "$config_image" == "$REVISION" && "$image_id" == "$ID_REVISION" ]] || \
    fail_test "backend container is not healthy after failure: $row"
  local deploys
  deploys=$(grep -Fc 'backend-deploy|/var/www/newartspace/scripts/deploy.sh|back|sha-dddddddddddddddddddddddddddddddddddddddd' \
    "$FIXTURE_DIR/commands.log")
  [[ "$deploys" -eq 1 ]] || fail_test "backend deploy was delegated $deploys time(s)"
}

write_ledger() {
  printf '%s\n' "$@" >"$RUN_STATE_DIR/$LEDGER_NAME"
  chmod 600 "$RUN_STATE_DIR/$LEDGER_NAME"
}

append_image() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"$FIXTURE_DIR/images.tsv"
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" >>"$FIXTURE_DIR/registry.tsv"
}

append_container() {
  printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >>"$FIXTURE_DIR/containers.tsv"
}

install_fakes() {
  mkdir -p "$FAKE_BIN"

  cat >"$FAKE_BIN/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

fixture=${RELEASE_FIXTURE_DIR:?}
images="$fixture/images.tsv"
containers="$fixture/containers.tsv"
registry="$fixture/registry.tsv"
commands="$fixture/commands.log"
record() { printf 'docker|%s\n' "$*" >>"$commands"; }
record "$*"

find_image() {
  awk -F '\t' -v tag="$1" '$1 == tag { print $2 "|" $3 }' "$images"
}

find_registry_image() {
  awk -F '\t' -v tag="$1" '$1 == tag { print $2 "|" $3 }' "$registry"
}

case "${1-}" in
  logout)
    exit 0
    ;;
  pull)
    registry_row=$(find_registry_image "${2-}")
    [[ -n "$registry_row" && "$registry_row" != *$'\n'* ]] || exit 1
    if ! find_image "${2-}" | grep -q .; then
      printf '%s\t%s\t%s\n' "${2-}" "${registry_row%%|*}" "${registry_row#*|}" >>"$images"
    fi
    exit 0
    ;;
  rm)
    if [[ "${2-}" != -f || "${3-}" != back ]]; then exit 97; fi
    awk -F '\t' '$1 != "back"' "$containers" >"$containers.tmp"
    mv "$containers.tmp" "$containers"
    exit 0
    ;;
  run)
    expected_image=${!#}
    image_row=$(find_image "$expected_image")
    [[ -n "$image_row" && "$image_row" != *$'\n'* ]] || exit 1
    image_id=${image_row%%|*}
    if [[ "${RELEASE_RUN_IMAGE_ID_MODE:-exact}" == mismatch ]]; then
      image_id='sha256:9999999999999999999999999999999999999999999999999999999999999999'
    fi
    awk -F '\t' '$1 != "back"' "$containers" >"$containers.tmp"
    printf 'back\ttrue\t0\t%s\t%s\n' "$expected_image" "$image_id" >>"$containers.tmp"
    mv "$containers.tmp" "$containers"
    printf 'fixture-container-id\n'
    exit 0
    ;;
  ps)
    if [[ $# -eq 2 && "$2" == -aq ]]; then
      ps_count=$(grep -Fc 'docker|ps -aq' "$commands")
      if [[ "${RELEASE_PS_FAIL_AFTER_FIRST:-false}" == true && "$ps_count" -gt 1 ]]; then exit 1; fi
      awk -F '\t' '{ print $1 }' "$containers"
    elif [[ $# -eq 3 && "$2" == -f && "$3" == name=back ]]; then
      awk -F '\t' '$1 == "back" { print $1 }' "$containers"
    else
      exit 97
    fi
    exit 0
    ;;
  inspect)
    format=
    target=${!#}
    if [[ "${2-}" == --format ]]; then format=${3-}; fi
    row=$(awk -F '\t' -v target="$target" '$1 == target { print; exit }' "$containers")
    [[ -n "$row" ]] || exit 1
    IFS=$'\t' read -r name running restart config_image image_id <<<"$row"
    case "$format" in
      '{{.State.Running}}') printf '%s\n' "$running" ;;
      '{{.Config.Image}}') printf '%s\n' "$config_image" ;;
      '{{.Image}}') printf '%s\n' "$image_id" ;;
      '{{.Image}}|{{.Config.Image}}') printf '%s|%s\n' "$image_id" "$config_image" ;;
      '{{.State.Running}}|{{.Config.Image}}|{{.Image}}') printf '%s|%s|%s\n' "$running" "$config_image" "$image_id" ;;
      '{{.Name}}|{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}')
        printf '/%s|%s|%s|%s|%s\n' "$name" "$running" "$restart" "$config_image" "$image_id"
        ;;
      '{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}')
        service_inspect_count=$(grep -Fc 'docker|inspect --format {{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}} back' "$commands")
        observed_image_id=$image_id
        if [[ "${RELEASE_SERVICE_IMAGE_ID_MODE:-exact}" == mismatch ||
              "${RELEASE_SERVICE_IMAGE_ID_MODE:-exact}" == mismatch-second && "$service_inspect_count" -eq 2 ]]; then
          observed_image_id='sha256:8888888888888888888888888888888888888888888888888888888888888888'
        fi
        if [[ "${RELEASE_SERVICE_MODE:-healthy}" == failure && "$name" == back && "$config_image" == "${RELEASE_EXPECTED_IMAGE:?}" ]]; then
          printf 'false|%s|%s|%s\n' "$restart" "$config_image" "$observed_image_id"
        else
          printf '%s|%s|%s|%s\n' "$running" "$restart" "$config_image" "$observed_image_id"
        fi
        ;;
      *) exit 97 ;;
    esac
    exit 0
    ;;
  exec)
    exec_count=$(grep -Fc 'docker|exec database ' "$commands")
    if [[ "${2-}" != database || "${RELEASE_DB_MODE:-healthy}" == failure ||
          -n "${RELEASE_DB_FAIL_AT:-}" && "$exec_count" -ge "${RELEASE_DB_FAIL_AT}" ]]; then exit 12; fi
    exit 0
    ;;
  image)
    case "${2-}" in
      ls)
        [[ $# -eq 5 && "${3-}" == --format && "${4-}" == '{{.Repository}}:{{.Tag}}' && "${5-}" == "${RELEASE_IMAGE_REPOSITORY:?}" ]] || exit 97
        image_ls_count=$(grep -Fc 'docker|image ls --format {{.Repository}}:{{.Tag}} ' "$commands")
        if [[ "${RELEASE_IMAGE_LS_MODE:-healthy}" == failure ||
              "${RELEASE_IMAGE_LS_MODE:-healthy}" == failure-after-first && "$image_ls_count" -gt 1 ]]; then exit 1; fi
        if [[ "${RELEASE_IMAGE_LS_MODE:-healthy}" == malformed-after-first && "$image_ls_count" -gt 1 ]]; then
          printf 'ghcrXio/vsevolod-rusinskiy/newartspace-back:sha-9999999999999999999999999999999999999999\n'
          exit 0
        fi
        awk -F '\t' '{ print $1 }' "$images"
        ;;
      inspect)
        tag=${!#}
        row=$(find_image "$tag")
        [[ -n "$row" ]] || exit 1
        if [[ "${RELEASE_AMBIGUOUS_TAG:-}" == "$tag" ]]; then
          printf '%s\n%s\n' "$row" "$row"
        else
          printf '%s\n' "$row"
        fi
        ;;
      rm)
        [[ "${3-}" == -- ]] || exit 97
        shift 3
        printf '%s\n' "$*" >>"$fixture/removal-calls.log"
        if [[ "${RELEASE_RM_MODE:-success}" == no-op ]]; then
          exit 0
        fi
        if [[ "${RELEASE_RM_MODE:-success}" == interrupted || "${RELEASE_RM_MODE:-success}" == partial ]]; then
          first=${1-}
          awk -F '\t' -v tag="$first" '$1 != tag' "$images" >"$images.tmp"
          mv "$images.tmp" "$images"
          [[ "${RELEASE_RM_MODE:-success}" == partial ]] && exit 0
          exit 1
        fi
        for tag in "$@"; do
          awk -F '\t' -v candidate="$tag" '$1 != candidate' "$images" >"$images.tmp"
          mv "$images.tmp" "$images"
        done
        if [[ -n "${RELEASE_TAMPER_PROTECTED_TAG:-}" ]]; then
          awk -F '\t' -v OFS='\t' -v tag="$RELEASE_TAMPER_PROTECTED_TAG" \
            -v id='sha256:7777777777777777777777777777777777777777777777777777777777777777' \
            '$1 == tag {$2=id} {print}' "$images" >"$images.tmp"
          mv "$images.tmp" "$images"
        fi
        if [[ "${RELEASE_RESTART_AFTER_RM:-false}" == true ]]; then
          awk -F '\t' -v OFS='\t' '$1 == "back" {$3=$3+1} {print}' "$containers" >"$containers.tmp"
          mv "$containers.tmp" "$containers"
        fi
        ;;
      *) exit 97 ;;
    esac
    exit 0
    ;;
  manifest)
    [[ "${2-}" == inspect ]] || exit 97
    tag=${3-}
    if [[ "${RELEASE_REGISTRY_UNAVAILABLE_TAG:-}" == "$tag" ]]; then exit 1; fi
    awk -F '\t' -v tag="$tag" '$1 == tag { found=1 } END { exit !found }' "$registry"
    exit $?
    ;;
  logs)
    if [[ " $* " != *' --since '* ]]; then
      [[ "${RELEASE_LOG_MODE:-clean}" == old-fatal ]] && printf 'fatal: old release only\n'
      exit 0
    fi
    case "${RELEASE_LOG_MODE:-clean}" in
      fresh-fatal) printf 'FATAL: fresh release failed\n' ;;
      fresh-panic) printf 'panic: unexpected runtime state\n' ;;
      fresh-oom) printf 'kernel reported OOMKilled worker\n' ;;
      fresh-no-space) printf 'write failed: no-space condition\n' ;;
      fresh-migration-failure) printf 'database migration failure\n' ;;
      fresh-large-fatal)
        printf 'FATAL: early release failure\n'
        awk 'BEGIN { for (i=0; i<50000; i++) print "ordinary request completed" }'
        ;;
      benign) printf 'migration completed; fatality metric remains zero\n' ;;
      *) printf 'server ready\n' ;;
    esac
    exit 0
    ;;
esac

printf 'unexpected docker invocation: %s\n' "$*" >&2
exit 97
FAKE_DOCKER

  cat >"$FAKE_BIN/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail
printf 'curl|%s\n' "$*" >>"${RELEASE_FIXTURE_DIR:?}/commands.log"
curl_count=$(grep -Fc 'curl|' "${RELEASE_FIXTURE_DIR:?}/commands.log")
if [[ "${RELEASE_CURL_MODE:-healthy}" == failure ||
      -n "${RELEASE_CURL_FAIL_AFTER:-}" && "$curl_count" -gt "${RELEASE_CURL_FAIL_AFTER}" ]]; then exit 22; fi
printf '200'
FAKE_CURL

  cat >"$FAKE_BIN/df" <<'FAKE_DF'
#!/usr/bin/env bash
set -euo pipefail
fixture=${RELEASE_FIXTURE_DIR:?}
if [[ " $* " == *' -Pi '* ]]; then
  printf 'df-inodes\n' >>"$fixture/commands.log"
  printf '%s\n' 'Filesystem Inodes IUsed IFree IUse% Mounted on' \
    "/dev/mock 2000000 500000 ${RELEASE_FREE_INODES:-1500000} 25% /"
else
  count=$(wc -l <"$fixture/df-byte-calls")
  printf 'x\n' >>"$fixture/df-byte-calls"
  if [[ "$count" -eq 0 ]]; then bytes=${RELEASE_PRE_FREE_BYTES:-20000000000}; else bytes=${RELEASE_POST_FREE_BYTES:-20000000000}; fi
  printf 'df-bytes|%s\n' "$bytes" >>"$fixture/commands.log"
  printf '%s\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' \
    "/dev/mock 30000000000 10000000000 $bytes ${RELEASE_USED_PERCENT:-34}% /"
fi
FAKE_DF

  cat >"$FAKE_BIN/flock" <<'FAKE_FLOCK'
#!/usr/bin/env bash
set -euo pipefail
printf 'flock|%s\n' "$*" >>"${RELEASE_FIXTURE_DIR:?}/commands.log"
[[ "${RELEASE_LOCK_MODE:-available}" != contended ]]
FAKE_FLOCK

  cat >"$FAKE_BIN/sleep" <<'FAKE_SLEEP'
#!/usr/bin/env bash
set -euo pipefail
printf 'sleep|%s\n' "$*" >>"${RELEASE_FIXTURE_DIR:?}/commands.log"
FAKE_SLEEP

  cat >"$FAKE_BIN/sync" <<'FAKE_SYNC'
#!/usr/bin/env bash
set -euo pipefail
printf 'sync|%s\n' "$*" >>"${RELEASE_FIXTURE_DIR:?}/commands.log"
if [[ "${RELEASE_SYNC_MODE:-success}" == fail-file && "${1-}" == -f && -f "${2-}" ]]; then exit 1; fi
FAKE_SYNC

  cat >"$FAKE_BIN/mkdir" <<'FAKE_MKDIR'
#!/usr/bin/env bash
set -euo pipefail
printf 'mkdir|%s\n' "$*" >>"${RELEASE_FIXTURE_DIR:?}/commands.log"
[[ $# -eq 2 && "$1" == -- ]] || exit 97
/bin/mkdir "$@"
FAKE_MKDIR

  cat >"$FAKE_BIN/stat" <<'FAKE_STAT'
#!/usr/bin/env bash
set -euo pipefail
target=${!#}
if [[ "${2-}" == %u && "${RELEASE_STAT_WRONG_OWNER_PATH:-}" == "$target" ]]; then
  printf '999999\n'
  exit 0
fi
exec /usr/bin/stat "$@"
FAKE_STAT

  chmod +x "$FAKE_BIN/docker" "$FAKE_BIN/curl" "$FAKE_BIN/df" \
    "$FAKE_BIN/flock" "$FAKE_BIN/sleep" "$FAKE_BIN/sync" "$FAKE_BIN/mkdir" "$FAKE_BIN/stat"
}

setup_fixture() {
  cleanup_case
  CASE_ROOT=$(mktemp -d)
  FIXTURE_DIR="$CASE_ROOT/fixture"
  FAKE_BIN="$CASE_ROOT/bin"
  RUN_STATE_DIR="$CASE_ROOT/default-trusted-grandparent/newartspace/image-retention"
  BASH_ENV_FILE="$CASE_ROOT/bash-env"
  mkdir -p "$FIXTURE_DIR" "$RUN_STATE_DIR"
  chmod 755 "$CASE_ROOT/default-trusted-grandparent"
  chmod 700 "$CASE_ROOT/default-trusted-grandparent/newartspace" "$RUN_STATE_DIR"
  : >"$FIXTURE_DIR/commands.log"
  : >"$FIXTURE_DIR/removal-calls.log"
  : >"$FIXTURE_DIR/df-byte-calls"
  printf '%s\t%s\t100\n' "$SEED_1" "$ID_SEED_1" >"$FIXTURE_DIR/images.tsv"
  printf '%s\t%s\t110\n' "$SEED_2" "$ID_SEED_2" >>"$FIXTURE_DIR/images.tsv"
  printf '%s\t%s\t120\n' "$SEED_3" "$ID_SEED_3" >>"$FIXTURE_DIR/images.tsv"
  printf '%s\t%s\t200\n' "$HISTORICAL" "$ID_HISTORICAL" >>"$FIXTURE_DIR/images.tsv"
  printf 'back\ttrue\t0\t%s\t%s\n' "$SEED_3" "$ID_SEED_3" >"$FIXTURE_DIR/containers.tsv"
  printf 'database\ttrue\t0\tpostgres:16\t%s\n' "$ID_DATABASE" >>"$FIXTURE_DIR/containers.tsv"
  cp "$FIXTURE_DIR/images.tsv" "$FIXTURE_DIR/registry.tsv"
  printf '%s\t%s\t130\n' "$REVISION" "$ID_REVISION" >>"$FIXTURE_DIR/registry.tsv"
  cat >"$BASH_ENV_FILE" <<'FAKE_BACKEND_DEPLOY'
function /var/www/newartspace/scripts/deploy.sh {
  printf 'backend-deploy|%s|%s|%s\n' /var/www/newartspace/scripts/deploy.sh "${1-}" "${2-}" \
    >>"${RELEASE_FIXTURE_DIR:?}/commands.log"
  [[ "$#" -eq 2 && "$1" == back && "$2" == "${RELEASE_EXPECTED_IMAGE##*:}" ]] || return 64
  [[ "${RELEASE_DEPLOY_MODE:-success}" != failure ]] || return 42
  docker pull "$RELEASE_EXPECTED_IMAGE" || return
  local temporary deployed_image_id=$RELEASE_EXPECTED_IMAGE_ID
  if [[ "${RELEASE_RUN_IMAGE_ID_MODE:-exact}" == mismatch ]]; then
    deployed_image_id='sha256:7777777777777777777777777777777777777777777777777777777777777777'
  fi
  temporary=$(mktemp "${RELEASE_FIXTURE_DIR:?}/containers.tmp.XXXXXX") || return
  awk -F '\t' -v OFS='\t' -v tag="$RELEASE_EXPECTED_IMAGE" -v id="$deployed_image_id" \
    '$1 == "back" {$2="true"; $4=tag; $5=id} {print}' \
    "$RELEASE_FIXTURE_DIR/containers.tsv" >"$temporary" || return
  mv "$temporary" "$RELEASE_FIXTURE_DIR/containers.tsv"
}
FAKE_BACKEND_DEPLOY
  install_fakes
}

run_release() {
  local mode=${1:-dry-run}
  shift || true
  set +e
  RUN_OUTPUT=$(env \
    BASH_ENV="$BASH_ENV_FILE" \
    PATH="$FAKE_BIN:$PATH" \
    RELEASE_FIXTURE_DIR="$FIXTURE_DIR" \
    RELEASE_EXPECTED_IMAGE="$REVISION" \
    RELEASE_EXPECTED_IMAGE_ID="$ID_REVISION" \
    RELEASE_IMAGE_REPOSITORY="$REPOSITORY" \
    NAS_RETENTION_MODE="$mode" \
    NAS_RELEASE_LOCK_PATH="$CASE_ROOT/release.lock" \
    NAS_RELEASE_LOCK_WAIT_SECONDS=300 \
    NAS_RETENTION_STATE_DIR="$RUN_STATE_DIR" \
    NAS_RETENTION_OWNER_UID="$(id -u)" \
    NAS_RETENTION_LEDGER_NAME="$LEDGER_NAME" \
    NAS_IMAGE_REPOSITORY="$REPOSITORY" \
    NAS_DEPLOY_EXPECTED_IMAGE="$REVISION" \
    NAS_DEPLOY_SERVICE_CONTAINER=back \
    NAS_DEPLOY_DB_CONTAINER=database \
    NAS_DEPLOY_LOCAL_URL=http://127.0.0.1:3000/version \
    NAS_DEPLOY_SITE_URL=https://newartspace.ru/ \
    NAS_DEPLOY_MOUNTPOINT=/ \
    NAS_DEPLOY_MIN_FREE_BYTES=10737418240 \
    NAS_DEPLOY_MIN_FREE_PERCENT=10 \
    NAS_DEPLOY_MIN_FREE_INODES=1000000 \
    NAS_RETENTION_SOFT_MIN_FREE_BYTES=16106127360 \
    NAS_DEPLOY_DB_ATTEMPTS=3 \
    NAS_DEPLOY_DB_DELAY_SECONDS=0 \
    NAS_DEPLOY_SERVICE_ATTEMPTS=3 \
    NAS_DEPLOY_SERVICE_DELAY_SECONDS=0 \
    NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS=10 \
    NAS_RETENTION_SEED_1="$SEED_1" \
    NAS_RETENTION_SEED_2="$SEED_2" \
    NAS_RETENTION_SEED_3="$SEED_3" \
    NAS_BACKEND_DEPLOY_SCRIPT=/var/www/newartspace/scripts/deploy.sh \
    "$@" bash "$RELEASE" 2>&1)
  RUN_STATUS=$?
  set -e
}

test_bootstrap_requires_newest_running_seed() {
  setup_fixture
  awk -F '\t' -v OFS='\t' -v tag="$SEED_2" -v id="$ID_SEED_2" '$1 == "back" {$4=tag; $5=id} {print}' \
    "$FIXTURE_DIR/containers.tsv" >"$FIXTURE_DIR/containers.tmp"
  mv "$FIXTURE_DIR/containers.tmp" "$FIXTURE_DIR/containers.tsv"
  run_release dry-run
  assert_status 1
  assert_contains 'running image does not match newest seed'
  assert_log_absent 'docker|pull'

  setup_fixture
  run_release dry-run
  assert_status 0
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
}

test_records_pre_release_container_inventory() {
  setup_fixture
  run_release dry-run
  assert_status 0
  assert_contains "pre-release container: name=back running=true restart=0 tag=$SEED_3 id=$ID_SEED_3"
  assert_contains "pre-release container: name=database running=true restart=0 tag=postgres:16 id=$ID_DATABASE"
}

test_provisions_one_missing_state_parent() {
  setup_fixture
  local trusted_grandparent="$CASE_ROOT/missing-state-trusted-grandparent"
  mkdir "$trusted_grandparent"
  chmod 755 "$trusted_grandparent"
  RUN_STATE_DIR="$trusted_grandparent/newartspace/image-retention"

  run_release dry-run

  assert_status 0
  [[ -d "$trusted_grandparent/newartspace" && ! -L "$trusted_grandparent/newartspace" ]] || \
    fail_test 'missing retention state parent was not created as a real directory'
  [[ "$(path_mode_for_test "$trusted_grandparent/newartspace")" == 700 ]] || \
    fail_test 'created retention state parent mode is not 0700'
  [[ "$(path_owner_for_test "$trusted_grandparent/newartspace")" == "$(id -u)" ]] || \
    fail_test 'created retention state parent owner is wrong'
  [[ -d "$RUN_STATE_DIR" && ! -L "$RUN_STATE_DIR" ]] || \
    fail_test 'retention state directory was not created as a real directory'
  [[ "$(path_mode_for_test "$RUN_STATE_DIR")" == 700 ]] || \
    fail_test 'created retention state directory mode is not 0700'
  [[ "$(path_owner_for_test "$RUN_STATE_DIR")" == "$(id -u)" ]] || \
    fail_test 'created retention state directory owner is wrong'
  assert_log_contains "mkdir|-- $trusted_grandparent/newartspace"
  assert_log_contains "mkdir|-- $RUN_STATE_DIR"
  local mkdir_calls
  mkdir_calls=$(grep -Fc 'mkdir|' "$FIXTURE_DIR/commands.log")
  [[ "$mkdir_calls" -eq 2 ]] || fail_test "expected exactly two non-recursive mkdir calls, got $mkdir_calls"
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
}

test_rejects_malformed_or_deeper_state_paths() {
  local candidate kind
  for kind in trailing double dot dotdot root-parent; do
    setup_fixture
    case "$kind" in
      trailing) candidate="$CASE_ROOT/trailing/image-retention/" ;;
      double) candidate="$CASE_ROOT//double/image-retention" ;;
      dot) candidate="$CASE_ROOT/./image-retention" ;;
      dotdot) candidate="$CASE_ROOT/segment/../image-retention" ;;
      root-parent) candidate=/image-retention ;;
    esac
    RUN_STATE_DIR=$candidate
    run_release dry-run
    assert_status 1
    assert_contains 'retention state directory path must be absolute and normalized with a non-root parent'
    assert_log_absent 'docker|pull'
  done

  setup_fixture
  local trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  mkdir "$trusted_grandparent"
  RUN_STATE_DIR="$trusted_grandparent/missing/deeper/image-retention"
  run_release dry-run
  assert_status 1
  assert_contains 'retention state grandparent must be an existing regular non-symlink directory'
  assert_log_absent 'docker|pull'
}

test_rejects_unsafe_state_grandparent() {
  local trusted_grandparent target wrong_uid=0

  setup_fixture
  target="$CASE_ROOT/grandparent-target"
  mkdir "$target"
  trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  ln -s "$target" "$trusted_grandparent"
  RUN_STATE_DIR="$trusted_grandparent/newartspace/image-retention"
  run_release dry-run
  assert_status 1
  assert_contains 'retention state grandparent must be an existing regular non-symlink directory'
  assert_log_absent 'docker|pull'

  setup_fixture
  trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  printf 'not a directory\n' >"$trusted_grandparent"
  RUN_STATE_DIR="$trusted_grandparent/newartspace/image-retention"
  run_release dry-run
  assert_status 1
  assert_contains 'retention state grandparent must be an existing regular non-symlink directory'
  assert_log_absent 'docker|pull'

  setup_fixture
  trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  mkdir "$trusted_grandparent"
  RUN_STATE_DIR="$trusted_grandparent/newartspace/image-retention"
  if [[ "$(id -u)" -eq 0 ]]; then wrong_uid=1; fi
  run_release dry-run NAS_RETENTION_OWNER_UID="$wrong_uid"
  assert_status 1
  assert_contains "retention state grandparent owner must be UID $wrong_uid"
  assert_log_absent 'docker|pull'
}

test_rejects_unsafe_existing_state_parent_or_directory() {
  local trusted_grandparent parent target

  setup_fixture
  trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  target="$CASE_ROOT/parent-target"
  mkdir "$trusted_grandparent" "$target"
  parent="$trusted_grandparent/newartspace"
  ln -s "$target" "$parent"
  RUN_STATE_DIR="$parent/image-retention"
  run_release dry-run
  assert_status 1
  assert_contains 'retention state parent must be a regular non-symlink directory'
  assert_log_absent 'docker|pull'
  [[ ! -e "$target/image-retention" ]] || fail_test 'state directory was created through a symlink parent'

  setup_fixture
  trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  mkdir "$trusted_grandparent"
  parent="$trusted_grandparent/newartspace"
  printf 'not a directory\n' >"$parent"
  RUN_STATE_DIR="$parent/image-retention"
  run_release dry-run
  assert_status 1
  assert_contains 'retention state parent must be a regular non-symlink directory'
  assert_log_absent 'docker|pull'

  setup_fixture
  trusted_grandparent="$CASE_ROOT/trusted-grandparent"
  mkdir "$trusted_grandparent"
  parent="$trusted_grandparent/newartspace"
  mkdir "$parent"
  chmod 755 "$parent"
  RUN_STATE_DIR="$parent/image-retention"
  run_release dry-run
  assert_status 1
  assert_contains 'retention state parent permissions must be 0700'
  assert_log_absent 'docker|pull'

  setup_fixture
  chmod 755 "$RUN_STATE_DIR"
  run_release dry-run
  assert_status 1
  assert_contains 'state directory permissions must be 0700'
  assert_log_absent 'docker|pull'
}

test_rejects_wrong_owner_state_parent_or_directory() {
  local parent

  setup_fixture
  parent=${RUN_STATE_DIR%/*}
  run_release dry-run RELEASE_STAT_WRONG_OWNER_PATH="$parent"
  assert_status 1
  assert_contains "retention state parent owner must be UID $(id -u)"
  assert_log_absent 'docker|pull'

  setup_fixture
  run_release dry-run RELEASE_STAT_WRONG_OWNER_PATH="$RUN_STATE_DIR"
  assert_status 1
  assert_contains "state directory owner must be UID $(id -u)"
  assert_log_absent 'docker|pull'
}

test_rejects_stopped_matching_seed() {
  setup_fixture
  awk -F '\t' -v OFS='\t' '$1 == "back" {$2="false"} {print}' \
    "$FIXTURE_DIR/containers.tsv" >"$FIXTURE_DIR/containers.tmp"
  mv "$FIXTURE_DIR/containers.tmp" "$FIXTURE_DIR/containers.tsv"
  run_release dry-run
  assert_status 1
  assert_contains 'running service container is not running'
  assert_log_absent 'docker|pull'
}

test_rejects_running_seed_id_mismatch() {
  setup_fixture
  awk -F '\t' -v OFS='\t' -v id="$ID_SEED_2" '$1 == "back" {$5=id} {print}' \
    "$FIXTURE_DIR/containers.tsv" >"$FIXTURE_DIR/containers.tmp"
  mv "$FIXTURE_DIR/containers.tmp" "$FIXTURE_DIR/containers.tsv"
  run_release dry-run
  assert_status 1
  assert_contains 'running service image ID does not match newest ledger tag'
  assert_log_absent 'docker|pull'
}

test_readiness_requires_local_expected_id() {
  local mode
  for mode in mismatch mismatch-second; do
    setup_fixture
    write_ledger "$SEED_1" "$SEED_2" "$SEED_3"
    if [[ "$mode" == mismatch ]]; then
      run_release dry-run RELEASE_RUN_IMAGE_ID_MODE=mismatch
    else
      run_release dry-run RELEASE_SERVICE_IMAGE_ID_MODE=mismatch-second NAS_DEPLOY_SERVICE_ATTEMPTS=2
    fi
    assert_status 1
    assert_contains 'service image ID mismatch'
    assert_ledger "$SEED_1" "$SEED_2" "$SEED_3"
  done
}

test_rejects_literal_repository_near_match() {
  setup_fixture
  write_ledger \
    'ghcrXio/vsevolod-rusinskiy/newartspace-back:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d' \
    "$SEED_2" "$SEED_3"
  run_release dry-run
  assert_status 1
  assert_contains 'malformed ledger entry'
  assert_log_absent 'docker|pull'
}

test_rejects_symlink_ledger() {
  setup_fixture
  printf '%s\n' "$SEED_1" "$SEED_2" "$SEED_3" >"$CASE_ROOT/ledger-target"
  chmod 600 "$CASE_ROOT/ledger-target"
  ln -s "$CASE_ROOT/ledger-target" "$RUN_STATE_DIR/$LEDGER_NAME"
  run_release dry-run
  assert_status 1
  assert_contains 'ledger must be a regular non-symlink file'
  assert_log_absent 'docker|pull'
}

test_rejects_symlink_state_directory() {
  setup_fixture
  mv "$RUN_STATE_DIR" "$CASE_ROOT/real-state"
  ln -s "$CASE_ROOT/real-state" "$RUN_STATE_DIR"
  run_release dry-run
  assert_status 1
  assert_contains 'state directory must be a regular non-symlink directory'
  assert_log_absent 'docker|pull'
}

test_rejects_invalid_ledger_entries() {
  setup_fixture
  write_ledger "$SEED_1" not-a-tag "$SEED_3"
  run_release dry-run
  assert_status 1
  assert_contains 'malformed ledger entry'
  assert_log_absent 'docker|pull'

  setup_fixture
  write_ledger "$SEED_1" 'ghcr.io/example/foreign:sha-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' "$SEED_3"
  run_release dry-run
  assert_status 1
  assert_contains 'malformed ledger entry'
  assert_log_absent 'docker|pull'
}

test_rejects_trust_chain_owner_mismatch() {
  setup_fixture
  local wrong_uid=0
  if [[ "$(id -u)" -eq 0 ]]; then wrong_uid=1; fi
  run_release dry-run NAS_RETENTION_OWNER_UID="$wrong_uid"
  assert_status 1
  assert_contains 'retention state grandparent owner'
  assert_log_absent 'docker|pull'
}

test_rejects_weakened_fixed_configuration() {
  setup_fixture
  run_release dry-run NAS_RELEASE_LOCK_WAIT_SECONDS=299
  assert_status 1
  assert_contains 'fixed release lock wait is invalid'
  [[ ! -s "$FIXTURE_DIR/commands.log" ]] || fail_test 'changed lock wait reached an external command'

  setup_fixture
  run_release dry-run NAS_DEPLOY_MIN_FREE_BYTES=1
  assert_status 1
  assert_contains 'fixed hard free-byte threshold is invalid'
  [[ ! -s "$FIXTURE_DIR/commands.log" ]] || fail_test 'weakened threshold reached an external command'

  setup_fixture
  run_release dry-run \
    NAS_RETENTION_SEED_1="$REPOSITORY:sha-9999999999999999999999999999999999999999"
  assert_status 1
  assert_contains 'fixed backend seed set is invalid'
  [[ ! -s "$FIXTURE_DIR/commands.log" ]] || fail_test 'changed seed reached an external command'
}

test_failed_readiness_preserves_ledger() {
  setup_fixture
  write_ledger "$SEED_1" "$SEED_2" "$SEED_3"
  cp "$RUN_STATE_DIR/$LEDGER_NAME" "$CASE_ROOT/before-ledger"
  run_release dry-run RELEASE_SERVICE_MODE=failure
  assert_status 1
  assert_contains 'service readiness'
  cmp -s "$CASE_ROOT/before-ledger" "$RUN_STATE_DIR/$LEDGER_NAME" || \
    fail_test 'ledger changed before service readiness passed'
  assert_log_absent 'docker|image rm'
}

test_dry_run_records_revision_without_removal() {
  setup_fixture
  run_release dry-run
  assert_status 0
  assert_contains "retention candidate: tag=$HISTORICAL id=$ID_HISTORICAL size=200"
  assert_contains "retention candidate: tag=$SEED_1 id=$ID_SEED_1 size=100"
  assert_contains 'retention dry-run: candidates=2 candidate_bytes=300'
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
  local tag
  for tag in "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION" "$HISTORICAL"; do
    assert_log_contains "docker|manifest inspect $tag"
  done
  [[ ! -s "$FIXTURE_DIR/removal-calls.log" ]] || fail_test 'dry-run invoked image removal'
}

test_protects_three_successful_image_ids() {
  setup_fixture
  append_image "$REPOSITORY:sha-3333333333333333333333333333333333333333" "$ID_SEED_2" 110
  append_image "$REPOSITORY:sha-4444444444444444444444444444444444444444" "$ID_SEED_3" 120
  append_image "$REPOSITORY:sha-5555555555555555555555555555555555555555" "$ID_REVISION" 130
  run_release dry-run
  assert_status 0
  assert_not_contains 'sha-3333333333333333333333333333333333333333'
  assert_not_contains 'sha-4444444444444444444444444444444444444444'
  assert_not_contains 'sha-5555555555555555555555555555555555555555'
}

test_handles_duplicate_protected_image_ids() {
  setup_fixture
  awk -F '\t' -v OFS='\t' -v tag="$SEED_3" -v id="$ID_SEED_2" '$1 == tag {$2=id} {print}' \
    "$FIXTURE_DIR/images.tsv" >"$FIXTURE_DIR/images.tmp"
  mv "$FIXTURE_DIR/images.tmp" "$FIXTURE_DIR/images.tsv"
  awk -F '\t' -v OFS='\t' -v id="$ID_SEED_2" '$1 == "back" {$5=id} {print}' \
    "$FIXTURE_DIR/containers.tsv" >"$FIXTURE_DIR/containers.tmp"
  mv "$FIXTURE_DIR/containers.tmp" "$FIXTURE_DIR/containers.tsv"
  run_release dry-run
  assert_status 0
  assert_not_contains "retention candidate: tag=$SEED_2"
  assert_not_contains "retention candidate: tag=$SEED_3"
}

test_protects_stopped_container_image_id() {
  setup_fixture
  append_container old-back false 0 "$HISTORICAL" "$ID_HISTORICAL"
  run_release dry-run
  assert_status 0
  assert_not_contains "retention candidate: tag=$HISTORICAL"
  assert_contains "retention candidate: tag=$SEED_1"
}

test_rejects_registry_unavailable_candidate() {
  setup_fixture
  run_release dry-run RELEASE_REGISTRY_UNAVAILABLE_TAG="$HISTORICAL"
  assert_status 1
  assert_contains "registry manifest unavailable for $HISTORICAL"
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
  [[ ! -s "$FIXTURE_DIR/removal-calls.log" ]] || fail_test 'registry failure invoked image removal'
}

test_rejects_ambiguous_candidate_image() {
  setup_fixture
  run_release dry-run RELEASE_AMBIGUOUS_TAG="$HISTORICAL"
  assert_status 1
  assert_contains "ambiguous local image metadata for $HISTORICAL"
  [[ ! -s "$FIXTURE_DIR/removal-calls.log" ]] || fail_test 'ambiguous image invoked removal'
}

test_rejects_failed_retention_inventory() {
  setup_fixture
  run_release dry-run RELEASE_PS_FAIL_AFTER_FIRST=true
  assert_status 1
  assert_contains 'cannot list containers for retention inventory'
  [[ ! -s "$FIXTURE_DIR/removal-calls.log" ]] || fail_test 'failed container inventory invoked removal'

  setup_fixture
  run_release dry-run RELEASE_IMAGE_LS_MODE=failure
  assert_status 1
  assert_contains 'cannot list local repository images'
  [[ ! -s "$FIXTURE_DIR/removal-calls.log" ]] || fail_test 'failed image inventory invoked removal'
}

test_apply_removes_once_and_compacts_ledger() {
  setup_fixture
  run_release apply
  assert_status 0
  local calls
  calls=$(wc -l <"$FIXTURE_DIR/removal-calls.log" | tr -d ' ')
  [[ "$calls" -eq 1 ]] || fail_test "expected one image removal call, got $calls"
  grep -Fxq -- "$HISTORICAL $SEED_1" "$FIXTURE_DIR/removal-calls.log" || \
    fail_test 'apply removal allowlist was not exact and deterministic'
  assert_ledger "$SEED_2" "$SEED_3" "$REVISION"
}

test_duplicate_image_ids_are_sized_once() {
  setup_fixture
  append_image "$HISTORICAL_ALIAS" "$ID_HISTORICAL" 200
  run_release dry-run
  assert_status 0
  assert_contains 'retention dry-run: candidates=3 candidate_bytes=300'
}

test_no_candidate_success() {
  setup_fixture
  append_container old-back false 0 "$HISTORICAL" "$ID_HISTORICAL"
  append_container rollback-back false 0 "$SEED_1" "$ID_SEED_1"
  run_release apply
  assert_status 0
  assert_contains 'retention apply: candidates=0 candidate_bytes=0'
  [[ ! -s "$FIXTURE_DIR/removal-calls.log" ]] || fail_test 'no-candidate run invoked image removal'
  assert_ledger "$SEED_2" "$SEED_3" "$REVISION"
}

test_interrupted_cleanup_keeps_uncompacted_ledger() {
  setup_fixture
  run_release apply RELEASE_RM_MODE=interrupted
  assert_status 1
  assert_contains 'image removal failed'
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
}

test_lock_contention_precedes_pull() {
  setup_fixture
  run_release dry-run RELEASE_LOCK_MODE=contended
  assert_status 1
  assert_contains 'release lock timeout'
  assert_log_absent 'docker|pull'
}

test_hard_capacity_failure_precedes_pull() {
  setup_fixture
  run_release dry-run RELEASE_PRE_FREE_BYTES=10737418239
  assert_status 1
  assert_contains 'free bytes 10737418239 below hard threshold 10737418240'
  assert_log_absent 'docker|pull'

  setup_fixture
  run_release dry-run RELEASE_USED_PERCENT=91
  assert_status 1
  assert_contains 'free percent 9 below hard threshold 10'
  assert_log_absent 'docker|pull'

  setup_fixture
  run_release dry-run RELEASE_FREE_INODES=999999
  assert_status 1
  assert_contains 'free inodes 999999 below hard threshold 1000000'
  assert_log_absent 'docker|pull'
}

test_soft_threshold_is_reported_after_postchecks() {
  setup_fixture
  run_release dry-run RELEASE_POST_FREE_BYTES=15000000000 RELEASE_LOG_MODE=benign
  assert_status 1
  assert_contains 'free bytes 15000000000 below soft threshold 16106127360'
  assert_log_contains 'docker|logs --since'
  local db_checks service_checks
  db_checks=$(grep -Fc 'docker|exec database ' "$FIXTURE_DIR/commands.log")
  service_checks=$(grep -Fc 'docker|inspect --format {{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}} back' "$FIXTURE_DIR/commands.log")
  [[ "$db_checks" -ge 3 && "$service_checks" -ge 4 ]] || \
    fail_test 'soft threshold was reported before post-retention health checks'
}

test_logs_are_scoped_to_release_start() {
  setup_fixture
  run_release dry-run RELEASE_LOG_MODE=old-fatal
  assert_status 0
  assert_log_contains 'docker|logs --since'
  assert_not_contains 'fatal: old release only'
}

test_large_fresh_logs_keep_early_fatal_signal() {
  setup_fixture
  run_release dry-run RELEASE_LOG_MODE=fresh-large-fatal
  assert_status 1
  assert_contains 'fresh application logs contain a fatal pattern'
}

test_protected_tag_mapping_is_immutable() {
  setup_fixture
  run_release apply RELEASE_TAMPER_PROTECTED_TAG="$SEED_2"
  assert_status 1
  assert_contains "protected image ID changed for $SEED_2"
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
  assert_front_container_healthy
}

test_restart_count_must_match_deployed_sample() {
  setup_fixture
  run_release apply RELEASE_RESTART_AFTER_RM=true
  assert_status 1
  assert_contains 'restart count changed after retention'
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
  assert_front_container_healthy
}

test_successful_incomplete_removal_keeps_extended_ledger() {
  local mode
  for mode in no-op partial; do
    setup_fixture
    run_release apply RELEASE_RM_MODE="$mode"
    assert_status 1
    assert_contains 'deleted candidate remains locally tagged'
    assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
    assert_front_container_healthy
  done
}

test_post_delete_repository_inventory_failure_keeps_extended_ledger() {
  local mode expected_message
  for mode in failure-after-first malformed-after-first; do
    setup_fixture
    if [[ "$mode" == failure-after-first ]]; then
      expected_message='cannot list post-retention local repository images'
    else
      expected_message='invalid post-retention repository tag'
    fi
    run_release apply RELEASE_IMAGE_LS_MODE="$mode"
    assert_status 1
    assert_contains "$expected_message"
    assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
    assert_front_container_healthy
    local image_ls_calls
    image_ls_calls=$(grep -Fc 'docker|image ls --format {{.Repository}}:{{.Tag}} ' "$FIXTURE_DIR/commands.log")
    [[ "$image_ls_calls" -eq 2 ]] || fail_test "expected exactly two repository inventory calls, got $image_ls_calls"
  done
}

test_rejects_permissive_ledger_before_pull() {
  setup_fixture
  write_ledger "$SEED_1" "$SEED_2" "$SEED_3"
  chmod 644 "$RUN_STATE_DIR/$LEDGER_NAME"
  run_release dry-run
  assert_status 1
  assert_contains 'ledger permissions must be 0600'
  assert_log_absent 'docker|pull'
}

test_sync_failure_preserves_old_ledger_bytes() {
  setup_fixture
  write_ledger "$SEED_1" "$SEED_2" "$SEED_3"
  cp "$RUN_STATE_DIR/$LEDGER_NAME" "$CASE_ROOT/original-ledger"
  run_release dry-run RELEASE_SYNC_MODE=fail-file
  assert_status 1
  assert_contains 'cannot fsync atomic ledger file'
  cmp -s "$CASE_ROOT/original-ledger" "$RUN_STATE_DIR/$LEDGER_NAME" || \
    fail_test 'pre-rename failure changed old ledger bytes'
}

assert_apply_postcheck_failure() {
  assert_status 1
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
  assert_front_container_healthy
}

test_apply_database_postcheck_failure_does_not_compact_or_rollback() {
  setup_fixture
  run_release apply RELEASE_DB_FAIL_AT=3
  assert_contains 'database readiness'
  assert_apply_postcheck_failure
}

test_apply_http_postcheck_failure_does_not_compact_or_rollback() {
  setup_fixture
  run_release apply RELEASE_CURL_FAIL_AFTER=4
  assert_contains 'service readiness'
  assert_apply_postcheck_failure
}

test_apply_restart_postcheck_failure_does_not_compact_or_rollback() {
  setup_fixture
  run_release apply RELEASE_RESTART_AFTER_RM=true
  assert_contains 'restart count changed after retention'
  assert_apply_postcheck_failure
}

test_apply_image_postcheck_failure_does_not_compact_or_rollback() {
  setup_fixture
  run_release apply RELEASE_TAMPER_PROTECTED_TAG="$SEED_2"
  assert_contains 'protected image ID changed'
  assert_apply_postcheck_failure
}

test_apply_log_postcheck_failure_does_not_compact_or_rollback() {
  setup_fixture
  run_release apply RELEASE_LOG_MODE=fresh-fatal
  assert_contains 'fresh application logs contain a fatal pattern'
  assert_apply_postcheck_failure
}

test_fresh_fatal_logs_fail() {
  local mode
  for mode in fresh-fatal fresh-panic fresh-oom fresh-no-space fresh-migration-failure; do
    setup_fixture
    run_release dry-run RELEASE_LOG_MODE="$mode"
    assert_status 1
    assert_contains 'fresh application logs contain a fatal pattern'
  done
}

test_benign_log_words_do_not_fail() {
  setup_fixture
  run_release dry-run RELEASE_LOG_MODE=benign
  assert_status 0
}

test_backend_deploy_failure_is_replayable() {
  setup_fixture
  write_ledger "$SEED_1" "$SEED_2" "$SEED_3"
  run_release dry-run RELEASE_DEPLOY_MODE=failure
  assert_status 1
  assert_contains 'backend deploy command failed'
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3"
  assert_log_contains 'backend-deploy|/var/www/newartspace/scripts/deploy.sh|back|sha-dddddddddddddddddddddddddddddddddddddddd'
  assert_log_absent 'docker|image rm'

  run_release dry-run
  assert_status 0
  assert_ledger "$SEED_1" "$SEED_2" "$SEED_3" "$REVISION"
}

test_backend_deploy_receives_exact_argv() {
  setup_fixture
  run_release dry-run
  assert_status 0
  local calls
  calls=$(grep -Fxc 'backend-deploy|/var/www/newartspace/scripts/deploy.sh|back|sha-dddddddddddddddddddddddddddddddddddddddd' \
    "$FIXTURE_DIR/commands.log")
  [[ "$calls" -eq 1 ]] || fail_test "expected one exact backend deploy delegation, got $calls"
}

run_test() {
  CURRENT_TEST=$1
  if [[ -n "$TEST_FILTER" && "$CURRENT_TEST" != *"$TEST_FILTER"* ]]; then return 0; fi
  "$2"
  TEST_COUNT=$((TEST_COUNT + 1))
  printf 'ok - %s\n' "$CURRENT_TEST"
}

run_test 'bootstraps only when the running image equals the newest seed' test_bootstrap_requires_newest_running_seed
run_test 'records pre-release container tags, full image IDs, and restart counts' test_records_pre_release_container_inventory
run_test 'provisions exactly one missing retention state parent from a trusted grandparent' test_provisions_one_missing_state_parent
run_test 'rejects malformed or deeper-missing retention state paths before pull' test_rejects_malformed_or_deeper_state_paths
run_test 'rejects a symlink, non-directory, or wrong-owner retention state grandparent' test_rejects_unsafe_state_grandparent
run_test 'rejects an unsafe existing retention state parent or state directory' test_rejects_unsafe_existing_state_parent_or_directory
run_test 'rejects a wrong-owner retention state parent or state directory' test_rejects_wrong_owner_state_parent_or_directory
run_test 'rejects a stopped back container even when Config.Image matches the newest seed' test_rejects_stopped_matching_seed
run_test 'rejects a running Config.Image whose immutable image ID mismatches the seed tag' test_rejects_running_seed_id_mismatch
run_test 'requires the expected local image ID in both readiness samples' test_readiness_requires_local_expected_id
run_test 'rejects a ghcrXio near-match as a literal foreign repository' test_rejects_literal_repository_near_match
run_test 'rejects a symlink ledger before docker pull' test_rejects_symlink_ledger
run_test 'rejects a symlink state directory before docker pull' test_rejects_symlink_state_directory
run_test 'rejects malformed and foreign-repository ledger entries' test_rejects_invalid_ledger_entries
run_test 'rejects a retention state trust-chain owner mismatch before docker pull' test_rejects_trust_chain_owner_mismatch
run_test 'rejects weakened fixed thresholds and changed seed tags' test_rejects_weakened_fixed_configuration
run_test 'leaves the ledger unchanged when service readiness fails' test_failed_readiness_preserves_ledger
run_test 'dry-run records a healthy revision but performs zero image removals' test_dry_run_records_revision_without_removal
run_test 'protects active plus two previous successful image IDs' test_protects_three_successful_image_ids
run_test 'handles two protected tags sharing one full image ID' test_handles_duplicate_protected_image_ids
run_test 'protects an image ID referenced by a stopped container' test_protects_stopped_container_image_id
run_test 'rejects a candidate unavailable from the registry' test_rejects_registry_unavailable_candidate
run_test 'rejects an ambiguous local candidate' test_rejects_ambiguous_candidate_image
run_test 'fails closed when retention inventory commands fail' test_rejects_failed_retention_inventory
run_test 'apply performs one exact removal call and compacts the ledger' test_apply_removes_once_and_compacts_ledger
run_test 'deduplicates candidate image IDs before the size sum' test_duplicate_image_ids_are_sized_once
run_test 'succeeds without calling image removal when there are no candidates' test_no_candidate_success
run_test 'keeps the extended ledger when cleanup is interrupted' test_interrupted_cleanup_keeps_uncompacted_ledger
run_test 'rejects lock contention before docker pull' test_lock_contention_precedes_pull
run_test 'rejects a hard capacity failure before docker pull' test_hard_capacity_failure_precedes_pull
run_test 'reports the soft threshold only after healthy post-checks' test_soft_threshold_is_reported_after_postchecks
run_test 'scans only logs emitted since this release started' test_logs_are_scoped_to_release_start
run_test 'detects an early FATAL in fresh logs larger than the pipe buffer' test_large_fresh_logs_keep_early_fatal_signal
run_test 'preserves every protected exact tag to full image ID mapping' test_protected_tag_mapping_is_immutable
run_test 'requires the post-retention restart count to equal the deployed sample' test_restart_count_must_match_deployed_sample
run_test 'rejects successful no-op and partial image removal without compacting' test_successful_incomplete_removal_keeps_extended_ledger
run_test 'rejects failed or malformed post-delete repository inventory without compacting' test_post_delete_repository_inventory_failure_keeps_extended_ledger
run_test 'rejects an existing 0644 ledger before docker pull' test_rejects_permissive_ledger_before_pull
run_test 'preserves old ledger bytes when pre-rename fsync fails' test_sync_failure_preserves_old_ledger_bytes
run_test 'keeps the healthy container and extended ledger after an apply database postcheck failure' test_apply_database_postcheck_failure_does_not_compact_or_rollback
run_test 'keeps the healthy container and extended ledger after an apply HTTP postcheck failure' test_apply_http_postcheck_failure_does_not_compact_or_rollback
run_test 'keeps the healthy container and extended ledger after an apply restart postcheck failure' test_apply_restart_postcheck_failure_does_not_compact_or_rollback
run_test 'keeps the healthy container and extended ledger after an apply image postcheck failure' test_apply_image_postcheck_failure_does_not_compact_or_rollback
run_test 'keeps the healthy container and extended ledger after an apply log postcheck failure' test_apply_log_postcheck_failure_does_not_compact_or_rollback
run_test 'rejects fresh fatal, panic, OOM, no-space, and migration-failure logs' test_fresh_fatal_logs_fail
run_test 'does not reject benign words that resemble fatal patterns' test_benign_log_words_do_not_fail
run_test 'a failed backend deploy preserves state and succeeds on replay' test_backend_deploy_failure_is_replayable
run_test 'delegates backend deploy with the exact back and sha revision argv' test_backend_deploy_receives_exact_argv

cleanup_case
(( TEST_COUNT > 0 )) || fail_test "no tests matched filter: $TEST_FILTER"
printf 'production release tests passed: %s case(s)\n' "$TEST_COUNT"
