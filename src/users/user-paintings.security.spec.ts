jest.mock(
  'src/users/users.service',
  () => jest.requireActual('./users.service'),
  { virtual: true }
)

import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as request from 'supertest'
import { AuthService } from '../auth/auth.service'
import { UsersService } from './users.service'
import { UserPaintingsController } from './user-paintings.controller'
import { UserPaintingsService } from './user-paintings.service'

// Real routes and JWT verification; only persistence is replaced.
describe('user-paintings ownership boundary', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'isolated-ownership-test-only' })
  const people = [
    { id: 11, email: 'owner@example.test', isAdmin: false },
    { id: 22, email: 'other@example.test', isAdmin: false },
    { id: 33, email: 'admin@example.test', isAdmin: true }
  ]
  const users = { findOneById: jest.fn(), findOne: jest.fn() }
  const data = { favorites: [7], cart: [8] }
  const service = {
    getUserPaintings: jest.fn(),
    updateUserPaintings: jest.fn()
  }
  const access = (id: number | string) => jwt.sign({ user: { id } })

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserPaintingsController],
      providers: [
        { provide: UserPaintingsService, useValue: service },
        { provide: UsersService, useValue: users },
        { provide: AuthService, useValue: new AuthService(users as never, jwt) }
      ]
    }).compile()
    app = module.createNestApplication({ logger: false })
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    await app.listen(0, '127.0.0.1')
  })
  afterAll(async () => {
    await app?.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
    users.findOneById.mockImplementation(async (id) =>
      people.find((user) => String(user.id) === id)
    )
    users.findOne.mockImplementation(async (email) =>
      people.find((user) => user.email === email)
    )
    service.getUserPaintings.mockResolvedValue(data)
    service.updateUserPaintings.mockImplementation(async (_id, body) => body)
  })

  it.each([
    ['anonymous', undefined, 11, 401],
    ['ordinary non-owner', access(22), 11, 403],
    ['owner', access(11), 11, 200],
    ['admin, other data', access(33), 11, 403],
    ['admin, own data', access(33), 33, 200],
    ['legacy numeric string owner id', access('11'), 11, 200]
  ] as const)('%s GET/PUT', async (_role, token, id, status) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const get = await request(app.getHttpServer())
      .get(`/user-paintings/${id}`)
      .set(headers)
      .expect(status)
    const put = await request(app.getHttpServer())
      .put(`/user-paintings/${id}`)
      .set(headers)
      .send(data)
      .expect(status)
    if (status === 200) {
      expect(get.body).toEqual(data)
      expect(put.body).toEqual(data)
      expect(service.getUserPaintings).toHaveBeenCalledWith(id)
      expect(service.updateUserPaintings).toHaveBeenCalledWith(id, data)
    } else {
      expect(service.getUserPaintings).not.toHaveBeenCalled()
      expect(service.updateUserPaintings).not.toHaveBeenCalled()
    }
  })

  it.each([
    'Basic ' + access(11),
    'Bearer',
    'Bearer malformed',
    'Bearer ' +
      new JwtService({ secret: 'wrong-test-key' }).sign({ user: { id: 11 } }),
    'Bearer ' + jwt.sign({ user: { id: 11 } }, { expiresIn: -1 }),
    'Bearer ' + jwt.sign({ userId: 11 }),
    ...[
      null,
      {},
      { user: {} },
      { user: { id: 0 } },
      { user: { id: 1.5 } },
      { user: { id: '11e0' } },
      { user: { id: '011' } },
      { user: { id: 9007199254740992 } },
      { user: { id: 44 } }
    ].map(
      (payload) =>
        'Bearer ' + jwt.sign(payload === null ? { user: null } : payload)
    )
  ])(
    'rejects invalid identity/header before private service access',
    async (header) => {
      for (const method of ['get', 'put'] as const) {
        const req = request(app.getHttpServer())
          [method]('/user-paintings/11')
          .set('Authorization', header)
        await (method === 'put' ? req.send(data) : req).expect(401)
      }
      expect(service.getUserPaintings).not.toHaveBeenCalled()
      expect(service.updateUserPaintings).not.toHaveBeenCalled()
    }
  )

  it.each(['0', '-1', '1.5', '11junk', '1e1', '9007199254740992', '011'])(
    'rejects unsafe route ID %s before private data access',
    async (id) => {
      for (const method of ['get', 'put'] as const) {
        const req = request(app.getHttpServer())
          [method](`/user-paintings/${id}`)
          .set('Authorization', `Bearer ${access(11)}`)
        await (method === 'put' ? req.send(data) : req).expect(400)
      }
      expect(service.getUserPaintings).not.toHaveBeenCalled()
      expect(service.updateUserPaintings).not.toHaveBeenCalled()
    }
  )

  it('verifies a signature before looking up a user', async () => {
    await request(app.getHttpServer())
      .get('/user-paintings/11')
      .set('Authorization', 'Bearer broken')
      .expect(401)
    expect(users.findOneById).not.toHaveBeenCalled()
    expect(users.findOne).not.toHaveBeenCalled()
  })

  it('rejects malformed PUT payload for the owner without writing', async () => {
    await request(app.getHttpServer())
      .put('/user-paintings/11')
      .set('Authorization', `Bearer ${access(11)}`)
      .send({ favorites: 'bad', cart: [8] })
      .expect(400)
    expect(service.updateUserPaintings).not.toHaveBeenCalled()
  })
})
