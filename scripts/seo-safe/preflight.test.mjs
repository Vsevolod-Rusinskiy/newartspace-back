import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inspectLocalPostgres,
  runPreflight,
  runPreflightCli
} from './preflight.mjs'

const env = {
  SEO_SAFE_MODE: 'true',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_NAME: 'newartspace_seo',
  POSTGRES_ADMIN_DATABASE: 'postgres',
  POSTGRES_ADMIN_USER: 'admin',
  POSTGRES_ADMIN_PASSWORD: 'secret',
  DB_SYNCHRONIZE: 'false',
  BUCKET_NAME: 'seo-storage-disabled',
  PORT: '3200',
  FRONTEND_URL: 'http://localhost:3201'
}

test('preflight verifies a loopback admin server and exact target using a fake client', async () => {
  let clientConfig
  const query = async () => ({
    rows: [
      {
        current_database: 'postgres',
        inet_server_addr: '::1',
        inet_server_port: 5432,
        target_exists: false
      }
    ]
  })
  const report = await inspectLocalPostgres({
    env,
    Client: class {
      constructor(config) {
        clientConfig = config
      }
      async connect() {}
      async query() {
        return query()
      }
      async end() {}
    }
  })
  assert.equal(report.inet_server_addr, '::1')
  assert.equal(clientConfig.host, 'localhost')
  assert.equal(clientConfig.database, 'postgres')
  await assert.rejects(() =>
    runPreflight({
      env: { ...env, POSTGRES_NAME: 'newartspace' },
      Client: class {},
      fs: {},
      crypto: {}
    })
  )
})

test('preflight CLI loads only the local safe env and prints no credentials', async () => {
  const output = []
  let receivedEnv
  const report = await runPreflightCli({
    dependencies: {
      backendRoot: '/backend',
      readFile: async (path) => {
        assert.equal(path, '/backend/.env.seo-safe.local')
        return [
          'SEO_SAFE_MODE=true',
          'POSTGRES_HOST=localhost',
          'POSTGRES_PORT=5432',
          'POSTGRES_NAME=newartspace_seo',
          'POSTGRES_ADMIN_DATABASE=postgres',
          'POSTGRES_ADMIN_USER=admin',
          'POSTGRES_ADMIN_PASSWORD=top-secret',
          'DB_SYNCHRONIZE=false',
          'BUCKET_NAME=seo-storage-disabled',
          'PORT=3200',
          'FRONTEND_URL=http://localhost:3201'
        ].join('\n')
      },
      runPreflight: async ({ env: parsed }) => {
        receivedEnv = parsed
        return {
          current_database: 'postgres',
          inet_server_addr: '::1',
          inet_server_port: 5432,
          target_exists: false
        }
      },
      writeOutput: (value) => output.push(value)
    }
  })

  assert.equal(receivedEnv.POSTGRES_ADMIN_PASSWORD, 'top-secret')
  assert.equal(report.targetExists, false)
  assert.doesNotMatch(output.join(''), /top-secret|POSTGRES_ADMIN_PASSWORD/)
})

test('preflight rejects missing admin credentials and a non-loopback server', async () => {
  await assert.rejects(() =>
    inspectLocalPostgres({
      env: { ...env, POSTGRES_ADMIN_PASSWORD: '' },
      Client: class {}
    })
  )
  await assert.rejects(() =>
    inspectLocalPostgres({
      env,
      Client: class {
        async connect() {}
        async query() {
          return {
            rows: [
              {
                current_database: 'postgres',
                inet_server_addr: '10.0.0.2',
                inet_server_port: 5432,
                target_exists: false
              }
            ]
          }
        }
        async end() {}
      }
    })
  )
})
