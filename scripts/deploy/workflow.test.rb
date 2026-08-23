#!/usr/bin/env ruby
# frozen_string_literal: true

require 'yaml'

WORKFLOW_PATH = File.expand_path('../../.github/workflows/main-ci-cd.yml', __dir__)
workflow_text = File.read(WORKFLOW_PATH)
workflow = YAML.safe_load(workflow_text, aliases: true)

def assert(condition, message)
  raise "workflow contract failed: #{message}" unless condition
end

triggers = workflow['on'] || workflow[true]
assert(triggers.is_a?(Hash), 'workflow triggers are missing')
assert(Array(triggers.dig('push', 'branches')).include?('master'), 'push must target master')
assert(Array(triggers.dig('pull_request', 'branches')).include?('master'), 'pull_request must target master')

jobs = workflow.fetch('jobs')
checks = jobs.fetch('checks')
workflow_permissions = workflow.fetch('permissions')
assert(workflow_permissions['contents'] == 'read', 'workflow contents permission must be read')
assert(workflow_permissions['packages'] != 'write', 'packages write must not apply to pull-request checks')
assert(checks['permissions'].nil?, 'checks must use the read-only workflow permissions')
check_commands = checks.fetch('steps').map { |step| step['run'] }.compact.join("\n")
[
  'bash scripts/deploy/preflight.test.sh',
  'bash scripts/deploy/database-preflight.test.sh',
  'bash scripts/deploy/service-readiness.test.sh',
  'bash scripts/deploy/production-release.test.sh',
  'yarn test --runInBand',
  'yarn prettier-check',
  'yarn lint',
  'yarn build'
].each do |command|
  assert(check_commands.include?(command), "checks must run #{command}")
end

build_job = jobs.fetch('build-and-push')
deploy_job = jobs.fetch('deploy')
build_permissions = build_job.fetch('permissions')
assert(build_permissions['contents'] == 'read', 'build-and-push contents permission must be read')
assert(build_permissions['packages'] == 'write', 'build-and-push packages permission must be write')
assert(build_job['if'] == "github.event_name == 'push'", 'build-and-push must be push-only')
assert(deploy_job['if'] == "github.event_name == 'push'", 'deploy must be push-only')

deploy_steps = deploy_job.fetch('steps')
assert(deploy_steps.map { |step| step['name'] } == ['Checkout code', 'Run locked production release'],
       'deploy must contain checkout followed by exactly one locked release step')
remote_steps = deploy_steps.select { |step| step['uses']&.start_with?('appleboy/ssh-action@') }
assert(remote_steps.length == 1, 'deploy must contain exactly one remote SSH step')
release = remote_steps.fetch(0)
assert(release['name'] == 'Run locked production release', 'locked release step name is wrong')
assert(release['uses'] == 'appleboy/ssh-action@v1.2.5', 'locked release must use ssh-action v1.2.5')
assert(release.dig('with', 'script_path') == 'scripts/deploy/production-release.sh',
       'locked release script_path is wrong')
assert(release.dig('with', 'script').nil?, 'locked release must not duplicate an inline deploy body')

expected_release_env = {
  'NAS_RELEASE_GIT_SHA' => '${{ github.sha }}',
  'NAS_RETENTION_MODE' => 'dry-run',
  'NAS_RELEASE_LOCK_PATH' => '/var/lock/newartspace-deploy-cleanup.lock',
  'NAS_RELEASE_LOCK_WAIT_SECONDS' => '60',
  'NAS_RETENTION_STATE_DIR' => '/var/lib/newartspace/image-retention',
  'NAS_RETENTION_OWNER_UID' => '0',
  'NAS_RELEASE_REPOSITORY' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back',
  'NAS_RELEASE_SERVICE_CONTAINER' => 'back',
  'NAS_RELEASE_DB_CONTAINER' => 'database',
  'NAS_RELEASE_MOUNTPOINT' => '/',
  'NAS_RELEASE_LOCAL_URL' => 'http://127.0.0.1:3000/version',
  'NAS_RELEASE_SITE_URL' => 'https://newartspace.ru/',
  'NAS_RELEASE_MIN_FREE_BYTES' => '10737418240',
  'NAS_RELEASE_MIN_FREE_PERCENT' => '10',
  'NAS_RELEASE_MIN_FREE_INODES' => '1000000',
  'NAS_RETENTION_SOFT_MIN_FREE_BYTES' => '16106127360',
  'NAS_RELEASE_DB_ATTEMPTS' => '3',
  'NAS_RELEASE_DB_DELAY_SECONDS' => '5',
  'NAS_RELEASE_SERVICE_ATTEMPTS' => '10',
  'NAS_RELEASE_SERVICE_DELAY_SECONDS' => '5',
  'NAS_RELEASE_REQUEST_TIMEOUT_SECONDS' => '10',
  'NAS_RETENTION_SEED_OLDEST' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d',
  'NAS_RETENTION_SEED_MIDDLE' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-25f399f352b311462caf53e12baa230bc1049366',
  'NAS_RETENTION_SEED_NEWEST' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-492304ccfad8038d047e5228e989eedb3da04f38',
  'NAS_BACKEND_DEPLOY_SCRIPT' => '/var/www/newartspace/scripts/deploy.sh'
}
expected_release_env.each do |key, value|
  assert(release.dig('env', key).to_s == value, "locked release #{key} is wrong")
end
forwarded_env = release.dig('with', 'envs').to_s.split(',')
assert(forwarded_env.sort == expected_release_env.keys.sort,
       'locked release must forward every and only the fixed NAS environment value')

forbidden = [
  'docker system prune',
  'docker image prune',
  'docker volume rm',
  'docker volume prune',
  'docker volume remove'
]
forbidden.each do |command|
  assert(!workflow_text.include?(command), "workflow contains forbidden command #{command}")
end

puts 'backend workflow contract passed'
