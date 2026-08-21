import {
  assertDevCrudRuntimeDatabase,
  assertSeoSafeRuntimeDatabase,
  assertSeoSafeRuntimeEnvironment,
  resolveBackendListenOptions,
  resolveDatabaseSynchronize
} from './database-safety'

const safeEnv = () => ({
  SEO_SAFE_MODE: 'true',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_NAME: 'newartspace_seo',
  POSTGRES_USER: 'newartspace_seo_reader',
  POSTGRES_PASSWORD: 'reader-password',
  DB_SYNCHRONIZE: 'false',
  BUCKET_NAME: 'seo-storage-disabled',
  PORT: '3200',
  FRONTEND_URL: 'http://localhost:3201'
})

const devCrudEnv = () => ({
  DEV_CRUD_MODE: 'true',
  POSTGRES_HOST: 'localhost',
  POSTGRES_PORT: '5432',
  POSTGRES_NAME: 'newartspace',
  POSTGRES_USER: 'postgres',
  POSTGRES_PASSWORD: 'local-password',
  DB_SYNCHRONIZE: 'false',
  BUCKET_NAME: 'newartspace-images-dev',
  PORT: '3300',
  FRONTEND_URL: 'http://localhost:5173'
})

describe('database safety', () => {
  it('binds SEO_SAFE backend to loopback without changing ordinary listen defaults', () => {
    expect(resolveBackendListenOptions(safeEnv())).toEqual({
      port: '3200',
      host: '127.0.0.1'
    })
    expect(resolveBackendListenOptions({})).toEqual({ port: 3000 })
    expect(resolveBackendListenOptions({ PORT: '4100' })).toEqual({
      port: '4100'
    })
  })

  it('keeps ordinary synchronize default and requires false in SEO_SAFE', () => {
    expect(resolveDatabaseSynchronize({})).toBe(true)
    expect(resolveDatabaseSynchronize({ DB_SYNCHRONIZE: 'true' })).toBe(true)
    expect(resolveDatabaseSynchronize({ DB_SYNCHRONIZE: 'false' })).toBe(false)
    expect(() =>
      resolveDatabaseSynchronize({ SEO_SAFE_MODE: 'true' })
    ).toThrow()
  })

  it('binds DEV_CRUD to loopback and rejects the production bucket before startup', () => {
    expect(resolveBackendListenOptions(devCrudEnv())).toEqual({
      port: '3300',
      host: '127.0.0.1'
    })
    expect(() => resolveDatabaseSynchronize(devCrudEnv())).not.toThrow()
    expect(() =>
      resolveDatabaseSynchronize({
        ...devCrudEnv(),
        BUCKET_NAME: 'newartspace-images'
      })
    ).toThrow('DEV_CRUD requires BUCKET_NAME=newartspace-images-dev')
  })

  it.each([
    ['remote database', { POSTGRES_HOST: 'db.example.test' }],
    ['SEO database', { POSTGRES_NAME: 'newartspace_seo' }],
    ['schema synchronize', { DB_SYNCHRONIZE: 'true' }],
    ['SEO_SAFE at the same time', { SEO_SAFE_MODE: 'true' }]
  ])('rejects unsafe DEV_CRUD target: %s', (_label, override) => {
    expect(() =>
      resolveDatabaseSynchronize({ ...devCrudEnv(), ...override })
    ).toThrow()
  })

  it('rejects unsafe SEO_SAFE configuration before Nest starts', () => {
    expect(() => assertSeoSafeRuntimeEnvironment(safeEnv())).not.toThrow()
    expect(() =>
      assertSeoSafeRuntimeEnvironment({
        ...safeEnv(),
        POSTGRES_NAME: 'newartspace'
      })
    ).toThrow()
    expect(() =>
      assertSeoSafeRuntimeEnvironment({
        ...safeEnv(),
        POSTGRES_HOST: 'db.example.test'
      })
    ).toThrow()
    expect(() =>
      assertSeoSafeRuntimeEnvironment({
        ...safeEnv(),
        ACCESS_KEY_ID: 'not-allowed'
      })
    ).toThrow()
  })

  it('connects its fake runtime client only as the exact reader against loopback', async () => {
    const connect = jest.fn()
    const end = jest.fn()
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          current_database: 'newartspace_seo',
          inet_server_addr: '::1',
          inet_server_port: 5432
        }
      ]
    })
    const Client = jest
      .fn()
      .mockImplementation((config) => ({ connect, query, end, config }))

    await expect(
      assertSeoSafeRuntimeDatabase(safeEnv(), { Client })
    ).resolves.toBeUndefined()

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'newartspace_seo',
        host: 'localhost',
        port: 5432,
        user: 'newartspace_seo_reader'
      })
    )
    expect(query).toHaveBeenCalled()
    expect(end).toHaveBeenCalled()
  })

  it('verifies the exact DEV_CRUD database identity before Nest starts', async () => {
    const connect = jest.fn()
    const end = jest.fn()
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          current_database: 'newartspace',
          inet_server_addr: '127.0.0.1',
          inet_server_port: 5432
        }
      ]
    })
    const Client = jest
      .fn()
      .mockImplementation((config) => ({ connect, query, end, config }))

    await assertDevCrudRuntimeDatabase(devCrudEnv(), { Client })

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'newartspace',
        host: 'localhost',
        port: 5432,
        user: 'postgres'
      })
    )
    expect(query).toHaveBeenCalled()
    expect(end).toHaveBeenCalled()
  })
})
