#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
release_script="$script_dir/production-release.sh"

if [[ ! -f "$release_script" ]]; then
  printf 'production release tests failed: missing production script %s\n' "$release_script" >&2
  exit 1
fi

repository='ghcr.io/vsevolod-rusinskiy/newartspace-back'
seed_oldest="$repository:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d"
seed_middle="$repository:sha-25f399f352b311462caf53e12baa230bc1049366"
seed_newest="$repository:sha-492304ccfad8038d047e5228e989eedb3da04f38"
release_sha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
release_tag="$repository:sha-$release_sha"
historical_tag="$repository:sha-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
stopped_tag="$repository:sha-cccccccccccccccccccccccccccccccccccccccc"
duplicate_tag="$repository:sha-dddddddddddddddddddddddddddddddddddddddd"
current_tag="$repository:sha-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

seed_oldest_id="sha256:$(printf '1%.0s' {1..64})"
seed_middle_id="sha256:$(printf '2%.0s' {1..64})"
seed_newest_id="sha256:$(printf '3%.0s' {1..64})"
release_id="sha256:$(printf 'a%.0s' {1..64})"
historical_id="sha256:$(printf 'b%.0s' {1..64})"
stopped_id="sha256:$(printf 'c%.0s' {1..64})"
other_id="sha256:$(printf 'd%.0s' {1..64})"
current_id="sha256:$(printf 'e%.0s' {1..64})"
database_id="sha256:$(printf 'f%.0s' {1..64})"

case_dir=''
fake_state=''
fake_bin=''
retention_dir=''
ledger=''
lock_path=''
deploy_fixture=''
last_output=''
last_status=0
retention_owner_uid=''
failures=0
tests_run=0

cleanup_case() {
  if [[ -n "$case_dir" && -d "$case_dir" ]]; then
    rm -rf -- "$case_dir"
  fi
  case_dir=''
}

trap cleanup_case EXIT

write_fake_docker() {
  cat >"$fake_bin/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
set -euo pipefail
state=${NAS_TEST_STATE:?}

log_command() {
  printf 'docker' >>"$state/commands"
  local argument
  for argument in "$@"; do
    printf '|%s' "$argument" >>"$state/commands"
  done
  printf '\n' >>"$state/commands"
}

find_container() {
  awk -F '|' -v target="$1" '$1 == target || $2 == target { print; exit }' "$state/containers"
}

log_command "$@"
command_name=${1-}
shift || true

case "$command_name" in
  inspect)
    [[ ${1-} == --format ]] || exit 64
    format=$2
    target=$3
    row=$(find_container "$target")
    [[ -n "$row" ]] || exit 1
    IFS='|' read -r container_id name running restart config_image image_id <<<"$row"
    case "$format" in
      '{{.State.Running}}') printf '%s\n' "$running" ;;
      '{{.State.Running}}|{{.RestartCount}}|{{.Config.Image}}|{{.Image}}')
        printf '%s|%s|%s|%s\n' "$running" "$restart" "$config_image" "$image_id"
        ;;
      '{{.Image}}|{{.Config.Image}}') printf '%s|%s\n' "$image_id" "$config_image" ;;
      *) exit 64 ;;
    esac
    ;;
  exec)
    if [[ $(cat "$state/db_ready") == 1 ]]; then
      exit 0
    fi
    exit 12
    ;;
  ps)
    awk -F '|' '{ print $1 }' "$state/containers"
    ;;
  image)
    image_command=${1-}
    shift || true
    case "$image_command" in
      ls)
        requested_repository=${@: -1}
        while IFS='|' read -r full_tag image_id size_bytes; do
          [[ -n "$full_tag" ]] || continue
          image_repository=${full_tag%:*}
          image_tag=${full_tag##*:}
          if [[ "$image_repository" == "$requested_repository" ]]; then
            printf '%s|%s\n' "$image_repository" "$image_tag"
          fi
        done <"$state/images"
        ;;
      inspect)
        [[ ${1-} == --format ]] || exit 64
        format=$2
        target=$3
        row=$(awk -F '|' -v target="$target" '$1 == target { print; exit }' "$state/images")
        [[ -n "$row" ]] || exit 1
        IFS='|' read -r full_tag image_id size_bytes <<<"$row"
        [[ "$format" == '{{.Id}}|{{.Size}}' ]] || exit 64
        printf '%s|%s\n' "$image_id" "$size_bytes"
        ;;
      rm)
        calls=0
        [[ ! -f "$state/rm_calls" ]] || calls=$(cat "$state/rm_calls")
        printf '%s\n' "$((calls + 1))" >"$state/rm_calls"
        [[ ${1-} == -- ]] || exit 64
        shift
        for target in "$@"; do
          temporary=$(mktemp "$state/images.tmp.XXXXXX")
          awk -F '|' -v target="$target" '$1 != target' "$state/images" >"$temporary"
          mv -- "$temporary" "$state/images"
        done
        ;;
      *) exit 64 ;;
    esac
    ;;
  manifest)
    [[ ${1-} == inspect ]] || exit 64
    grep -Fqx -- "$2" "$state/registry"
    ;;
  logs)
    cat "$state/fresh_logs"
    ;;
  *) exit 64 ;;
esac
FAKE_DOCKER
}

write_fake_commands() {
  cat >"$fake_bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
set -euo pipefail
state=${NAS_TEST_STATE:?}
printf 'curl' >>"$state/commands"
for argument in "$@"; do printf '|%s' "$argument" >>"$state/commands"; done
printf '\n' >>"$state/commands"
[[ $(cat "$state/http_ready") == 1 ]] || exit 22
printf '200'
FAKE_CURL

  cat >"$fake_bin/df" <<'FAKE_DF'
#!/usr/bin/env bash
set -euo pipefail
state=${NAS_TEST_STATE:?}
read -r free_bytes used_percent free_inodes <"$state/capacity"
case " $* " in
  *' -Pi '*)
    printf 'Filesystem Inodes IUsed IFree IUse%% Mounted on\n'
    printf 'fakefs 9000000 1 %s 1%% /\n' "$free_inodes"
    ;;
  *)
    printf 'Filesystem 1-blocks Used Available Capacity Mounted on\n'
    printf 'fakefs 99999999999 1 %s %s%% /\n' "$free_bytes" "$used_percent"
    ;;
esac
FAKE_DF

  cat >"$fake_bin/flock" <<'FAKE_FLOCK'
#!/usr/bin/env bash
set -euo pipefail
state=${NAS_TEST_STATE:?}
printf 'flock' >>"$state/commands"
for argument in "$@"; do printf '|%s' "$argument" >>"$state/commands"; done
printf '\n' >>"$state/commands"
[[ $(cat "$state/lock_busy") == 0 ]]
FAKE_FLOCK

  cat >"$fake_bin/sleep" <<'FAKE_SLEEP'
#!/usr/bin/env bash
exit 0
FAKE_SLEEP

  cat >"$fake_bin/sync" <<'FAKE_SYNC'
#!/usr/bin/env bash
set -euo pipefail
state=${NAS_TEST_STATE:?}
printf 'sync' >>"$state/commands"
for argument in "$@"; do printf '|%s' "$argument" >>"$state/commands"; done
printf '\n' >>"$state/commands"
FAKE_SYNC

  cat >"$deploy_fixture" <<'FAKE_DEPLOY'
#!/usr/bin/env bash
set -euo pipefail
state=${NAS_TEST_STATE:?}
printf 'backend-deploy|%s|%s\n' "${1-}" "${2-}" >>"$state/commands"
[[ ${1-} == back ]] || exit 64
[[ ${2-} == "sha-${NAS_TEST_RELEASE_SHA:?}" ]] || exit 64
if [[ -f "$state/deploy_fail" ]]; then
  exit 42
fi

release_tag="${NAS_TEST_REPOSITORY:?}:${2}"
printf 'host-docker-pull|%s\n' "$release_tag" >>"$state/commands"
if ! awk -F '|' -v tag="$release_tag" '$1 == tag { found = 1 } END { exit !found }' "$state/images"; then
  printf '%s|%s|500\n' "$release_tag" "${NAS_TEST_RELEASE_IMAGE_ID:?}" >>"$state/images"
fi
grep -Fqx -- "$release_tag" "$state/registry" || printf '%s\n' "$release_tag" >>"$state/registry"

temporary=$(mktemp "$state/containers.tmp.XXXXXX")
awk -F '|' -v tag="$release_tag" -v image_id="${NAS_TEST_RELEASE_IMAGE_ID:?}" '
  BEGIN { OFS = "|" }
  $2 == "back" { $3 = "true"; $5 = tag; $6 = image_id }
  { print }
' "$state/containers" >"$temporary"
mv -- "$temporary" "$state/containers"

if [[ -f "$state/post_deploy_db_fail" ]]; then
  printf '0\n' >"$state/db_ready"
fi
FAKE_DEPLOY

  chmod +x "$fake_bin/docker" "$fake_bin/curl" "$fake_bin/df" \
    "$fake_bin/flock" "$fake_bin/sleep" "$fake_bin/sync" "$deploy_fixture"
}

setup_case() {
  cleanup_case
  case_dir=$(mktemp -d "${TMPDIR:-/tmp}/nas-back-release-test.XXXXXX")
  fake_state="$case_dir/fake-state"
  fake_bin="$case_dir/bin"
  retention_dir="$case_dir/retention"
  ledger="$retention_dir/back.successful-images"
  lock_path="$case_dir/release.lock"
  deploy_fixture="$case_dir/backend-deploy"
  mkdir -p "$fake_state" "$fake_bin" "$retention_dir"
  chmod 0700 "$retention_dir"

  : >"$fake_state/commands"
  : >"$fake_state/fresh_logs"
  : >"$fake_state/old_logs"
  printf '1\n' >"$fake_state/db_ready"
  printf '1\n' >"$fake_state/http_ready"
  printf '0\n' >"$fake_state/lock_busy"
  printf '22000000000 5 2000000\n' >"$fake_state/capacity"

  cat >"$fake_state/images" <<EOF
$seed_oldest|$seed_oldest_id|100
$seed_middle|$seed_middle_id|200
$seed_newest|$seed_newest_id|300
$historical_tag|$historical_id|400
EOF
  cat >"$fake_state/registry" <<EOF
$seed_oldest
$seed_middle
$seed_newest
$historical_tag
EOF
  cat >"$fake_state/containers" <<EOF
$(printf '9%.0s' {1..64})|back|true|0|$seed_newest|$seed_newest_id
$(printf '8%.0s' {1..64})|database|true|0|postgres:16|$database_id
EOF

  write_fake_docker
  write_fake_commands
  last_output=''
  last_status=0
  retention_owner_uid=$(id -u)
}

write_ledger() {
  : >"$ledger"
  local entry
  for entry in "$@"; do
    printf '%s\n' "$entry" >>"$ledger"
  done
  chmod 0600 "$ledger"
}

replace_back_container() {
  local config_image=$1
  local image_id=$2
  local temporary
  temporary=$(mktemp "$fake_state/containers.tmp.XXXXXX")
  awk -F '|' -v tag="$config_image" -v image_id="$image_id" '
    BEGIN { OFS = "|" }
    $2 == "back" { $5 = tag; $6 = image_id }
    { print }
  ' "$fake_state/containers" >"$temporary"
  mv -- "$temporary" "$fake_state/containers"
}

remove_image() {
  local tag=$1
  local temporary
  temporary=$(mktemp "$fake_state/images.tmp.XXXXXX")
  awk -F '|' -v tag="$tag" '$1 != tag' "$fake_state/images" >"$temporary"
  mv -- "$temporary" "$fake_state/images"
}

remove_registry_tag() {
  local tag=$1
  local temporary
  temporary=$(mktemp "$fake_state/registry.tmp.XXXXXX")
  awk -v tag="$tag" '$0 != tag' "$fake_state/registry" >"$temporary"
  mv -- "$temporary" "$fake_state/registry"
}

add_image() {
  local tag=$1
  local image_id=$2
  local size_bytes=$3
  printf '%s|%s|%s\n' "$tag" "$image_id" "$size_bytes" >>"$fake_state/images"
  printf '%s\n' "$tag" >>"$fake_state/registry"
}

run_release() {
  local mode=$1
  set +e
  last_output=$(env \
    PATH="$fake_bin:$PATH" \
    NAS_TEST_STATE="$fake_state" \
    NAS_TEST_REPOSITORY="$repository" \
    NAS_TEST_RELEASE_SHA="$release_sha" \
    NAS_TEST_RELEASE_IMAGE_ID="$release_id" \
    NAS_RELEASE_GIT_SHA="$release_sha" \
    NAS_RETENTION_MODE="$mode" \
    NAS_RELEASE_LOCK_PATH="$lock_path" \
    NAS_RELEASE_LOCK_WAIT_SECONDS='60' \
    NAS_RETENTION_STATE_DIR="$retention_dir" \
    NAS_RETENTION_OWNER_UID="$retention_owner_uid" \
    NAS_RELEASE_REPOSITORY="$repository" \
    NAS_RELEASE_SERVICE_CONTAINER='back' \
    NAS_RELEASE_DB_CONTAINER='database' \
    NAS_RELEASE_MOUNTPOINT='/' \
    NAS_RELEASE_LOCAL_URL='http://127.0.0.1:3000/version' \
    NAS_RELEASE_SITE_URL='https://newartspace.ru/' \
    NAS_RELEASE_MIN_FREE_BYTES='10737418240' \
    NAS_RELEASE_MIN_FREE_PERCENT='10' \
    NAS_RELEASE_MIN_FREE_INODES='1000000' \
    NAS_RETENTION_SOFT_MIN_FREE_BYTES='16106127360' \
    NAS_RELEASE_DB_ATTEMPTS='3' \
    NAS_RELEASE_DB_DELAY_SECONDS='5' \
    NAS_RELEASE_SERVICE_ATTEMPTS='10' \
    NAS_RELEASE_SERVICE_DELAY_SECONDS='5' \
    NAS_RELEASE_REQUEST_TIMEOUT_SECONDS='10' \
    NAS_RETENTION_SEED_OLDEST="$seed_oldest" \
    NAS_RETENTION_SEED_MIDDLE="$seed_middle" \
    NAS_RETENTION_SEED_NEWEST="$seed_newest" \
    NAS_BACKEND_DEPLOY_SCRIPT="$deploy_fixture" \
    bash "$release_script" 2>&1)
  last_status=$?
  set -e
}

assert_status() {
  local expected=$1
  if [[ "$last_status" != "$expected" ]]; then
    printf 'expected status %s, got %s\noutput:\n%s\n' "$expected" "$last_status" "$last_output" >&2
    return 1
  fi
}

assert_nonzero_status() {
  if [[ "$last_status" == 0 ]]; then
    printf 'expected nonzero status\noutput:\n%s\n' "$last_output" >&2
    return 1
  fi
}

assert_output_contains() {
  local expected=$1
  if [[ "$last_output" != *"$expected"* ]]; then
    printf 'output missing: %s\noutput:\n%s\n' "$expected" "$last_output" >&2
    return 1
  fi
}

assert_output_excludes() {
  local forbidden=$1
  if [[ "$last_output" == *"$forbidden"* ]]; then
    printf 'output unexpectedly contains: %s\noutput:\n%s\n' "$forbidden" "$last_output" >&2
    return 1
  fi
}

assert_file_contains() {
  local path=$1
  local expected=$2
  if ! grep -Fq -- "$expected" "$path"; then
    printf '%s missing: %s\ncontents:\n' "$path" "$expected" >&2
    cat "$path" >&2
    return 1
  fi
}

assert_file_excludes() {
  local path=$1
  local forbidden=$2
  if grep -Fq -- "$forbidden" "$path"; then
    printf '%s unexpectedly contains: %s\ncontents:\n' "$path" "$forbidden" >&2
    cat "$path" >&2
    return 1
  fi
}

assert_ledger() {
  local expected_file="$case_dir/expected-ledger"
  : >"$expected_file"
  local entry
  for entry in "$@"; do
    printf '%s\n' "$entry" >>"$expected_file"
  done
  if [[ ! -f "$ledger" ]] || ! cmp -s "$expected_file" "$ledger"; then
    printf 'ledger byte mismatch\nexpected:\n' >&2
    cat "$expected_file" >&2
    printf 'actual:\n' >&2
    [[ ! -f "$ledger" ]] || cat "$ledger" >&2
    return 1
  fi
}

assert_no_ledger() {
  if [[ -e "$ledger" || -L "$ledger" ]]; then
    printf 'ledger unexpectedly exists: %s\n' "$ledger" >&2
    return 1
  fi
}

assert_rm_calls() {
  local expected=$1
  local actual=0
  [[ ! -f "$fake_state/rm_calls" ]] || actual=$(cat "$fake_state/rm_calls")
  if [[ "$actual" != "$expected" ]]; then
    printf 'expected %s image rm call(s), got %s\n' "$expected" "$actual" >&2
    return 1
  fi
}

case_bootstrap_requires_newest_running_seed() {
  setup_case
  replace_back_container "$seed_middle" "$seed_middle_id"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'running image must equal newest successful ledger entry' || return 1
  assert_no_ledger || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_bootstrap_records_exact_seeds_before_success() {
  setup_case
  run_release dry-run
  assert_status 0 || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$release_tag" || return 1
  assert_output_contains 'ledger bootstrapped:' || return 1
  assert_output_contains "ledger validated: entries=3 running_image=$seed_newest image_id=$seed_newest_id restart=0" || return 1
  assert_file_contains "$fake_state/commands" "docker|manifest|inspect|$seed_oldest" || return 1
  assert_file_contains "$fake_state/commands" "docker|manifest|inspect|$seed_middle" || return 1
  assert_file_contains "$fake_state/commands" "docker|manifest|inspect|$seed_newest" || return 1
}

case_rejects_symlink_ledger() {
  setup_case
  local target="$case_dir/ledger-target"
  printf '%s\n%s\n%s\n' "$seed_oldest" "$seed_middle" "$seed_newest" >"$target"
  chmod 0600 "$target"
  ln -s "$target" "$ledger"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'ledger must be a regular non-symlink file' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_rejects_symlink_state_directory() {
  setup_case
  local real_directory="$case_dir/real-retention"
  mkdir "$real_directory"
  chmod 0700 "$real_directory"
  rmdir "$retention_dir"
  ln -s "$real_directory" "$retention_dir"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'state directory must not be a symlink' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_rejects_malformed_ledger() {
  setup_case
  write_ledger "$seed_oldest" 'not-an-image' "$seed_newest"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'malformed or foreign ledger entry' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_rejects_foreign_ledger() {
  setup_case
  write_ledger "$seed_oldest" 'ghcr.io/example/foreign:sha-1111111111111111111111111111111111111111' "$seed_newest"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'malformed or foreign ledger entry' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_rejects_truncated_ledger() {
  setup_case
  write_ledger "$seed_middle" "$seed_newest"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'ledger must contain at least three successful images' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_rejects_wrong_state_owner() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  retention_owner_uid=$((retention_owner_uid + 1))
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'state directory owner UID' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
}

case_rejects_ambiguous_revision_replay_before_deploy() {
  setup_case
  add_image "$release_tag" "$release_id" 500
  write_ledger "$seed_oldest" "$release_tag" "$seed_middle" "$seed_newest"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'release image already appears before the newest ledger entry' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
  assert_ledger "$seed_oldest" "$release_tag" "$seed_middle" "$seed_newest" || return 1
}

case_readiness_failure_preserves_ledger() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf '0\n' >"$fake_state/http_ready"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'service readiness failed' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" || return 1
  assert_rm_calls 0 || return 1
}

case_dry_run_records_success_without_deletion() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  run_release dry-run
  assert_status 0 || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$release_tag" || return 1
  assert_rm_calls 0 || return 1
  assert_output_contains 'retention_mode=dry-run' || return 1
  assert_output_contains "retention_candidate=$seed_oldest image_id=$seed_oldest_id size_bytes=100" || return 1
  assert_output_contains "retention_candidate=$historical_tag image_id=$historical_id size_bytes=400" || return 1
}

case_protects_active_and_two_previous_ids() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  run_release dry-run
  assert_status 0 || return 1
  assert_output_excludes "retention_candidate=$seed_middle " || return 1
  assert_output_excludes "retention_candidate=$seed_newest " || return 1
  assert_output_excludes "retention_candidate=$release_tag " || return 1
  assert_file_contains "$fake_state/images" "$seed_middle|$seed_middle_id" || return 1
  assert_file_contains "$fake_state/images" "$seed_newest|$seed_newest_id" || return 1
  assert_file_contains "$fake_state/images" "$release_tag|$release_id" || return 1
}

case_protects_stopped_container_image_id() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  add_image "$stopped_tag" "$stopped_id" 600
  printf '%s|old-stopped|false|7|unrelated:tag|%s\n' "$(printf '7%.0s' {1..64})" "$stopped_id" >>"$fake_state/containers"
  run_release dry-run
  assert_status 0 || return 1
  assert_output_excludes "retention_candidate=$stopped_tag " || return 1
  assert_file_contains "$fake_state/images" "$stopped_tag|$stopped_id" || return 1
}

case_rejects_registry_unavailable_candidate() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  remove_registry_tag "$historical_tag"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains "registry manifest unavailable for candidate $historical_tag" || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$release_tag" || return 1
  assert_rm_calls 0 || return 1
}

case_apply_removes_exact_candidates_once_and_compacts() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  run_release apply
  assert_status 0 || return 1
  assert_rm_calls 1 || return 1
  assert_file_contains "$fake_state/commands" "docker|image|rm|--|$seed_oldest|$historical_tag" || return 1
  assert_file_contains "$fake_state/commands" "docker|manifest|inspect|$seed_oldest" || return 1
  assert_file_contains "$fake_state/commands" "docker|manifest|inspect|$historical_tag" || return 1
  assert_ledger "$seed_middle" "$seed_newest" "$release_tag" || return 1
}

case_lock_contention_precedes_deploy() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf '1\n' >"$fake_state/lock_busy"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'timed out acquiring release lock' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" || return 1
}

case_soft_threshold_reports_after_postchecks() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf '12000000000 80 2000000\n' >"$fake_state/capacity"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'post-retention verification passed' || return 1
  assert_output_contains 'free bytes 12000000000 below soft threshold 16106127360' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$release_tag" || return 1
  assert_file_contains "$fake_state/commands" 'docker|logs|--since|' || return 1
}

case_scans_only_fresh_logs() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf 'FATAL old event before this release\n' >"$fake_state/old_logs"
  printf 'ordinary healthy request\n' >"$fake_state/fresh_logs"
  run_release dry-run
  assert_status 0 || return 1
  assert_file_contains "$fake_state/commands" 'docker|logs|--since|' || return 1
  assert_output_contains 'fresh log check passed' || return 1
}

case_rejects_fatal_fresh_logs() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf 'panic: simulated crash\n' >"$fake_state/fresh_logs"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'fresh application logs contain a fatal pattern' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$release_tag" || return 1
}

case_allows_benign_log_lookalikes() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf 'fatalistic wording; oomph; migration completed without error\n' >"$fake_state/fresh_logs"
  run_release dry-run
  assert_status 0 || return 1
  assert_output_contains 'fresh log check passed' || return 1
}

case_backend_deploy_failure_preserves_ledger() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  : >"$fake_state/deploy_fail"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'backend deploy command failed' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" || return 1
  assert_file_contains "$fake_state/commands" "backend-deploy|back|sha-$release_sha" || return 1
  assert_file_excludes "$fake_state/commands" 'docker|image|ls|' || return 1
  assert_rm_calls 0 || return 1
}

case_predeploy_database_failure_precedes_deploy() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf '0\n' >"$fake_state/db_ready"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'database preflight failed' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" || return 1
}

case_postdeploy_database_failure_preserves_ledger() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  : >"$fake_state/post_deploy_db_fail"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'database preflight failed' || return 1
  assert_file_contains "$fake_state/commands" "backend-deploy|back|sha-$release_sha" || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" || return 1
  assert_rm_calls 0 || return 1
}

case_no_candidates_is_successful() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  remove_image "$historical_tag"
  remove_registry_tag "$historical_tag"
  printf '%s|old-stopped|false|1|%s|%s\n' "$(printf '7%.0s' {1..64})" "$seed_oldest" "$seed_oldest_id" >>"$fake_state/containers"
  run_release dry-run
  assert_status 0 || return 1
  assert_output_contains 'retention_candidate_count=0' || return 1
  assert_rm_calls 0 || return 1
}

case_duplicate_image_ids_count_size_once() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  add_image "$duplicate_tag" "$historical_id" 400
  run_release dry-run
  assert_status 0 || return 1
  assert_output_contains 'retention_candidate_count=3 distinct_image_count=2 estimated_bytes=500' || return 1
  assert_output_contains "retention_candidate=$historical_tag image_id=$historical_id size_bytes=400" || return 1
  assert_output_contains "retention_candidate=$duplicate_tag image_id=$historical_id size_bytes=400" || return 1
}

case_protected_tags_can_share_an_image_id() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  local temporary
  temporary=$(mktemp "$fake_state/images.tmp.XXXXXX")
  awk -F '|' -v tag="$seed_middle" -v shared_id="$seed_newest_id" '
    BEGIN { OFS = "|" }
    $1 == tag { $2 = shared_id }
    { print }
  ' "$fake_state/images" >"$temporary"
  mv -- "$temporary" "$fake_state/images"
  run_release dry-run
  assert_status 0 || return 1
  assert_output_excludes "retention_candidate=$seed_middle " || return 1
  assert_output_excludes "retention_candidate=$seed_newest " || return 1
}

case_interrupted_cleanup_state_recovers() {
  setup_case
  add_image "$current_tag" "$current_id" 700
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$current_tag"
  remove_image "$seed_oldest"
  remove_image "$historical_tag"
  remove_registry_tag "$historical_tag"
  replace_back_container "$current_tag" "$current_id"
  run_release dry-run
  assert_status 0 || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$current_tag" "$release_tag" || return 1
  assert_output_contains "retention_candidate=$seed_middle image_id=$seed_middle_id size_bytes=200" || return 1
}

case_hard_capacity_failure_precedes_deploy() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf '10737418239 5 2000000\n' >"$fake_state/capacity"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains 'below hard threshold 10737418240' || return 1
  assert_file_excludes "$fake_state/commands" 'backend-deploy|' || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" || return 1
}

case_postcheck_failure_keeps_uncompacted_ledger() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf 'migration failed after startup\n' >"$fake_state/fresh_logs"
  run_release apply
  assert_nonzero_status || return 1
  assert_rm_calls 1 || return 1
  assert_ledger "$seed_oldest" "$seed_middle" "$seed_newest" "$release_tag" || return 1
  assert_output_contains 'fresh application logs contain a fatal pattern' || return 1
}

case_rejects_ambiguous_local_tag() {
  setup_case
  write_ledger "$seed_oldest" "$seed_middle" "$seed_newest"
  printf '%s|%s|401\n' "$historical_tag" "$other_id" >>"$fake_state/images"
  run_release dry-run
  assert_nonzero_status || return 1
  assert_output_contains "ambiguous local image tag $historical_tag" || return 1
  assert_rm_calls 0 || return 1
}

run_case() {
  local name=$1
  local function_name=$2
  tests_run=$((tests_run + 1))
  if "$function_name"; then
    printf 'ok %s - %s\n' "$tests_run" "$name"
  else
    failures=$((failures + 1))
    printf 'not ok %s - %s\n' "$tests_run" "$name" >&2
  fi
  cleanup_case
}

run_case 'bootstraps only when the running image equals the newest seed' case_bootstrap_requires_newest_running_seed
run_case 'bootstrap records the three exact seeds before the healthy revision' case_bootstrap_records_exact_seeds_before_success
run_case 'rejects a symlink ledger before backend deploy' case_rejects_symlink_ledger
run_case 'rejects a symlink state directory before backend deploy' case_rejects_symlink_state_directory
run_case 'rejects malformed ledger entries' case_rejects_malformed_ledger
run_case 'rejects foreign-repository ledger entries' case_rejects_foreign_ledger
run_case 'rejects truncated ledgers' case_rejects_truncated_ledger
run_case 'rejects a state directory owned by the wrong UID' case_rejects_wrong_state_owner
run_case 'rejects an ambiguous older revision replay before backend deploy' case_rejects_ambiguous_revision_replay_before_deploy
run_case 'leaves the ledger unchanged when service readiness fails' case_readiness_failure_preserves_ledger
run_case 'dry-run records a healthy revision but performs zero image removals' case_dry_run_records_success_without_deletion
run_case 'protects active plus two previous successful image IDs' case_protects_active_and_two_previous_ids
run_case 'protects an image ID referenced by a stopped container' case_protects_stopped_container_image_id
run_case 'rejects a candidate unavailable from the registry' case_rejects_registry_unavailable_candidate
run_case 'apply performs one exact removal call and compacts the ledger' case_apply_removes_exact_candidates_once_and_compacts
run_case 'rejects lock contention before backend deploy' case_lock_contention_precedes_deploy
run_case 'reports the soft threshold only after healthy post-checks' case_soft_threshold_reports_after_postchecks
run_case 'scans only logs emitted since this release started' case_scans_only_fresh_logs
run_case 'rejects fatal patterns in fresh application logs' case_rejects_fatal_fresh_logs
run_case 'does not reject benign fatal and migration lookalike words' case_allows_benign_log_lookalikes
run_case 'a failing backend deploy command leaves the ledger unchanged and skips retention' case_backend_deploy_failure_preserves_ledger
run_case 'a pre-deploy database failure prevents backend deploy' case_predeploy_database_failure_precedes_deploy
run_case 'a post-deploy database failure leaves the ledger unchanged' case_postdeploy_database_failure_preserves_ledger
run_case 'no-candidate retention succeeds without image removal' case_no_candidates_is_successful
run_case 'duplicate candidate image IDs contribute size only once' case_duplicate_image_ids_count_size_once
run_case 'protected tags may safely share one image ID' case_protected_tags_can_share_an_image_id
run_case 'an interrupted cleanup ledger recovers on the next release' case_interrupted_cleanup_state_recovers
run_case 'the hard capacity threshold fails before backend deploy' case_hard_capacity_failure_precedes_deploy
run_case 'post-retention failure leaves the success ledger uncompacted' case_postcheck_failure_keeps_uncompacted_ledger
run_case 'ambiguous local tags fail closed' case_rejects_ambiguous_local_tag

if ((failures > 0)); then
  printf 'production release tests failed: %s of %s case(s) failed\n' "$failures" "$tests_run" >&2
  exit 1
fi

printf 'production release tests passed: %s case(s)\n' "$tests_run"
