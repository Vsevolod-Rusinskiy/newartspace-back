import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export const SEO_SAFE = Object.freeze({
  database: 'newartspace_seo',
  normalDatabase: 'newartspace',
  readerRole: 'newartspace_seo_reader',
  host: 'localhost',
  port: 5432,
  backendOrigin: 'http://localhost:3200',
  frontendOrigin: 'http://localhost:3201',
  placeholderOrigin: 'http://localhost:3101',
  storageBucketSentinel: 'seo-storage-disabled',
  dumpPath:
    '/Users/vsevolodrusinskiy/My-folder/Development/newartspace/BD_from_hosting/dump/backup_20260814_110001.dump',
  dumpSize: 100794,
  dumpSha256: '6b853f7a747ef59b4ccb3b438316d215b3a96c666026828c11970ea734b4b6df'
})

export const PUBLIC_DATA_TABLES = Object.freeze([
  'Artists',
  'Attributes',
  'PaintingAttributes',
  'Paintings',
  'Events',
  'EventsPhotos',
  'AboutPage',
  'Welcomes',
  'WorkingHours',
  'SequelizeMeta'
])

export const PRIVATE_DATA_TABLES = Object.freeze([
  'Users',
  'UserPaintings',
  'Orders',
  'OrderItems',
  'OrderStatuses'
])

const forbiddenCredentials = [
  'ACCESS_KEY_ID',
  'SECRET_ACCESS_KEY',
  'YOUR_BOT_TOKEN',
  'CHAT_ID',
  'NODEMAILER_EMAIL',
  'NODEMAILER_PASSWORD'
]

export function assertStaticSeoSafeEnv(env) {
  const expected = {
    SEO_SAFE_MODE: 'true',
    POSTGRES_PORT: String(SEO_SAFE.port),
    POSTGRES_NAME: SEO_SAFE.database,
    DB_SYNCHRONIZE: 'false',
    BUCKET_NAME: SEO_SAFE.storageBucketSentinel,
    PORT: '3200',
    FRONTEND_URL: SEO_SAFE.frontendOrigin
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(env.POSTGRES_HOST)) {
    throw new Error('SEO_SAFE requires a loopback POSTGRES_HOST')
  }
  for (const [key, value] of Object.entries(expected)) {
    if (env[key] !== value) throw new Error(`SEO_SAFE requires ${key}=${value}`)
  }
  for (const key of forbiddenCredentials) {
    if (env[key]) throw new Error(`SEO_SAFE forbids ${key}`)
  }
}

export function assertLoopbackServerRow(row) {
  if (!row || !['127.0.0.1', '::1'].includes(row.inet_server_addr)) {
    throw new Error('PostgreSQL server is not loopback')
  }
  if (Number(row.inet_server_port) !== SEO_SAFE.port) {
    throw new Error('PostgreSQL server port is not allowed')
  }
}

export async function assertDumpIdentity(dependencies = {}) {
  const dumpPath = dependencies.path || SEO_SAFE.dumpPath
  if (dumpPath !== SEO_SAFE.dumpPath) throw new Error('Unexpected dump path')
  const fileStat = await (dependencies.stat || stat)(dumpPath)
  if (fileStat.size !== SEO_SAFE.dumpSize)
    throw new Error('Unexpected dump size')
  const hash = createHash('sha256')
  for await (const chunk of (dependencies.createReadStream || createReadStream)(
    dumpPath
  )) {
    hash.update(chunk)
  }
  if (hash.digest('hex') !== SEO_SAFE.dumpSha256)
    throw new Error('Unexpected dump hash')
}

export function parseExactConfirmation(argv) {
  return argv.length === 1 && argv[0] === '--confirm-newartspace-seo'
}

export function buildRuntimeEnv(parsedLocalEnv) {
  const keys = [
    'SEO_SAFE_MODE',
    'POSTGRES_HOST',
    'POSTGRES_PORT',
    'POSTGRES_NAME',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'SQL_DIALECT',
    'SQL_LOGGING',
    'DB_SYNCHRONIZE',
    'BUCKET_NAME',
    'PORT',
    'FRONTEND_URL',
    'JWSECRET'
  ]
  const runtimeEnv = Object.fromEntries(
    keys
      .filter((key) => parsedLocalEnv[key] !== undefined)
      .map((key) => [key, parsedLocalEnv[key]])
  )
  assertStaticSeoSafeEnv(runtimeEnv)
  return runtimeEnv
}
