import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAllowlistedDataRestoreArgs,
  buildSchemaRestoreArgs,
  createRestoreDependencies,
  escapeSqlLiteral,
  parseRestoreMode,
  runRestoreCli,
  restoreSeoDatabase
} from './restore.mjs'

const safeEnv = () => ({
  SEO_SAFE_MODE: 'true',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_NAME: 'newartspace_seo',
  POSTGRES_USER: 'newartspace_seo_reader',
  POSTGRES_PASSWORD: 'reader-secret',
  DB_SYNCHRONIZE: 'false',
  BUCKET_NAME: 'seo-storage-disabled',
  PORT: '3200',
  FRONTEND_URL: 'http://localhost:3201',
  POSTGRES_ADMIN_USER: 'admin',
  POSTGRES_ADMIN_PASSWORD: 'secret',
  POSTGRES_ADMIN_DATABASE: 'postgres'
})

const completeDependencies = (overrides = {}) => ({
  preflight: async () => {},
  readNormalCounts: async () => ({ Paintings: 19, Artists: 13 }),
  targetExists: async () => false,
  createTarget: async () => {},
  rebuildTarget: async () => {},
  runCommand: async () => {},
  runMigrations: async () => {},
  rewriteImages: async () => {},
  configureReader: async () => {},
  verify: async () => ({ verified: true }),
  ...overrides
})

test('restore command construction is allowlisted and does not expose passwords', () => {
  const schema = buildSchemaRestoreArgs()
  assert.deepEqual(schema.slice(0, 6), [
    'pg_restore',
    '--dbname=newartspace_seo',
    '--schema-only',
    '--no-owner',
    '--no-acl',
    '--exit-on-error'
  ])
  const data = buildAllowlistedDataRestoreArgs()
  assert.ok(data.includes('--dbname=newartspace_seo'))
  assert.ok(data.includes('--data-only'))
  assert.ok(data.includes('--table=Paintings'))
  assert.ok(
    !data
      .filter((value) => value.startsWith('--table='))
      .some((value) => value.includes('Users') || value.includes('Orders'))
  )
})

test('restore refuses targets other than the exact SEO database before SQL or spawn', async () => {
  await assert.rejects(() =>
    restoreSeoDatabase({
      env: { POSTGRES_NAME: 'newartspace' },
      argv: ['--confirm-newartspace-seo'],
      dependencies: {}
    })
  )
})

test('restore uses only explicit admin credentials and stops after a failed stage', async () => {
  const calls = []
  await assert.rejects(() =>
    restoreSeoDatabase({
      env: safeEnv(),
      argv: ['--confirm-newartspace-seo'],
      dependencies: completeDependencies({
        preflight: async () => calls.push('preflight'),
        readNormalCounts: async () => {
          calls.push('baseline')
          return { Paintings: 19 }
        },
        runCommand: async (_args, childEnv) => {
          calls.push(childEnv)
          throw new Error('restore failed')
        }
      })
    })
  )
  assert.equal(calls[2].PGDATABASE, 'newartspace_seo')
  assert.equal(calls[2].PGUSER, 'admin')
  assert.equal(calls[2].PGPASSWORD, 'secret')
  assert.equal(calls[2].PGHOST, 'localhost')
  assert.equal(calls[2].PATH, undefined)
})

test('restore accepts only exact create and rebuild confirmations', () => {
  assert.equal(parseRestoreMode(['--confirm-newartspace-seo']), 'create')
  assert.equal(
    parseRestoreMode([
      '--confirm-newartspace-seo',
      '--rebuild-newartspace-seo'
    ]),
    'rebuild'
  )
  for (const argv of [
    [],
    ['--rebuild-newartspace-seo'],
    ['--confirm-newartspace-seo', '--unexpected'],
    ['--confirm-newartspace-seo', '--rebuild-newartspace-seo', '--extra']
  ]) {
    assert.throws(() => parseRestoreMode(argv))
  }
})

test('restore fails before preflight when any mandatory stage is missing', async () => {
  const required = [
    'preflight',
    'readNormalCounts',
    'targetExists',
    'createTarget',
    'rebuildTarget',
    'runCommand',
    'runMigrations',
    'rewriteImages',
    'configureReader',
    'verify'
  ]
  for (const missing of required) {
    const dependencies = completeDependencies()
    delete dependencies[missing]
    await assert.rejects(
      () =>
        restoreSeoDatabase({
          env: safeEnv(),
          argv: ['--confirm-newartspace-seo'],
          dependencies
        }),
      new RegExp(missing)
    )
  }
})

test('restore executes every mandatory stage in fixed order and returns verification', async () => {
  const calls = []
  let countRead = 0
  const result = await restoreSeoDatabase({
    env: safeEnv(),
    argv: ['--confirm-newartspace-seo'],
    dependencies: completeDependencies({
      preflight: async () => calls.push('preflight'),
      readNormalCounts: async () => {
        calls.push(countRead++ === 0 ? 'counts-before' : 'counts-after')
        return { Artists: 13, Paintings: 19 }
      },
      targetExists: async () => {
        calls.push('target-exists')
        return false
      },
      createTarget: async () => calls.push('create'),
      runCommand: async (args) =>
        calls.push(args.includes('--schema-only') ? 'schema' : 'data'),
      runMigrations: async () => calls.push('migrations'),
      rewriteImages: async () => calls.push('rewrite'),
      configureReader: async () => calls.push('reader'),
      verify: async () => {
        calls.push('verify')
        return { verified: true }
      }
    })
  })

  assert.deepEqual(calls, [
    'preflight',
    'counts-before',
    'target-exists',
    'create',
    'schema',
    'data',
    'migrations',
    'rewrite',
    'reader',
    'verify',
    'counts-after'
  ])
  assert.deepEqual(result, { verified: true })
})

test('restore rebuilds only an existing target and rejects mismatched mode', async () => {
  const calls = []
  await restoreSeoDatabase({
    env: safeEnv(),
    argv: ['--confirm-newartspace-seo', '--rebuild-newartspace-seo'],
    dependencies: completeDependencies({
      targetExists: async () => true,
      rebuildTarget: async (database) => calls.push(database)
    })
  })
  assert.deepEqual(calls, ['"newartspace_seo"'])

  await assert.rejects(() =>
    restoreSeoDatabase({
      env: safeEnv(),
      argv: ['--confirm-newartspace-seo'],
      dependencies: completeDependencies({ targetExists: async () => true })
    })
  )
  await assert.rejects(() =>
    restoreSeoDatabase({
      env: safeEnv(),
      argv: ['--confirm-newartspace-seo', '--rebuild-newartspace-seo'],
      dependencies: completeDependencies({ targetExists: async () => false })
    })
  )
})

test('restore CLI adapter loads safe env, wires concrete dependencies and prints only verification aggregates', async () => {
  const output = []
  let received
  const report = await runRestoreCli({
    argv: ['--confirm-newartspace-seo'],
    dependencies: {
      backendRoot: '/backend',
      readFile: async () =>
        'SEO_SAFE_MODE=true\nPOSTGRES_NAME=newartspace_seo\n',
      createRestoreDependencies: ({ env }) => ({ marker: env.POSTGRES_NAME }),
      restoreSeoDatabase: async (input) => {
        received = input
        return { counts: { Paintings: 244 }, verified: true }
      },
      writeOutput: (value) => output.push(value)
    }
  })

  assert.equal(received.env.POSTGRES_NAME, 'newartspace_seo')
  assert.equal(received.dependencies.marker, 'newartspace_seo')
  assert.deepEqual(report, { counts: { Paintings: 244 }, verified: true })
  assert.match(output.join(''), /"Paintings":244/)
})

test('concrete restore adapters use exact local targets and isolated subprocess environments', async () => {
  const clientConfigs = []
  const queries = []
  const spawns = []
  class Client {
    constructor(config) {
      this.config = config
      clientConfigs.push(config)
    }
    async connect() {}
    async end() {}
    async query(sql) {
      queries.push({ database: this.config.database, sql })
      if (sql.includes('current_database()'))
        return {
          rows: [
            {
              current_database: 'newartspace_seo',
              inet_server_addr: '::1',
              inet_server_port: 5432
            }
          ]
        }
      if (sql.includes('AS "exists"')) return { rows: [{ exists: false }] }
      if (sql.startsWith('SELECT (SELECT COUNT'))
        return {
          rows: [
            {
              Paintings: 19,
              Artists: 13,
              Events: 4,
              EventsPhotos: 4,
              Users: 1,
              Orders: 71
            }
          ]
        }
      return { rows: [] }
    }
  }
  const spawn = (command, args, options) => {
    spawns.push({ command, args, options })
    return {
      once(event, callback) {
        if (event === 'close') callback(0)
      }
    }
  }
  const dependencies = await createRestoreDependencies({
    env: safeEnv(),
    backendRoot: '/backend',
    dependencies: {
      Client,
      pgRestorePath: '/local/bin/pg_restore',
      spawn
    }
  })

  assert.deepEqual(await dependencies.readNormalCounts(), {
    Paintings: 19,
    Artists: 13,
    Events: 4,
    EventsPhotos: 4,
    Users: 1,
    Orders: 71
  })
  assert.equal(await dependencies.targetExists(), false)
  await dependencies.createTarget('"newartspace_seo"')
  await dependencies.runCommand(buildSchemaRestoreArgs(), {
    PGPASSWORD: 'admin-secret',
    PGHOST: 'localhost',
    PGPORT: '5432',
    PGUSER: 'admin',
    PGDATABASE: 'newartspace_seo',
    LANG: 'C'
  })
  await dependencies.runMigrations()
  await dependencies.rewriteImages(['UPDATE "Paintings" SET "imgUrl" = NULL;'])
  await dependencies.configureReader()

  assert.ok(
    clientConfigs.every(
      (config) => config.host === 'localhost' && config.port === 5432
    )
  )
  assert.ok(
    queries.some(
      ({ database, sql }) =>
        database === 'postgres' && sql === 'CREATE DATABASE "newartspace_seo";'
    )
  )
  assert.equal(spawns[0].command, '/local/bin/pg_restore')
  assert.deepEqual(Object.keys(spawns[0].options.env).sort(), [
    'LANG',
    'PGDATABASE',
    'PGHOST',
    'PGPASSWORD',
    'PGPORT',
    'PGUSER'
  ])
  assert.equal(spawns[1].command, process.execPath)
  assert.equal(spawns[1].options.env.ACCESS_KEY_ID, undefined)
  assert.equal(spawns[1].options.env.PATH, undefined)
  assert.ok(
    queries.some(({ sql }) =>
      sql.includes('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
    )
  )
  assert.ok(
    queries.some(({ sql }) =>
      sql.includes('REVOKE TEMPORARY ON DATABASE "newartspace_seo" FROM PUBLIC')
    )
  )
  assert.equal(escapeSqlLiteral("reader'password"), "'reader''password'")
})
