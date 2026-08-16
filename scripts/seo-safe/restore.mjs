import {
  PUBLIC_DATA_TABLES,
  SEO_SAFE,
  assertStaticSeoSafeEnv
} from './config.mjs'
import { access, readFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import dotenv from 'dotenv'
import pg from 'pg'
import { runPreflight } from './preflight.mjs'
import { verifySeoDatabase } from './verify.mjs'

const { Client: PostgreSqlClient } = pg
const CONFIRM_FLAG = '--confirm-newartspace-seo'
const REBUILD_FLAG = '--rebuild-newartspace-seo'
const QUOTED_SEO_DATABASE = '"newartspace_seo"'
const NORMAL_COUNT_TABLES = [
  'Paintings',
  'Artists',
  'Events',
  'EventsPhotos',
  'Users',
  'Orders'
]
const REQUIRED_RESTORE_DEPENDENCIES = [
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

export function parseRestoreMode(argv) {
  if (argv.length === 1 && argv[0] === CONFIRM_FLAG) return 'create'
  if (
    argv.length === 2 &&
    argv[0] === CONFIRM_FLAG &&
    argv[1] === REBUILD_FLAG
  ) {
    return 'rebuild'
  }
  throw new Error('Restore requires exact SEO target confirmation')
}

function assertRestoreEnvironment(env) {
  assertStaticSeoSafeEnv(env)
  if (env.POSTGRES_ADMIN_DATABASE !== 'postgres')
    throw new Error('Restore admin database must be postgres')
  if (!env.POSTGRES_ADMIN_USER || !env.POSTGRES_ADMIN_PASSWORD)
    throw new Error('Restore requires local PostgreSQL admin credentials')
  if (env.POSTGRES_USER !== SEO_SAFE.readerRole || !env.POSTGRES_PASSWORD)
    throw new Error('Restore requires the exact SEO reader credentials')
}

function assertRestoreDependencies(dependencies) {
  for (const name of REQUIRED_RESTORE_DEPENDENCIES) {
    if (typeof dependencies?.[name] !== 'function')
      throw new Error(`Restore requires ${name}`)
  }
}

const normalizeCounts = (counts) =>
  Object.fromEntries(
    Object.entries(counts || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, Number(value)])
  )

export function escapeSqlLiteral(value) {
  const stringValue = String(value)
  if (stringValue.includes('\0')) throw new Error('Invalid SQL literal')
  return `'${stringValue.replaceAll("'", "''")}'`
}

export function buildSchemaRestoreArgs() {
  return [
    'pg_restore',
    `--dbname=${SEO_SAFE.database}`,
    '--schema-only',
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    SEO_SAFE.dumpPath
  ]
}

export function buildAllowlistedDataRestoreArgs() {
  return [
    'pg_restore',
    `--dbname=${SEO_SAFE.database}`,
    '--data-only',
    '--no-owner',
    '--no-acl',
    '--exit-on-error',
    '--disable-triggers',
    ...PUBLIC_DATA_TABLES.map((table) => `--table=${table}`),
    SEO_SAFE.dumpPath
  ]
}

export function buildImageRewriteStatements() {
  return [
    `UPDATE "Paintings" SET "imgUrl" = '${SEO_SAFE.placeholderOrigin}/seo-placeholders/paintings/' || id || '-' || CASE WHEN width IS NOT NULL AND height IS NOT NULL AND width < height THEN 'portrait' WHEN width IS NOT NULL AND height IS NOT NULL AND width > height THEN 'landscape' ELSE 'square' END || '.png';`,
    `UPDATE "Artists" SET "imgUrl" = '${SEO_SAFE.placeholderOrigin}/seo-placeholders/artists/' || id || '-portrait.png';`,
    `UPDATE "Events" SET "imgUrl" = '${SEO_SAFE.placeholderOrigin}/seo-placeholders/events/' || id || '-landscape.png';`,
    `UPDATE "EventsPhotos" SET "imgUrl" = '${SEO_SAFE.placeholderOrigin}/seo-placeholders/event-photos/' || id || '-landscape.png';`,
    `UPDATE "AboutPage" SET "imgUrl" = '${SEO_SAFE.placeholderOrigin}/seo-placeholders/about/' || id || '-landscape.png';`
  ]
}

export async function restoreSeoDatabase({ env, argv, dependencies }) {
  assertRestoreEnvironment(env)
  const mode = parseRestoreMode(argv)
  assertRestoreDependencies(dependencies)
  await dependencies.preflight()
  const normalBefore = normalizeCounts(await dependencies.readNormalCounts())
  const targetExists = await dependencies.targetExists()
  if (targetExists && mode !== 'rebuild')
    throw new Error('SEO target already exists; explicit rebuild is required')
  if (!targetExists && mode === 'rebuild')
    throw new Error('SEO target does not exist; rebuild is not allowed')
  if (targetExists) await dependencies.rebuildTarget(QUOTED_SEO_DATABASE)
  if (!targetExists) await dependencies.createTarget(QUOTED_SEO_DATABASE)
  const childEnv = {
    PGPASSWORD: env.POSTGRES_ADMIN_PASSWORD,
    PGHOST: env.POSTGRES_HOST,
    PGPORT: String(SEO_SAFE.port),
    PGUSER: env.POSTGRES_ADMIN_USER,
    PGDATABASE: SEO_SAFE.database,
    LANG: 'C'
  }
  await dependencies.runCommand(buildSchemaRestoreArgs(), childEnv)
  await dependencies.runCommand(buildAllowlistedDataRestoreArgs(), childEnv)
  await dependencies.runMigrations()
  await dependencies.rewriteImages(buildImageRewriteStatements())
  await dependencies.configureReader()
  const verification = await dependencies.verify()
  const normalAfter = normalizeCounts(await dependencies.readNormalCounts())
  if (JSON.stringify(normalBefore) !== JSON.stringify(normalAfter))
    throw new Error('Normal database counts changed')
  return verification
}

async function withClient({ env, Client, database, reader = false }, callback) {
  const client = new Client({
    host: env.POSTGRES_HOST,
    port: SEO_SAFE.port,
    database,
    user: reader ? SEO_SAFE.readerRole : env.POSTGRES_ADMIN_USER,
    password: reader ? env.POSTGRES_PASSWORD : env.POSTGRES_ADMIN_PASSWORD
  })
  try {
    await client.connect()
    return await callback(client)
  } finally {
    await client.end()
  }
}

async function runChild({ command, args, env, cwd, spawnImpl = spawn }) {
  await new Promise((resolve, reject) => {
    const child = spawnImpl(command, args, { cwd, env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`SEO_SAFE subprocess exited with ${code}`))
    })
  })
}

export async function resolveExecutable(
  name,
  { pathValue = process.env.PATH || '', accessImpl = access } = {}
) {
  for (const directory of pathValue.split(':').filter(Boolean)) {
    const candidate = join(directory, name)
    try {
      await accessImpl(candidate, fsConstants.X_OK)
      return candidate
    } catch {}
  }
  throw new Error(`Required local executable is unavailable: ${name}`)
}

export async function createRestoreDependencies({
  env,
  backendRoot,
  dependencies = {}
}) {
  assertRestoreEnvironment(env)
  const Client = dependencies.Client || PostgreSqlClient
  const pgRestorePath =
    dependencies.pgRestorePath ||
    (await resolveExecutable('pg_restore', {
      pathValue: dependencies.pathValue,
      accessImpl: dependencies.access
    }))
  const sequelizeCli = join(
    backendRoot,
    'node_modules',
    'sequelize-cli',
    'lib',
    'sequelize'
  )
  const configPath = join(backendRoot, 'src', 'config', 'config.js')
  const childSpawn = dependencies.spawn || spawn

  const adminClient = (database, callback) =>
    withClient({ env, Client, database }, callback)

  const assertExactTargetConnection = () =>
    adminClient(SEO_SAFE.database, async (client) => {
      const result = await client.query(
        'SELECT current_database(), inet_server_addr(), inet_server_port();'
      )
      const row = result.rows[0]
      if (
        row?.current_database !== SEO_SAFE.database ||
        !['127.0.0.1', '::1'].includes(String(row?.inet_server_addr)) ||
        Number(row?.inet_server_port) !== SEO_SAFE.port
      ) {
        throw new Error('SEO restore target verification failed')
      }
    })

  const readNormalCounts = () =>
    adminClient(SEO_SAFE.normalDatabase, async (client) => {
      const selections = NORMAL_COUNT_TABLES.map(
        (table) => `(SELECT COUNT(*)::int FROM "${table}") AS "${table}"`
      ).join(', ')
      const result = await client.query(`SELECT ${selections};`)
      return result.rows[0]
    })

  return {
    preflight: () => runPreflight({ env, Client }),
    readNormalCounts,
    targetExists: () =>
      adminClient('postgres', async (client) => {
        const result = await client.query(
          'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists";',
          [SEO_SAFE.database]
        )
        return Boolean(result.rows[0]?.exists)
      }),
    createTarget: (quotedDatabase) => {
      if (quotedDatabase !== QUOTED_SEO_DATABASE)
        throw new Error('Unexpected create target')
      return adminClient('postgres', (client) =>
        client.query('CREATE DATABASE "newartspace_seo";')
      )
    },
    rebuildTarget: async (quotedDatabase) => {
      if (quotedDatabase !== QUOTED_SEO_DATABASE)
        throw new Error('Unexpected rebuild target')
      await adminClient('postgres', async (client) => {
        await client.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();',
          [SEO_SAFE.database]
        )
        await client.query('DROP DATABASE "newartspace_seo";')
        await client.query('CREATE DATABASE "newartspace_seo";')
      })
    },
    runCommand: async (commandWithArgs, childEnv) => {
      if (commandWithArgs[0] !== 'pg_restore')
        throw new Error('Unexpected restore executable')
      await runChild({
        command: pgRestorePath,
        args: commandWithArgs.slice(1),
        env: childEnv,
        cwd: backendRoot,
        spawnImpl: childSpawn
      })
    },
    runMigrations: async () => {
      await assertExactTargetConnection()
      await runChild({
        command: process.execPath,
        args: [sequelizeCli, 'db:migrate', '--config', configPath],
        cwd: backendRoot,
        env: {
          POSTGRES_HOST: env.POSTGRES_HOST,
          POSTGRES_PORT: String(SEO_SAFE.port),
          POSTGRES_NAME: SEO_SAFE.database,
          POSTGRES_USER: env.POSTGRES_ADMIN_USER,
          POSTGRES_PASSWORD: env.POSTGRES_ADMIN_PASSWORD,
          SQL_DIALECT: 'postgres',
          SQL_LOGGING: 'false',
          DB_SYNCHRONIZE: 'false',
          LANG: 'C'
        },
        spawnImpl: childSpawn
      })
    },
    rewriteImages: async (statements) => {
      await assertExactTargetConnection()
      await adminClient(SEO_SAFE.database, async (client) => {
        await client.query('BEGIN')
        try {
          for (const statement of statements) await client.query(statement)
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        }
      })
    },
    configureReader: async () => {
      const password = escapeSqlLiteral(env.POSTGRES_PASSWORD)
      await adminClient('postgres', async (client) => {
        await client.query(`
          DO $seo_safe$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'newartspace_seo_reader') THEN
              CREATE ROLE "newartspace_seo_reader" LOGIN PASSWORD ${password};
            ELSE
              ALTER ROLE "newartspace_seo_reader" LOGIN PASSWORD ${password};
            END IF;
          END
          $seo_safe$;
        `)
        await client.query(
          'ALTER ROLE "newartspace_seo_reader" NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;'
        )
        await client.query(
          'REVOKE CONNECT ON DATABASE "newartspace" FROM "newartspace_seo_reader";'
        )
        await client.query(
          'GRANT CONNECT ON DATABASE "newartspace_seo" TO "newartspace_seo_reader";'
        )
        await client.query(
          'REVOKE CREATE, TEMPORARY ON DATABASE "newartspace_seo" FROM "newartspace_seo_reader";'
        )
        await client.query(
          'REVOKE TEMPORARY ON DATABASE "newartspace_seo" FROM PUBLIC;'
        )
      })
      await adminClient(SEO_SAFE.database, async (client) => {
        await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC;')
        await client.query(
          'REVOKE ALL ON SCHEMA public FROM "newartspace_seo_reader";'
        )
        await client.query(
          'GRANT USAGE ON SCHEMA public TO "newartspace_seo_reader";'
        )
        await client.query(
          'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "newartspace_seo_reader";'
        )
        await client.query(
          'GRANT SELECT ON ALL TABLES IN SCHEMA public TO "newartspace_seo_reader";'
        )
        await client.query(
          'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM "newartspace_seo_reader";'
        )
        await client.query(
          'GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO "newartspace_seo_reader";'
        )
      })
    },
    verify: () => verifySeoDatabase({ env, dependencies: { Client } })
  }
}

export async function runRestoreCli({
  argv = process.argv.slice(2),
  dependencies = {}
} = {}) {
  const backendRoot =
    dependencies.backendRoot ||
    join(dirname(fileURLToPath(import.meta.url)), '../..')
  const read = dependencies.readFile || readFile
  const env = dotenv.parse(
    await read(join(backendRoot, '.env.seo-safe.local'), 'utf8')
  )
  const buildDependencies =
    dependencies.createRestoreDependencies || createRestoreDependencies
  const restoreDependencies = await buildDependencies({
    env,
    backendRoot,
    dependencies
  })
  const execute = dependencies.restoreSeoDatabase || restoreSeoDatabase
  const report = await execute({ env, argv, dependencies: restoreDependencies })
  const write =
    dependencies.writeOutput || ((value) => process.stdout.write(value))
  write(`${JSON.stringify(report)}\n`)
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runRestoreCli()
}
