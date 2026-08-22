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
check_commands = checks.fetch('steps').map { |step| step['run'] }.compact.join("\n")
[
  'bash scripts/deploy/preflight.test.sh',
  'bash scripts/deploy/database-preflight.test.sh',
  'bash scripts/deploy/service-readiness.test.sh',
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

deploy_steps = deploy_job.fetch('steps')
required_order = [
  'Checkout code',
  'Disk/inode preflight',
  'Database preflight',
  'Deploy to Server',
  'Post-deploy database readiness',
  'Post-deploy service readiness'
]
positions = required_order.map do |name|
  index = deploy_steps.index { |step| step['name'] == name }
  assert(!index.nil?, "missing deploy step #{name}")
  index
end
assert(positions == positions.sort, 'deploy gates are in the wrong order')

step = ->(name) { deploy_steps.fetch(positions[required_order.index(name)]) }

disk = step.call('Disk/inode preflight')
assert(disk['uses'] == 'appleboy/ssh-action@v1.2.5', 'disk gate must use ssh-action v1.2.5')
assert(disk.dig('with', 'script_path') == 'scripts/deploy/preflight.sh', 'disk gate script_path is wrong')
assert(disk.dig('env', 'NAS_DEPLOY_MOUNTPOINT') == '/', 'disk mountpoint must be /')
assert(disk.dig('env', 'NAS_DEPLOY_MIN_FREE_BYTES').to_s == '10737418240', 'free-byte threshold is wrong')
assert(disk.dig('env', 'NAS_DEPLOY_MIN_FREE_PERCENT').to_s == '10', 'free-percent threshold is wrong')
assert(disk.dig('env', 'NAS_DEPLOY_MIN_FREE_INODES').to_s == '1000000', 'free-inode threshold is wrong')

['Database preflight', 'Post-deploy database readiness'].each do |name|
  database = step.call(name)
  assert(database['uses'] == 'appleboy/ssh-action@v1.2.5', "#{name} must use ssh-action v1.2.5")
  assert(database.dig('with', 'script_path') == 'scripts/deploy/database-preflight.sh', "#{name} script_path is wrong")
  assert(database.dig('env', 'NAS_DEPLOY_DB_CONTAINER') == 'database', "#{name} container is wrong")
  assert(database.dig('env', 'NAS_DEPLOY_DB_ATTEMPTS').to_s == '3', "#{name} attempts are wrong")
  assert(database.dig('env', 'NAS_DEPLOY_DB_DELAY_SECONDS').to_s == '5', "#{name} delay is wrong")
end

service = step.call('Post-deploy service readiness')
assert(service['uses'] == 'appleboy/ssh-action@v1.2.5', 'service readiness must use ssh-action v1.2.5')
assert(service.dig('with', 'script_path') == 'scripts/deploy/service-readiness.sh', 'service readiness script_path is wrong')
expected_service_env = {
  'NAS_DEPLOY_SERVICE_CONTAINER' => 'back',
  'NAS_DEPLOY_EXPECTED_IMAGE' => 'ghcr.io/vsevolod-rusinskiy/newartspace-back:sha-${{ github.sha }}',
  'NAS_DEPLOY_LOCAL_URL' => 'http://127.0.0.1:3000/version',
  'NAS_DEPLOY_SITE_URL' => 'https://newartspace.ru/',
  'NAS_DEPLOY_SERVICE_ATTEMPTS' => '10',
  'NAS_DEPLOY_SERVICE_DELAY_SECONDS' => '5',
  'NAS_DEPLOY_REQUEST_TIMEOUT_SECONDS' => '10'
}
expected_service_env.each do |key, value|
  assert(service.dig('env', key).to_s == value, "service readiness #{key} is wrong")
end

forbidden = ['docker system prune', 'docker image prune', 'docker volume rm', 'docker volume prune']
forbidden.each do |command|
  assert(!workflow_text.include?(command), "workflow contains forbidden command #{command}")
end

puts 'backend workflow contract passed'
