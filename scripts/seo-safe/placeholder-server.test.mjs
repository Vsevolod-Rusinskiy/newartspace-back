import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPlaceholderServer,
  parsePlaceholderPath
} from './placeholder-server.mjs'

const request = async (server, path, method = 'GET') => {
  const address = server.address()
  return fetch(`http://127.0.0.1:${address.port}${path}`, { method })
}

test('placeholder parser accepts only strict local image paths', () => {
  assert.deepEqual(
    parsePlaceholderPath('/seo-placeholders/paintings/42-portrait.png'),
    {
      entity: 'paintings',
      id: '42',
      variant: 'portrait'
    }
  )
  for (const path of [
    '/seo-placeholders/users/42-portrait.png',
    '/seo-placeholders/paintings/abc-portrait.png',
    '/seo-placeholders/paintings/42-portrait.png?x=1',
    '/../.env'
  ]) {
    assert.equal(parsePlaceholderPath(path), null)
  }
})

test('placeholder server returns PNG dimensions, empty HEAD and rejects writes', async (t) => {
  const server = createPlaceholderServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())

  for (const [variant, width, height] of [
    ['portrait', 480, 640],
    ['landscape', 640, 480],
    ['square', 512, 512]
  ]) {
    const response = await request(
      server,
      `/seo-placeholders/paintings/42-${variant}.png`
    )
    const body = Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.deepEqual(
      [...body.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10]
    )
    assert.equal(body.readUInt32BE(16), width)
    assert.equal(body.readUInt32BE(20), height)
  }

  const head = await request(
    server,
    '/seo-placeholders/about/1-landscape.png',
    'HEAD'
  )
  assert.equal(head.status, 200)
  assert.equal((await head.arrayBuffer()).byteLength, 0)
  assert.equal(
    (await request(server, '/seo-placeholders/paintings/abc-portrait.png'))
      .status,
    404
  )
  assert.equal(
    (
      await request(
        server,
        '/seo-placeholders/paintings/1-portrait.png',
        'POST'
      )
    ).status,
    405
  )
  assert.equal(server.address().address, '127.0.0.1')
})
