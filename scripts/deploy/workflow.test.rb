#!/usr/bin/env ruby
# frozen_string_literal: true

require 'yaml'
require 'digest'

WORKFLOW_PATH = File.expand_path('../../.github/workflows/main-ci-cd.yml', __dir__)
RELEASE_PATH = File.expand_path('production-release.sh', __dir__)
workflow_text = File.read(WORKFLOW_PATH)
release_text = File.read(RELEASE_PATH)
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
assert(workflow['permissions'] == { 'contents' => 'read' }, 'workflow permissions must remain read-only by default')
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
assert(build_job['if'] == "github.event_name == 'push'", 'build-and-push must be push-only')
assert(deploy_job['if'] == "github.event_name == 'push'", 'deploy must be push-only')
assert(build_job['needs'] == 'checks', 'build-and-push must continue to depend on checks')
assert(deploy_job['needs'] == 'build-and-push', 'deploy must continue to depend on build-and-push')
assert(
  build_job['permissions'] == { 'contents' => 'read', 'packages' => 'write' },
  'build-and-push permissions must remain least-privilege'
)
build_step = build_job.fetch('steps').find { |step| step['name'] == 'Build and push image' }
assert(!build_step.nil?, 'build-and-push step is missing')
assert(
  build_step.dig('with', 'tags').to_s.strip == 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-${{ github.sha }}',
  'exact image naming must remain unchanged'
)

deploy_steps = deploy_job.fetch('steps')
assert(
  deploy_steps.map { |step| step['name'] } == ['Checkout code', 'Run locked production release'],
  'deploy must contain only checkout followed by the locked release'
)
remote_steps = deploy_steps.select { |step| step['uses'].to_s.start_with?('appleboy/ssh-action@') }
assert(remote_steps.length == 1, 'deploy must contain exactly one remote SSH step')
release_step = remote_steps.first
assert(release_step['name'] == 'Run locked production release', 'the remote step name is wrong')
assert(release_step['uses'] == 'appleboy/ssh-action@v1.2.5', 'locked release must use ssh-action v1.2.5')
assert(
  release_step.dig('with', 'script_path') == 'scripts/deploy/production-release.sh',
  'locked release script_path is wrong'
)
assert(release_step.dig('with', 'command_timeout') == '60m', 'locked release command timeout is wrong')

expected_release_env = {
  'NAS_RETENTION_MODE' => 'dry-run',
  'NAS_RELEASE_LOCK_PATH' => '/var/lock/newartspace-deploy-cleanup.lock',
  'NAS_RELEASE_LOCK_WAIT_SECONDS' => '300',
  'NAS_RETENTION_STATE_DIR' => '/var/lib/newartspace/image-retention',
  'NAS_RETENTION_OWNER_UID' => '0',
  'NAS_RETENTION_LEDGER_NAME' => 'back.successful-images',
  'NAS_IMAGE_REPOSITORY' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back',
  'NAS_DEPLOY_MOUNTPOINT' => '/',
  'NAS_DEPLOY_MIN_FREE_BYTES' => '10737418240',
  'NAS_DEPLOY_MIN_FREE_PERCENT' => '10',
  'NAS_DEPLOY_MIN_FREE_INODES' => '1000000',
  'NAS_RETENTION_SOFT_MIN_FREE_BYTES' => '16106127360',
  'NAS_DEPLOY_DB_CONTAINER' => 'database',
  'NAS_DEPLOY_DB_ATTEMPTS' => '3',
  'NAS_DEPLOY_DB_DELAY_SECONDS' => '5',
  'NAS_DEPLOY_SERVICE_CONTAINER' => 'back',
  'NAS_DEPLOY_EXPECTED_IMAGE' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-${{ github.sha }}',
  'NAS_DEPLOY_LOCAL_URL' => 'http://127.0.0.1:3000/version',
  'NAS_DEPLOY_SITE_URL' => 'https://newartspace.ru/',
  'NAS_DEPLOY_SERVICE_ATTEMPTS' => '10',
  'NAS_DEPLOY_SERVICE_DELAY_SECONDS' => '5',
  'NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS' => '10',
  'NAS_RETENTION_SEED_1' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-c5a5d1c3a0f57b1fc1c49c0dd39c503000037b7d',
  'NAS_RETENTION_SEED_2' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-25f399f352b311462caf53e12baa230bc1049366',
  'NAS_RETENTION_SEED_3' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-492304ccfad8038d047e5228e989eedb3da04f38',
  'NAS_BACKEND_DEPLOY_SCRIPT' => '/var/www/newartspace/scripts/deploy.sh'
}
expected_release_env.each do |key, value|
  assert(release_step.dig('env', key).to_s == value, "locked release #{key} is wrong")
end
forwarded_envs = release_step.dig('with', 'envs').to_s.split(',')
assert(forwarded_envs.sort == expected_release_env.keys.sort, 'locked release must forward exactly the fixed NAS_* environment')

common_begin = '# BEGIN NAS_RETENTION_COMMON_CORE'
common_end = '# END NAS_RETENTION_COMMON_CORE'
assert(release_text.scan(common_begin).length == 1, 'release must contain exactly one common-core begin marker')
assert(release_text.scan(common_end).length == 1, 'release must contain exactly one common-core end marker')
common_start = release_text.index(common_begin)
common_finish = release_text.index(common_end)
assert(common_start < common_finish, 'common-core markers are out of order')
common_core = release_text[common_start..(common_finish + common_end.length)]
assert(
  Digest::SHA256.hexdigest(common_core) == '030229ab4e04b5e3cb01aa4519294b51ef8fecb9686e1f8619f1eb3de52fa2a3',
  'common core must match the hardened canonical implementation byte-for-byte'
)
outside_core = release_text[0...common_start] + release_text[(common_finish + common_end.length)..]
assert(common_core.include?('require_application_configuration'), 'common configuration must call the application validator')
assert(common_core.match?(/^main\(\) \{/), 'main must be defined in the common core')
assert(!common_core.match?(/^deploy_application\(\) \{/), 'application deploy body must be outside the common core')
assert(!common_core.include?('newartspace-back'), 'common core must not contain the backend repository')
assert(!common_core.include?('newartspace.ru'), 'common core must not contain backend URLs')
assert(!common_core.include?('back.successful-images'), 'common core must not contain the backend ledger name')
outside_functions = outside_core.scan(/^([a-z][a-z0-9_]*)\(\) \{/).flatten
assert(
  outside_functions == %w[require_application_configuration deploy_application],
  'only application configuration and deployment functions may be defined outside the common core'
)
assert(release_text.rstrip.end_with?('main "$@"'), 'main invocation must follow the application-specific definitions')

[
  'backend_deploy_script=${NAS_BACKEND_DEPLOY_SCRIPT-}',
  '[[ "$backend_deploy_script" == /var/www/newartspace/scripts/deploy.sh ]]',
  'revision=${expected_image#"$image_repository:"}',
  '"$backend_deploy_script" back "$revision"'
].each do |fragment|
  assert(release_text.include?(fragment), "deploy body lost #{fragment}")
end
assert(release_text.scan('docker image rm --').length == 1, 'apply must have exactly one exact image-removal call')
assert(!release_text.match?(/^\s*(source|\.)\s+/), 'production release must not source sibling scripts')
['preflight.sh', 'database-preflight.sh', 'service-readiness.sh'].each do |sibling|
  assert(!release_text.include?(sibling), "production release must be self-contained and not invoke #{sibling}")
end

forbidden = ['docker system prune', 'docker image prune', 'docker volume', '--volumes']
forbidden.each do |command|
  assert(!workflow_text.include?(command), "workflow contains forbidden command #{command}")
  assert(!release_text.include?(command), "release script contains forbidden command #{command}")
end

puts 'backend workflow contract passed'
