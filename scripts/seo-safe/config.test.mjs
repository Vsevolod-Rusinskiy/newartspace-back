import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import test from 'node:test'
import {
  SEO_SAFE,
  assertDumpIdentity,
  assertLoopbackServerRow,
  assertStaticSeoSafeEnv,
  buildRuntimeEnv,
  parseExactConfirmation
} from './config.mjs'

const safeEnv = () => ({
  SEO_SAFE_MODE: 'true',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_NAME: 'newartspace_seo',
  DB_SYNCHRONIZE: 'false',
  BUCKET_NAME: 'seo-storage-disabled',
  PORT: '3200',
  FRONTEND_URL: 'http://localhost:3201'
})

test('config accepts only the exact safe runtime environment', () => {
  assert.doesNotThrow(() => assertStaticSeoSafeEnv(safeEnv()))

  for (const env of [
    { ...safeEnv(), POSTGRES_NAME: 'newartspace' },
    { ...safeEnv(), POSTGRES_NAME: '' },
    { ...safeEnv(), POSTGRES_NAME: 'another_database' },
    { ...safeEnv(), POSTGRES_HOST: 'db.example.test' },
    { ...safeEnv(), POSTGRES_HOST: '0.0.0.0' },
    { ...safeEnv(), POSTGRES_PORT: '5433' },
    { ...safeEnv(), DB_SYNCHRONIZE: 'true' },
    { ...safeEnv(), DB_SYNCHRONIZE: undefined },
    { ...safeEnv(), ACCESS_KEY_ID: 'forbidden' },
    { ...safeEnv(), NODEMAILER_PASSWORD: 'forbidden' },
    { ...safeEnv(), YOUR_BOT_TOKEN: 'forbidden' }
  ]) {
    assert.throws(() => assertStaticSeoSafeEnv(env))
  }
})

test('config accepts only a real loopback database server address', () => {
  assert.doesNotThrow(() =>
    assertLoopbackServerRow({
      inet_server_addr: '127.0.0.1',
      inet_server_port: 5432
    })
  )
  assert.doesNotThrow(() =>
    assertLoopbackServerRow({ inet_server_addr: '::1', inet_server_port: 5432 })
  )
  assert.throws(() =>
    assertLoopbackServerRow({
      inet_server_addr: '10.0.0.1',
      inet_server_port: 5432
    })
  )
  assert.throws(() =>
    assertLoopbackServerRow({ inet_server_addr: null, inet_server_port: 5432 })
  )
})

test('config rejects a dump with a wrong immutable identity', async () => {
  const dependencies = {
    stat: async () => ({ size: SEO_SAFE.dumpSize }),
    createReadStream: () => Readable.from(['wrong dump'])
  }

  await assert.rejects(() => assertDumpIdentity(dependencies))
  await assert.rejects(() =>
    assertDumpIdentity({ ...dependencies, path: '/tmp/wrong.dump' })
  )
})

test('confirmation and runtime allowlist reject broad or privileged input', () => {
  assert.equal(parseExactConfirmation(['--confirm-newartspace-seo']), true)
  assert.equal(parseExactConfirmation(['--confirm-newartspace-seo=yes']), false)
  assert.equal(parseExactConfirmation([]), false)

  const runtime = buildRuntimeEnv({
    ...safeEnv(),
    POSTGRES_USER: 'newartspace_seo_reader',
    POSTGRES_PASSWORD: 'reader-password',
    POSTGRES_ADMIN_PASSWORD: 'admin-password',
    ACCESS_KEY_ID: 'storage-key',
    UNKNOWN_PARENT_VALUE: 'must-not-leak'
  })

  assert.equal(runtime.POSTGRES_USER, 'newartspace_seo_reader')
  assert.equal(runtime.POSTGRES_PASSWORD, 'reader-password')
  assert.equal(runtime.POSTGRES_ADMIN_PASSWORD, undefined)
  assert.equal(runtime.ACCESS_KEY_ID, undefined)
  assert.equal(runtime.UNKNOWN_PARENT_VALUE, undefined)
})
