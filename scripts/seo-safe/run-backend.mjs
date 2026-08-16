import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import dotenv from 'dotenv'
import { buildRuntimeEnv } from './config.mjs'

export function buildBackendSpawn({ parsedLocalEnv, backendRoot, tempCwd }) {
  const env = buildRuntimeEnv(parsedLocalEnv)
  return {
    command: process.execPath,
    args: [join(backendRoot, 'dist', 'main.js')],
    options: { cwd: tempCwd, env, stdio: 'inherit' }
  }
}

export async function runBackend({ dependencies = {} } = {}) {
  const backendRoot =
    dependencies.backendRoot ||
    join(dirname(fileURLToPath(import.meta.url)), '../..')
  const localEnvPath = join(backendRoot, '.env.seo-safe.local')
  const mainPath = join(backendRoot, 'dist', 'main.js')
  await access(mainPath)
  const parsedLocalEnv = dotenv.parse(await readFile(localEnvPath, 'utf8'))
  const tempCwd = await mkdtemp(
    join(dependencies.tmpdir || '/tmp', 'newspace-seo-safe-backend-')
  )
  const command = buildBackendSpawn({ parsedLocalEnv, backendRoot, tempCwd })
  const launch = dependencies.spawn || spawn
  try {
    const child = launch(command.command, command.args, command.options)
    await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Safe backend exited with ${code}`))
      )
    })
  } finally {
    await rm(tempCwd, { recursive: true, force: true })
  }
}

export async function runBackendCli({ dependencies = {} } = {}) {
  const execute = dependencies.runBackend || runBackend
  return execute({ dependencies })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runBackendCli()
}
