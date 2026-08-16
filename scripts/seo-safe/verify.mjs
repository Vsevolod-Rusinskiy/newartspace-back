import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import {
  PRIVATE_DATA_TABLES,
  SEO_SAFE,
  assertStaticSeoSafeEnv
} from './config.mjs'

const { Client: PostgreSqlClient } = pg

const expectedCounts = {
  Paintings: 244,
  Artists: 29,
  Attributes: 379,
  PaintingAttributes: 540,
  Events: 2,
  EventsPhotos: 0,
  AboutPage: 1,
  Welcomes: 8,
  WorkingHours: 1
}

const expectedPrivateCounts = Object.fromEntries(
  PRIVATE_DATA_TABLES.map((table) => [table, 0])
)

const permissionProbes = {
  insert: 'INSERT INTO "Paintings" ("id") VALUES (-2147483648);',
  update: 'UPDATE "Paintings" SET "title" = "title" WHERE false;',
  delete: 'DELETE FROM "Paintings" WHERE false;',
  truncate: 'TRUNCATE TABLE "Paintings";',
  createTable: 'CREATE TABLE "seo_safe_permission_probe" (id integer);'
}

const numberRow = (row) =>
  Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key, Number(value)])
  )

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`

async function isPermissionDenied(client, statement) {
  await client.query('BEGIN')
  try {
    await client.query(statement)
    return false
  } catch (error) {
    return error?.code === '42501'
  } finally {
    await client.query('ROLLBACK')
  }
}

export async function collectVerification({ adminClient, readerClient }) {
  const databaseServerResult = await adminClient.query(`
    /* seo-safe:database-server */
    SELECT current_database(), inet_server_addr(), inet_server_port();
  `)
  const countsResult = await adminClient.query(`
    /* seo-safe:counts */
    SELECT
      (SELECT COUNT(*)::int FROM "Paintings") AS "Paintings",
      (SELECT COUNT(*)::int FROM "Artists") AS "Artists",
      (SELECT COUNT(*)::int FROM "Attributes") AS "Attributes",
      (SELECT COUNT(*)::int FROM "PaintingAttributes") AS "PaintingAttributes",
      (SELECT COUNT(*)::int FROM "Events") AS "Events",
      (SELECT COUNT(*)::int FROM "EventsPhotos") AS "EventsPhotos",
      (SELECT COUNT(*)::int FROM "AboutPage") AS "AboutPage",
      (SELECT COUNT(*)::int FROM "Welcomes") AS "Welcomes",
      (SELECT COUNT(*)::int FROM "WorkingHours") AS "WorkingHours";
  `)
  const privateResult = await adminClient.query(`
    /* seo-safe:private-counts */
    SELECT
      (SELECT COUNT(*)::int FROM "Users") AS "Users",
      (SELECT COUNT(*)::int FROM "UserPaintings") AS "UserPaintings",
      (SELECT COUNT(*)::int FROM "Orders") AS "Orders",
      (SELECT COUNT(*)::int FROM "OrderItems") AS "OrderItems",
      (SELECT COUNT(*)::int FROM "OrderStatuses") AS "OrderStatuses";
  `)
  const imageResult = await adminClient.query(`
    /* seo-safe:image-urls */
    WITH image_urls(url, expected_pattern) AS (
      SELECT "imgUrl", '^http://localhost:3101/seo-placeholders/paintings/[0-9]+-(portrait|landscape|square)\\.png$' FROM "Paintings" WHERE "imgUrl" IS NOT NULL
      UNION ALL
      SELECT "imgUrl", '^http://localhost:3101/seo-placeholders/artists/[0-9]+-portrait\\.png$' FROM "Artists" WHERE "imgUrl" IS NOT NULL
      UNION ALL
      SELECT "imgUrl", '^http://localhost:3101/seo-placeholders/events/[0-9]+-landscape\\.png$' FROM "Events" WHERE "imgUrl" IS NOT NULL
      UNION ALL
      SELECT "imgUrl", '^http://localhost:3101/seo-placeholders/event-photos/[0-9]+-landscape\\.png$' FROM "EventsPhotos" WHERE "imgUrl" IS NOT NULL
      UNION ALL
      SELECT "imgUrl", '^http://localhost:3101/seo-placeholders/about/[0-9]+-landscape\\.png$' FROM "AboutPage" WHERE "imgUrl" IS NOT NULL
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT url)::int AS "distinct",
      COUNT(*) FILTER (WHERE url !~ expected_pattern)::int AS invalid
    FROM image_urls;
  `)
  const textColumnsResult = await adminClient.query(`
    /* seo-safe:text-columns */
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character', 'character varying')
    ORDER BY table_name, ordinal_position;
  `)
  let productionUrls = 0
  for (const column of textColumnsResult.rows) {
    const table = quoteIdentifier(column.table_name)
    const field = quoteIdentifier(column.column_name)
    const result = await adminClient.query(
      `/* seo-safe:production-url-count */ SELECT COUNT(*)::int AS count FROM ${table} WHERE ${field} ILIKE $1 OR ${field} ILIKE $2;`,
      ['%storage.yandexcloud.net%', '%newartspace-images%']
    )
    productionUrls += Number(result.rows[0]?.count || 0)
  }
  const paintingResult = await adminClient.query(`
    /* seo-safe:painting-185 */
    SELECT COUNT(*)::int AS count
    FROM "Paintings"
    WHERE id = 185 AND "artistId" IS NULL;
  `)
  const migrationResult = await adminClient.query(
    `/* seo-safe:slug-migration */ SELECT COUNT(*)::int AS count FROM "SequelizeMeta" WHERE name = $1;`,
    ['20260814000000-remove-unused-slug-fields.js']
  )
  const slugColumnsResult = await adminClient.query(`
    /* seo-safe:slug-columns */
    SELECT COUNT(*)::int AS count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Paintings', 'Artists')
      AND column_name = 'slug';
  `)
  const roleResult = await readerClient.query(`
    /* seo-safe:reader-role */
    SELECT current_user, session_user;
  `)
  await readerClient.query(
    '/* seo-safe:reader-select */ SELECT 1 AS ok FROM "Paintings" LIMIT 1;'
  )
  const readerPermissionChecks = {}
  for (const [name, statement] of Object.entries(permissionProbes)) {
    readerPermissionChecks[name] = await isPermissionDenied(
      readerClient,
      statement
    )
  }
  const imageRow = imageResult.rows[0] || {}
  const roleRow = roleResult.rows[0] || {}
  const databaseServerRow = databaseServerResult.rows[0] || {}
  const readerWriteDenied = Object.values(readerPermissionChecks).every(Boolean)
  return {
    database: SEO_SAFE.database,
    dumpSha256: SEO_SAFE.dumpSha256,
    placeholderOrigin: SEO_SAFE.placeholderOrigin,
    backendOrigin: SEO_SAFE.backendOrigin,
    frontendOrigin: SEO_SAFE.frontendOrigin,
    databaseIsExact: databaseServerRow.current_database === SEO_SAFE.database,
    serverIsLoopback:
      ['127.0.0.1', '::1'].includes(
        String(databaseServerRow.inet_server_addr)
      ) && Number(databaseServerRow.inet_server_port) === SEO_SAFE.port,
    counts: numberRow(countsResult.rows[0]),
    privateCounts: numberRow(privateResult.rows[0]),
    imageUrlTotal: Number(imageRow.total),
    imageUrlDistinct: Number(imageRow.distinct),
    allImageUrlsAreLocal: Number(imageRow.invalid) === 0,
    productionUrls,
    painting185WithoutArtist: Number(paintingResult.rows[0]?.count),
    readerCanSelect: true,
    readerRoleIsExact:
      roleRow.current_user === SEO_SAFE.readerRole &&
      roleRow.session_user === SEO_SAFE.readerRole,
    readerPermissionChecks,
    readerWriteDenied,
    slugMigrationApplied: Number(migrationResult.rows[0]?.count) === 1,
    slugColumnsAbsent: Number(slugColumnsResult.rows[0]?.count) === 0
  }
}

export function assertVerification(report) {
  if (
    report.database !== SEO_SAFE.database ||
    report.dumpSha256 !== SEO_SAFE.dumpSha256 ||
    report.placeholderOrigin !== SEO_SAFE.placeholderOrigin ||
    report.backendOrigin !== SEO_SAFE.backendOrigin ||
    report.frontendOrigin !== SEO_SAFE.frontendOrigin ||
    !report.databaseIsExact ||
    !report.serverIsLoopback
  ) {
    throw new Error('SEO verification provenance failed')
  }
  for (const [table, count] of Object.entries(expectedCounts)) {
    if (report.counts?.[table] !== count)
      throw new Error(`Unexpected ${table} count`)
  }
  for (const [table, count] of Object.entries(expectedPrivateCounts)) {
    if (report.privateCounts?.[table] !== count)
      throw new Error(`Unexpected private ${table} count`)
  }
  if (
    report.imageUrlTotal !== 276 ||
    report.imageUrlDistinct !== 276 ||
    !report.allImageUrlsAreLocal ||
    report.productionUrls !== 0
  )
    throw new Error('Image URL isolation failed')
  if (
    report.painting185WithoutArtist !== 1 ||
    !report.readerCanSelect ||
    !report.readerRoleIsExact ||
    !report.readerWriteDenied ||
    !report.slugMigrationApplied ||
    !report.slugColumnsAbsent
  )
    throw new Error('SEO dataset verification failed')
  for (const name of Object.keys(permissionProbes)) {
    if (report.readerPermissionChecks?.[name] !== true)
      throw new Error(`Reader ${name} permission is unsafe`)
  }
}

export async function verifySeoDatabase({ env, dependencies }) {
  assertStaticSeoSafeEnv(env)
  if (
    env.POSTGRES_NAME !== SEO_SAFE.database ||
    env.POSTGRES_USER !== SEO_SAFE.readerRole ||
    !env.POSTGRES_PASSWORD ||
    !env.POSTGRES_ADMIN_USER ||
    !env.POSTGRES_ADMIN_PASSWORD
  ) {
    throw new Error('Unexpected verification configuration')
  }
  if (dependencies?.collectReport) {
    const report = await dependencies.collectReport()
    assertVerification(report)
    return report
  }
  const Client = dependencies?.Client || PostgreSqlClient
  const adminClient = new Client({
    host: env.POSTGRES_HOST,
    port: SEO_SAFE.port,
    database: SEO_SAFE.database,
    user: env.POSTGRES_ADMIN_USER,
    password: env.POSTGRES_ADMIN_PASSWORD
  })
  const readerClient = new Client({
    host: env.POSTGRES_HOST,
    port: SEO_SAFE.port,
    database: SEO_SAFE.database,
    user: SEO_SAFE.readerRole,
    password: env.POSTGRES_PASSWORD
  })
  try {
    await adminClient.connect()
    await readerClient.connect()
    const report = await collectVerification({ adminClient, readerClient })
    assertVerification(report)
    return report
  } finally {
    await Promise.allSettled([adminClient.end(), readerClient.end()])
  }
}

export async function runVerifyCli({ dependencies = {} } = {}) {
  const backendRoot =
    dependencies.backendRoot ||
    join(dirname(fileURLToPath(import.meta.url)), '../..')
  const read = dependencies.readFile || readFile
  const env = dotenv.parse(
    await read(join(backendRoot, '.env.seo-safe.local'), 'utf8')
  )
  const execute = dependencies.verifySeoDatabase || verifySeoDatabase
  const report = await execute({ env, dependencies })
  const write =
    dependencies.writeOutput || ((value) => process.stdout.write(value))
  write(`${JSON.stringify(report)}\n`)
  return report
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runVerifyCli()
}
