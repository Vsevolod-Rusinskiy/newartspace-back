import { randomBytes } from 'node:crypto'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import dotenv from 'dotenv'
import { SEO_SAFE, parseExactConfirmation } from './config.mjs'

const REPLACE_FLAG = '--replace-newartspace-seo-env'

export function parseInitEnvMode(argv) {
  if (parseExactConfirmation(argv)) return 'create'
  if (
    argv.length === 2 &&
    argv[0] === '--confirm-newartspace-seo' &&
    argv[1] === REPLACE_FLAG
  ) {
    return 'replace'
  }
  throw new Error('Exact confirmation is required')
}

export function serializeDotenvValue(value) {
  const stringValue = String(value)
  if (stringValue.includes('\0')) throw new Error('Invalid local env value')
  const candidates = [
    stringValue,
    `\`${stringValue}\``,
    `'${stringValue}'`,
    `"${stringValue}"`
  ]
  for (const candidate of candidates) {
    if (dotenv.parse(`VALUE=${candidate}`).VALUE === stringValue)
      return candidate
  }
  throw new Error('Local env value cannot be serialized safely')
}

const envLine = (key, value) => `${key}=${serializeDotenvValue(value)}`

export async function createSeoSafeEnv({
  sourcePath,
  targetPath,
  argv,
  dependencies = {}
}) {
  const mode = parseInitEnvMode(argv)
  const replace = mode === 'replace'
  if (existsSync(targetPath) && !replace)
    throw new Error('Refusing to replace existing SEO_SAFE env')
  const parsedSource = dotenv.parse(await readFile(sourcePath, 'utf8'))
  if (!parsedSource.POSTGRES_USER || !parsedSource.POSTGRES_PASSWORD) {
    throw new Error('Local PostgreSQL setup credentials are required')
  }
  const makeRandomBytes = dependencies.randomBytes || randomBytes
  const lines = [
    envLine('SEO_SAFE_MODE', 'true'),
    envLine('POSTGRES_HOST', SEO_SAFE.host),
    envLine('POSTGRES_PORT', SEO_SAFE.port),
    envLine('POSTGRES_NAME', SEO_SAFE.database),
    envLine('POSTGRES_USER', SEO_SAFE.readerRole),
    envLine('POSTGRES_PASSWORD', makeRandomBytes(32).toString('base64url')),
    envLine('POSTGRES_ADMIN_DATABASE', 'postgres'),
    envLine('POSTGRES_ADMIN_USER', parsedSource.POSTGRES_USER),
    envLine('POSTGRES_ADMIN_PASSWORD', parsedSource.POSTGRES_PASSWORD),
    envLine('SQL_DIALECT', 'postgres'),
    envLine('SQL_LOGGING', 'false'),
    envLine('DB_SYNCHRONIZE', 'false'),
    envLine('BUCKET_NAME', SEO_SAFE.storageBucketSentinel),
    envLine('PORT', '3200'),
    envLine('FRONTEND_URL', SEO_SAFE.frontendOrigin),
    envLine('JWSECRET', 'seo-safe-local-only-not-for-production'),
    ''
  ]
  await writeFile(targetPath, lines.join('\n'), { mode: 0o600 })
  await chmod(targetPath, 0o600)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = new URL('../..', import.meta.url)
  await createSeoSafeEnv({
    sourcePath: new URL('.env', root),
    targetPath: new URL('.env.seo-safe.local', root),
    argv: process.argv.slice(2)
  })
}
