import {
  assertDumpIdentity,
  assertLoopbackServerRow,
  assertStaticSeoSafeEnv,
  SEO_SAFE
} from './config.mjs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const { Client: PostgreSqlClient } = pg

function assertAdminEnvironment(env) {
  if (env.POSTGRES_ADMIN_DATABASE !== 'postgres')
    throw new Error('SEO_SAFE admin connection must use postgres')
  if (!env.POSTGRES_ADMIN_USER || !env.POSTGRES_ADMIN_PASSWORD)
    throw new Error('SEO_SAFE local PostgreSQL admin credentials are required')
}

export async function inspectLocalPostgres({ env, Client }) {
  assertAdminEnvironment(env)
  const client = new Client({
    host: env.POSTGRES_HOST,
    port: SEO_SAFE.port,
    database: 'postgres',
    user: env.POSTGRES_ADMIN_USER,
    password: env.POSTGRES_ADMIN_PASSWORD
  })
  try {
    await client.connect()
    const result = await client.query(
      "select current_database(), inet_server_addr(), inet_server_port(), exists(select 1 from pg_database where datname = 'newartspace_seo') as target_exists;"
    )
    const row = result.rows[0]
    assertLoopbackServerRow(row)
    if (row.current_database !== 'postgres')
      throw new Error('Admin connection must use postgres')
    return row
  } finally {
    await client.end()
  }
}

export async function runPreflight({ env, Client, fs, crypto }) {
  assertStaticSeoSafeEnv(env)
  assertAdminEnvironment(env)
  if (env.POSTGRES_NAME !== SEO_SAFE.database)
    throw new Error('Unexpected target database')
  await assertDumpIdentity({
    stat: fs?.stat,
    createReadStream: fs?.createReadStream,
    crypto
  })
  return inspectLocalPostgres({ env, Client })
}

export async function runPreflightCli({ dependencies = {} } = {}) {
  const backendRoot =
    dependencies.backendRoot ||
    join(dirname(fileURLToPath(import.meta.url)), '../..')
  const read = dependencies.readFile || readFile
  const parsed = dotenv.parse(
    await read(join(backendRoot, '.env.seo-safe.local'), 'utf8')
  )
  const execute = dependencies.runPreflight || runPreflight
  const row = await execute({
    env: parsed,
    Client: dependencies.Client || PostgreSqlClient
  })
  const report = {
    currentDatabase: row.current_database,
    serverAddress: row.inet_server_addr,
    serverPort: Number(row.inet_server_port),
    targetExists: Boolean(row.target_exists),
    dumpPath: SEO_SAFE.dumpPath,
    dumpSize: SEO_SAFE.dumpSize,
    dumpSha256: SEO_SAFE.dumpSha256
  }
  const write =
    dependencies.writeOutput || ((value) => process.stdout.write(value))
  write(`${JSON.stringify(report)}\n`)
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runPreflightCli()
}
