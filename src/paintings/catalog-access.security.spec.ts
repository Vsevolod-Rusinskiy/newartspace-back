jest.mock(
  'src/users/users.service',
  () => ({ UsersService: class UsersService {} }),
  { virtual: true }
)
jest.mock(
  'src/auth/guards/admin-jwt.guard',
  () => jest.requireActual('../auth/guards/admin-jwt.guard'),
  { virtual: true }
)

import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as request from 'supertest'
import { AuthService } from '../auth/auth.service'
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard'
import { PaintingsController } from './paintings.controller'
import { PaintingsService } from './paintings.service'
import { ArtistsController } from '../artists/artists.controller'
import { ArtistsService } from '../artists/artists.service'
import { StorageService } from '../common/services/storage.service'
import { CacheRevalidationPublisher } from '../common/cache-revalidation/cache-revalidation.publisher'

// Real route/guard/JWT verification, with DB and storage replaced at the boundary.
// Supertest uses only an ephemeral local HTTP listener; no application bootstrap.
describe('catalog role matrix', () => {
  let app: INestApplication
  const jwt = new JwtService({ secret: 'isolated-catalog-test-only' })
  const users = [
    { id: 1, email: 'regular@example.test', isAdmin: false },
    { id: 2, email: 'owner@example.test', isAdmin: false },
    { id: 3, email: 'admin@example.test', isAdmin: true }
  ]
  const paintings = {
    count: jest.fn().mockResolvedValue(0),
    findAll: jest.fn().mockResolvedValue([])
  }
  const artists = {
    findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 })
  }

  beforeAll(async () => {
    const auth = new AuthService(
      {
        findOne: async (email: string) =>
          users.find((user) => user.email === email),
        findOneById: async (id: string) =>
          users.find((user) => String(user.id) === id)
      } as never,
      jwt
    )
    const module = await Test.createTestingModule({
      controllers: [PaintingsController, ArtistsController],
      providers: [
        {
          provide: PaintingsService,
          useValue: new PaintingsService(
            paintings as never,
            {} as never,
            {} as never,
            {} as never,
            {} as never
          )
        },
        {
          provide: ArtistsService,
          useValue: new ArtistsService(
            artists as never,
            {} as never,
            {} as never
          )
        },
        { provide: AuthService, useValue: auth },
        AdminJwtGuard,
        { provide: StorageService, useValue: {} },
        {
          provide: CacheRevalidationPublisher,
          useValue: { schedule: jest.fn() }
        }
      ]
    }).compile()
    app = module.createNestApplication({ logger: false })
    await app.init()
  })
  afterAll(async () => {
    await app?.close()
  })
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    ['anonymous', undefined, 401],
    ['ordinary user', 0, 401],
    ['data owner', 1, 401],
    ['administrator', 2, 200]
  ] as const)(
    '%s keeps public catalog access and admin boundary',
    async (_role, index, expected) => {
      const headers =
        index === undefined
          ? {}
          : { Authorization: `Bearer ${jwt.sign({ user: users[index] })}` }
      for (const path of ['/paintings', '/artists']) {
        const response = await request(app.getHttpServer())
          .get(path)
          .query({ sort: '["priority","ASC"]', page: 1, limit: 24 })
          .set(headers)
          .expect(200)
        expect(response.body).toMatchObject({
          data: [],
          total: 0,
          pageCount: 0
        })
      }
      await request(app.getHttpServer())
        .get('/paintings/admin')
        .query({ page: 1, limit: 24 })
        .set(headers)
        .expect(expected)
      const scopes = paintings.findAll.mock.calls.map(
        ([options]) => options.where
      )
      expect(scopes[0]).toEqual({ isHidden: false })
      expect(scopes).toHaveLength(expected === 200 ? 2 : 1)
      if (expected === 200) expect(scopes[1]).toEqual({})
    }
  )

  it('returns HTTP 400 for unsafe sorting before repository access', async () => {
    for (const path of ['/paintings', '/artists']) {
      await request(app.getHttpServer())
        .get(path)
        .query({ sort: '["title\\" --","ASC"]' })
        .expect(400)
    }
    expect(paintings.count).not.toHaveBeenCalled()
    expect(artists.findAndCountAll).not.toHaveBeenCalled()
  })
})
