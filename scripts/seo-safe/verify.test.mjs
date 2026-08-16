import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertVerification,
  collectVerification,
  runVerifyCli,
  verifySeoDatabase
} from './verify.mjs'

const validReport = () => ({
  database: 'newartspace_seo',
  dumpSha256:
    '6b853f7a747ef59b4ccb3b438316d215b3a96c666026828c11970ea734b4b6df',
  placeholderOrigin: 'http://localhost:3101',
  backendOrigin: 'http://localhost:3200',
  frontendOrigin: 'http://localhost:3201',
  databaseIsExact: true,
  serverIsLoopback: true,
  counts: {
    Paintings: 244,
    Artists: 29,
    Attributes: 379,
    PaintingAttributes: 540,
    Events: 2,
    EventsPhotos: 0,
    AboutPage: 1,
    Welcomes: 8,
    WorkingHours: 1
  },
  privateCounts: {
    Users: 0,
    UserPaintings: 0,
    Orders: 0,
    OrderItems: 0,
    OrderStatuses: 0
  },
  imageUrlTotal: 276,
  imageUrlDistinct: 276,
  allImageUrlsAreLocal: true,
  productionUrls: 0,
  painting185WithoutArtist: 1,
  readerCanSelect: true,
  readerRoleIsExact: true,
  readerPermissionChecks: {
    insert: true,
    update: true,
    delete: true,
    truncate: true,
    createTable: true
  },
  readerWriteDenied: true,
  slugMigrationApplied: true,
  slugColumnsAbsent: true
})

test('verification rejects private rows, production URLs and missing read-only gates', () => {
  const report = validReport()
  assert.doesNotThrow(() => assertVerification(report))
  assert.throws(() =>
    assertVerification({
      ...report,
      privateCounts: { ...report.privateCounts, Orders: 1 }
    })
  )
  assert.throws(() => assertVerification({ ...report, productionUrls: 1 }))
  assert.throws(() => assertVerification({ ...report, privateCounts: {} }))
  assert.throws(() =>
    assertVerification({
      ...report,
      readerPermissionChecks: {
        ...report.readerPermissionChecks,
        truncate: false
      }
    })
  )

  for (const changed of [
    { databaseIsExact: false },
    { serverIsLoopback: false },
    { counts: { ...report.counts, Paintings: 243 } },
    { imageUrlTotal: 275 },
    { imageUrlDistinct: 275 },
    { allImageUrlsAreLocal: false },
    { painting185WithoutArtist: 0 },
    { readerCanSelect: false },
    { readerRoleIsExact: false },
    { slugMigrationApplied: false },
    { slugColumnsAbsent: false }
  ]) {
    assert.throws(() => assertVerification({ ...report, ...changed }))
  }
})

test('collector derives every aggregate gate from admin and reader queries', async () => {
  const adminQueries = []
  const readerQueries = []
  const adminClient = {
    async query(sql) {
      adminQueries.push(sql)
      if (sql.includes('seo-safe:database-server'))
        return {
          rows: [
            {
              current_database: 'newartspace_seo',
              inet_server_addr: '::1',
              inet_server_port: 5432
            }
          ]
        }
      if (sql.includes('seo-safe:counts'))
        return { rows: [validReport().counts] }
      if (sql.includes('seo-safe:private-counts'))
        return { rows: [validReport().privateCounts] }
      if (sql.includes('seo-safe:image-urls'))
        return { rows: [{ total: 276, distinct: 276, invalid: 0 }] }
      if (sql.includes('seo-safe:text-columns'))
        return { rows: [{ table_name: 'Paintings', column_name: 'title' }] }
      if (sql.includes('seo-safe:production-url-count'))
        return { rows: [{ count: 0 }] }
      if (sql.includes('seo-safe:painting-185')) return { rows: [{ count: 1 }] }
      if (sql.includes('seo-safe:slug-migration'))
        return { rows: [{ count: 1 }] }
      if (sql.includes('seo-safe:slug-columns')) return { rows: [{ count: 0 }] }
      throw new Error(`Unexpected admin query: ${sql}`)
    }
  }
  const readerClient = {
    async query(sql) {
      readerQueries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('seo-safe:reader-role'))
        return {
          rows: [
            {
              current_user: 'newartspace_seo_reader',
              session_user: 'newartspace_seo_reader'
            }
          ]
        }
      if (sql.includes('seo-safe:reader-select')) return { rows: [{ ok: 1 }] }
      const error = new Error('permission denied')
      error.code = '42501'
      throw error
    }
  }

  const report = await collectVerification({ adminClient, readerClient })

  assert.deepEqual(report, validReport())
  assert.doesNotThrow(() => assertVerification(report))
  assert.ok(adminQueries.some((sql) => sql.includes('information_schema')))
  assert.equal(readerQueries.filter((sql) => sql === 'BEGIN').length, 5)
  assert.equal(readerQueries.filter((sql) => sql === 'ROLLBACK').length, 5)
})

test('collector reports a reader permission as unsafe when a write probe succeeds', async () => {
  const report = validReport()
  report.readerPermissionChecks.truncate = false
  report.readerWriteDenied = false
  assert.throws(() => assertVerification(report))
})

test('verify CLI adapter loads safe env and emits aggregate JSON only', async () => {
  const output = []
  let receivedEnv
  const expected = validReport()
  const report = await runVerifyCli({
    dependencies: {
      backendRoot: '/backend',
      readFile: async () =>
        'POSTGRES_NAME=newartspace_seo\nPOSTGRES_PASSWORD=reader-secret\n',
      verifySeoDatabase: async ({ env }) => {
        receivedEnv = env
        return expected
      },
      writeOutput: (value) => output.push(value)
    }
  })

  assert.equal(receivedEnv.POSTGRES_PASSWORD, 'reader-secret')
  assert.deepEqual(report, expected)
  assert.doesNotMatch(output.join(''), /reader-secret|POSTGRES_PASSWORD/)
  assert.match(output.join(''), /"imageUrlTotal":276/)
})

test('verification accepts only the exact safe target before collecting a report', async () => {
  const env = {
    SEO_SAFE_MODE: 'true',
    POSTGRES_HOST: 'localhost',
    POSTGRES_PORT: '5432',
    POSTGRES_NAME: 'newartspace_seo',
    POSTGRES_USER: 'newartspace_seo_reader',
    POSTGRES_PASSWORD: 'reader-secret',
    POSTGRES_ADMIN_USER: 'admin',
    POSTGRES_ADMIN_PASSWORD: 'admin-secret',
    DB_SYNCHRONIZE: 'false',
    BUCKET_NAME: 'seo-storage-disabled',
    PORT: '3200',
    FRONTEND_URL: 'http://localhost:3201'
  }
  await assert.doesNotReject(() =>
    verifySeoDatabase({
      env,
      dependencies: { collectReport: async () => validReport() }
    })
  )
  await assert.rejects(() =>
    verifySeoDatabase({
      env: { ...env, POSTGRES_NAME: 'newartspace' },
      dependencies: { collectReport: async () => validReport() }
    })
  )
})
