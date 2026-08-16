import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import dotenv from 'dotenv'
import { createSeoSafeEnv } from './init-env.mjs'

test('env generator writes only safe runtime values and refuses replacement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'seo-safe-env-'))
  const sourcePath = join(directory, '.env')
  const targetPath = join(directory, '.env.seo-safe.local')
  await writeFile(
    sourcePath,
    'POSTGRES_USER=local-admin\nPOSTGRES_PASSWORD=local-password\nACCESS_KEY_ID=must-not-copy\n'
  )

  await createSeoSafeEnv({
    sourcePath,
    targetPath,
    argv: ['--confirm-newartspace-seo'],
    dependencies: {
      randomBytes: () => Buffer.from('deterministic-reader-password')
    }
  })

  const contents = await readFile(targetPath, 'utf8')
  assert.match(contents, /^SEO_SAFE_MODE=true/m)
  assert.match(contents, /^POSTGRES_NAME=newartspace_seo/m)
  assert.match(contents, /^POSTGRES_USER=newartspace_seo_reader/m)
  assert.doesNotMatch(contents, /ACCESS_KEY_ID|must-not-copy/)
  assert.equal((await stat(targetPath)).mode & 0o777, 0o600)
  await assert.rejects(() =>
    createSeoSafeEnv({
      sourcePath,
      targetPath,
      argv: ['--confirm-newartspace-seo']
    })
  )

  await createSeoSafeEnv({
    sourcePath,
    targetPath,
    argv: ['--confirm-newartspace-seo', '--replace-newartspace-seo-env'],
    dependencies: { randomBytes: () => Buffer.from('next-password') }
  })

  for (const argv of [
    ['--replace-newartspace-seo-env', '--unexpected'],
    ['--confirm-newartspace-seo', '--replace-newartspace-seo-env', '--extra'],
    ['--replace-newartspace-seo-env']
  ]) {
    await assert.rejects(() =>
      createSeoSafeEnv({ sourcePath, targetPath, argv })
    )
  }
})

test('env generator preserves special characters without exposing extra values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'seo-safe-env-special-'))
  const sourcePath = join(directory, '.env')
  const targetPath = join(directory, '.env.seo-safe.local')
  const adminPassword = 'local # password with "quotes" and \\slashes'
  await writeFile(
    sourcePath,
    `POSTGRES_USER=\`local-admin\`\nPOSTGRES_PASSWORD=\`${adminPassword}\`\n`
  )

  await createSeoSafeEnv({
    sourcePath,
    targetPath,
    argv: ['--confirm-newartspace-seo'],
    dependencies: { randomBytes: () => Buffer.from('reader-password') }
  })

  const parsed = dotenv.parse(await readFile(targetPath, 'utf8'))
  assert.equal(parsed.POSTGRES_ADMIN_PASSWORD, adminPassword)
  assert.equal(parsed.POSTGRES_ADMIN_USER, 'local-admin')
})
