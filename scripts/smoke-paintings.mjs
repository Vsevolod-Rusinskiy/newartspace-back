#!/usr/bin/env node
/**
 * Prod smoke check: paintings catalog + image files in Object Storage.
 *
 * Usage:
 *   node scripts/smoke-paintings.mjs
 *   API_URL=https://back.newartspace.ru SITE_URL=https://newartspace.ru node scripts/smoke-paintings.mjs
 *
 * Exit 0 — all checks passed; exit 1 — failures found.
 */

const API_URL = process.env.API_URL || 'https://back.newartspace.ru'
const SITE_URL = process.env.SITE_URL || 'https://newartspace.ru'
const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY || 8)
const SAMPLE_PAGES = Number(process.env.SMOKE_SAMPLE_PAGES || 15)

const FILE_TITLE_RE = /^(IMG_\d|\S+\.(jpe?g|png|gif|webp|heic)$)/i

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status}`)
  }
  return res.json()
}

async function headOk(url) {
  try {
    const head = await fetch(url, { method: 'HEAD' })
    if (head.status === 200) return { ok: true, status: 200 }
    // Some storages answer HEAD poorly — fall back to GET range
    const get = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' }
    })
    return {
      ok: get.status === 200 || get.status === 206,
      status: get.status
    }
  } catch (error) {
    return { ok: false, status: 0, error: String(error.message || error) }
  }
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )
  return results
}

async function main() {
  const failures = []
  const warnings = []

  console.log(`Smoke paintings\n  API:  ${API_URL}\n  SITE: ${SITE_URL}\n`)

  const payload = await fetchJson(
    `${API_URL}/paintings?limit=500&page=1&sort=${encodeURIComponent(JSON.stringify(['id', 'ASC']))}`
  )
  const paintings = payload.data || []
  const total = payload.total ?? paintings.length

  console.log(`Fetched ${paintings.length} paintings (total reported: ${total})`)

  if (!paintings.length) {
    failures.push('Catalog returned 0 paintings')
  }

  const withoutUrl = paintings.filter((p) => !p.imgUrl)
  if (withoutUrl.length) {
    failures.push(
      `${withoutUrl.length} paintings without imgUrl: ids ${withoutUrl
        .map((p) => p.id)
        .join(', ')}`
    )
  }

  const badTitles = paintings.filter((p) => FILE_TITLE_RE.test(String(p.title || '').trim()))
  if (badTitles.length) {
    warnings.push(
      `${badTitles.length} titles look like filenames: ids ${badTitles
        .slice(0, 20)
        .map((p) => p.id)
        .join(', ')}${badTitles.length > 20 ? '…' : ''}`
    )
  }

  const withUrl = paintings.filter((p) => p.imgUrl)
  const imageChecks = await mapPool(withUrl, CONCURRENCY, async (p) => {
    const result = await headOk(p.imgUrl)
    return { id: p.id, ...result, imgUrl: p.imgUrl }
  })

  const brokenImages = imageChecks.filter((r) => !r.ok)
  if (brokenImages.length) {
    failures.push(
      `${brokenImages.length} broken image URLs (not 200/206):\n` +
        brokenImages
          .slice(0, 30)
          .map((r) => `  id=${r.id} status=${r.status} ${r.imgUrl}`)
          .join('\n') +
        (brokenImages.length > 30 ? `\n  …and ${brokenImages.length - 30} more` : '')
    )
  } else {
    console.log(`Images OK: ${withUrl.length}/${withUrl.length}`)
  }

  const sample = [...paintings]
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(SAMPLE_PAGES, paintings.length))

  const pageChecks = await mapPool(sample, CONCURRENCY, async (p) => {
    const url = `${SITE_URL}/paintings/${p.id}-smoke`
    try {
      const res = await fetch(url, { redirect: 'follow' })
      return { id: p.id, status: res.status, ok: res.status === 200 }
    } catch (error) {
      return { id: p.id, status: 0, ok: false, error: String(error.message || error) }
    }
  })

  const brokenPages = pageChecks.filter((r) => !r.ok)
  if (brokenPages.length) {
    failures.push(
      `${brokenPages.length}/${sample.length} sample painting pages failed:\n` +
        brokenPages
          .map((r) => `  id=${r.id} status=${r.status}${r.error ? ` ${r.error}` : ''}`)
          .join('\n')
    )
  } else {
    console.log(`Sample pages OK: ${sample.length}/${sample.length}`)
  }

  for (const w of warnings) {
    console.warn(`WARN: ${w}`)
  }

  if (failures.length) {
    console.error('\nFAILED:')
    for (const f of failures) console.error(`- ${f}`)
    process.exit(1)
  }

  console.log('\nAll smoke checks passed.')
}

main().catch((error) => {
  console.error('Smoke script crashed:', error)
  process.exit(1)
})
