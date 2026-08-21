const SEO_DATABASE = 'newartspace_seo'
const SEO_READER = 'newartspace_seo_reader'
const SEO_BUCKET_SENTINEL = 'seo-storage-disabled'
const DEV_CRUD_DATABASE = 'newartspace'
const DEV_CRUD_BUCKET = 'newartspace-images-dev'
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

interface PgClientLike {
  connect(): Promise<void>
  query(query: string): Promise<{ rows: Array<Record<string, unknown>> }>
  end(): Promise<void>
}

interface RuntimeDependencies {
  Client?: new (config: Record<string, unknown>) => PgClientLike
}

export function isSeoSafeMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SEO_SAFE_MODE === 'true'
}

export function isDevCrudMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEV_CRUD_MODE === 'true'
}

export function resolveBackendListenOptions(
  env: NodeJS.ProcessEnv = process.env
): { port: string | number; host?: string } {
  const port = env.PORT || 3000
  return isSeoSafeMode(env) || isDevCrudMode(env)
    ? { port, host: '127.0.0.1' }
    : { port }
}

export function resolveDatabaseSynchronize(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (isSeoSafeMode(env)) {
    assertSeoSafeRuntimeEnvironment(env)
    return false
  }
  if (isDevCrudMode(env)) {
    assertDevCrudRuntimeEnvironment(env)
    return false
  }
  return env.DB_SYNCHRONIZE !== 'false'
}

export function assertDevCrudRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!isDevCrudMode(env)) return
  if (isSeoSafeMode(env)) {
    throw new Error('DEV_CRUD cannot run with SEO_SAFE')
  }
  if (!LOOPBACK_HOSTS.has(env.POSTGRES_HOST || '')) {
    throw new Error('DEV_CRUD requires a loopback PostgreSQL host')
  }
  const expected = {
    POSTGRES_PORT: '5432',
    POSTGRES_NAME: DEV_CRUD_DATABASE,
    DB_SYNCHRONIZE: 'false',
    BUCKET_NAME: DEV_CRUD_BUCKET,
    PORT: '3300',
    FRONTEND_URL: 'http://localhost:5173'
  }
  for (const [key, value] of Object.entries(expected)) {
    if (env[key] !== value) throw new Error(`DEV_CRUD requires ${key}=${value}`)
  }
}

export function assertSeoSafeRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (!isSeoSafeMode(env)) return
  const expected = {
    POSTGRES_PORT: '5432',
    POSTGRES_NAME: SEO_DATABASE,
    POSTGRES_USER: SEO_READER,
    DB_SYNCHRONIZE: 'false',
    BUCKET_NAME: SEO_BUCKET_SENTINEL,
    PORT: '3200',
    FRONTEND_URL: 'http://localhost:3201'
  }
  if (!LOOPBACK_HOSTS.has(env.POSTGRES_HOST || '')) {
    throw new Error('SEO_SAFE requires a loopback PostgreSQL host')
  }
  for (const [key, value] of Object.entries(expected)) {
    if (env[key] !== value) throw new Error(`SEO_SAFE requires ${key}=${value}`)
  }
  for (const key of [
    'ACCESS_KEY_ID',
    'SECRET_ACCESS_KEY',
    'YOUR_BOT_TOKEN',
    'CHAT_ID',
    'NODEMAILER_EMAIL',
    'NODEMAILER_PASSWORD'
  ]) {
    if (env[key]) throw new Error(`SEO_SAFE forbids ${key}`)
  }
}

export async function assertSeoSafeRuntimeDatabase(
  env: NodeJS.ProcessEnv = process.env,
  dependencies: RuntimeDependencies = {}
): Promise<void> {
  if (!isSeoSafeMode(env)) return
  assertSeoSafeRuntimeEnvironment(env)
  const Client =
    dependencies.Client ||
    (PostgreSqlClient as unknown as new (
      config: Record<string, unknown>
    ) => PgClientLike)
  const client = new Client({
    host: env.POSTGRES_HOST,
    port: 5432,
    database: SEO_DATABASE,
    user: SEO_READER,
    password: env.POSTGRES_PASSWORD
  })
  try {
    await client.connect()
    const result = await client.query(
      'select current_database(), inet_server_addr(), inet_server_port();'
    )
    const row = result.rows[0]
    if (
      row?.current_database !== SEO_DATABASE ||
      !['127.0.0.1', '::1'].includes(String(row?.inet_server_addr)) ||
      Number(row?.inet_server_port) !== 5432
    ) {
      throw new Error('SEO_SAFE database server verification failed')
    }
  } finally {
    await client.end()
  }
}

export async function assertDevCrudRuntimeDatabase(
  env: NodeJS.ProcessEnv = process.env,
  dependencies: RuntimeDependencies = {}
): Promise<void> {
  if (!isDevCrudMode(env)) return
  assertDevCrudRuntimeEnvironment(env)
  const Client =
    dependencies.Client ||
    (PostgreSqlClient as unknown as new (
      config: Record<string, unknown>
    ) => PgClientLike)
  const client = new Client({
    host: env.POSTGRES_HOST,
    port: 5432,
    database: DEV_CRUD_DATABASE,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD
  })
  try {
    await client.connect()
    const result = await client.query(
      'select current_database(), inet_server_addr(), inet_server_port();'
    )
    const row = result.rows[0]
    if (
      row?.current_database !== DEV_CRUD_DATABASE ||
      !['127.0.0.1', '::1'].includes(String(row?.inet_server_addr)) ||
      Number(row?.inet_server_port) !== 5432
    ) {
      throw new Error('DEV_CRUD database server verification failed')
    }
  } finally {
    await client.end()
  }
}
import { Client as PostgreSqlClient } from 'pg'
