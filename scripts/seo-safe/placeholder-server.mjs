import { createServer } from 'node:http'
import { deflateSync } from 'node:zlib'

const variants = {
  portrait: { width: 480, height: 640, rgba: [224, 214, 202, 255] },
  landscape: { width: 640, height: 480, rgba: [205, 217, 222, 255] },
  square: { width: 512, height: 512, rgba: [218, 210, 225, 255] }
}
const pathPattern =
  /^\/seo-placeholders\/(paintings|artists|events|event-photos|about)\/(\d+)-(portrait|landscape|square)\.png$/

const crc32 = (buffer) => {
  let value = 0xffffffff
  for (const byte of buffer) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(data.length, 0)
  header.write(type, 4, 4, 'ascii')
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 0)
  return Buffer.concat([header, data, checksum])
}

export function createSolidPng({ width, height, rgba }) {
  const row = Buffer.alloc(1 + width * 4)
  for (let x = 0; x < width; x += 1) row.set(rgba, 1 + x * 4)
  const pixels = Buffer.concat(Array.from({ length: height }, () => row))
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

export function parsePlaceholderPath(pathname) {
  const match = pathPattern.exec(pathname)
  if (!match) return null
  return { entity: match[1], id: match[2], variant: match[3] }
}

export function createPlaceholderServer() {
  const png = Object.fromEntries(
    Object.entries(variants).map(([variant, details]) => [
      variant,
      createSolidPng(details)
    ])
  )
  return createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method || '')) {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end()
      return
    }
    if (!request.url || request.url.includes('?')) {
      response.writeHead(404)
      response.end()
      return
    }
    const parsed = parsePlaceholderPath(request.url)
    if (!parsed) {
      response.writeHead(404)
      response.end()
      return
    }
    const body = png[parsed.variant]
    response.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': body.length
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createPlaceholderServer().listen(3101, '127.0.0.1')
}
