import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildBackendSpawn, runBackend, runBackendCli } from './run-backend.mjs'

const safeEnv = {
  SEO_SAFE_MODE: 'true',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_NAME: 'newartspace_seo',
  POSTGRES_USER: 'newartspace_seo_reader',
  POSTGRES_PASSWORD: 'reader-password',
  DB_SYNCHRONIZE: 'false',
  BUCKET_NAME: 'seo-storage-disabled',
  PORT: '3200',
  FRONTEND_URL: 'http://localhost:3201',
  ACCESS_KEY_ID: 'must-not-leak'
}

test('backend spawn allowlists only runtime reader configuration', () => {
  const spawn = buildBackendSpawn({
    parsedLocalEnv: safeEnv,
    backendRoot: '/backend',
    tempCwd: '/tmp/isolated'
  })
  assert.equal(spawn.command, process.execPath)
  assert.deepEqual(spawn.args, ['/backend/dist/main.js'])
  assert.equal(spawn.options.cwd, '/tmp/isolated')
  assert.equal(spawn.options.env.ACCESS_KEY_ID, undefined)
  assert.equal(spawn.options.env.POSTGRES_ADMIN_PASSWORD, undefined)
  assert.equal(spawn.options.env.POSTGRES_NAME, 'newartspace_seo')
  assert.equal(spawn.options.stdio, 'inherit')
})

test('backend wrapper uses a temporary cwd and removes it after its fake child exits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'seo-safe-backend-'))
  await mkdir(join(root, 'dist'))
  await writeFile(join(root, 'dist', 'main.js'), '')
  await writeFile(
    join(root, '.env.seo-safe.local'),
    Object.entries(safeEnv)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
  )
  let childCwd
  await runBackend({
    dependencies: {
      backendRoot: root,
      spawn: (_command, _args, options) => ({
        once: (event, callback) => {
          childCwd = options.cwd
          if (event === 'close') callback(0)
        }
      })
    }
  })
  await assert.rejects(() =>
    import('node:fs/promises').then(({ stat }) => stat(childCwd))
  )
})

test('backend CLI adapter delegates to the isolated wrapper', async () => {
  let called = false
  await runBackendCli({
    dependencies: {
      runBackend: async () => {
        called = true
      }
    }
  })
  assert.equal(called, true)
})
