jest.mock('./constants', () => ({
  jwtConstants: { secret: 'isolated-jwt-stage-test-only' }
}))

import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Sequelize } from 'sequelize-typescript'
import * as request from 'supertest'
import * as bcrypt from 'bcryptjs'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { UsersService } from '../users/users.service'
import { User } from '../users/models/user.model'
import { ProfileController } from '../profile/profile.controller'
import { ProfileService } from '../profile/profile.service'
import { PaintingsController } from '../paintings/paintings.controller'
import { PaintingsService } from '../paintings/paintings.service'
import { UserPaintingsController } from '../users/user-paintings.controller'
import { UserPaintingsService } from '../users/user-paintings.service'
import { StorageService } from '../common/services/storage.service'
import { CacheRevalidationPublisher } from '../common/cache-revalidation/cache-revalidation.publisher'

const jwt = new JwtService({
  secret: 'isolated-jwt-stage-test-only',
  signOptions: { expiresIn: '7h' }
})
const wrongJwt = new JwtService({ secret: 'wrong-test-signature-only' })
const password = 'isolated-login-password'
const hash = bcrypt.hashSync(password, 4)
const owner = {
  id: 11,
  email: 'owner@example.test',
  userName: 'Owner',
  isAdmin: false,
  isEmailVerified: true,
  userPassword: hash
}
const other = { ...owner, id: 22, email: 'other@example.test' }
const admin = { ...owner, id: 33, email: 'admin@example.test', isAdmin: true }
const legacy = (user: typeof owner) => jwt.sign({ user })
const minimal = (id: number | string) => jwt.sign({ user: { id } })
const refresh = (id: number | string) =>
  jwt.sign({ userId: id }, { expiresIn: '30d' })

// Real Sequelize serialization but no connection/query/sync.
describe('new JWT allowlist', () => {
  it('signs only the stable user ID, never the serialized Sequelize model', async () => {
    const db = new Sequelize({
      dialect: 'postgres',
      logging: false,
      models: [User]
    })
    try {
      const user = User.build({
        ...owner,
        verificationToken: 'synthetic-verification-value',
        resetPasswordToken: 'synthetic-reset-value',
        resetPasswordExpires: new Date('2099-01-01')
      })
      const service = new AuthService({} as never, jwt)
      const { accessToken } = await service.generateAccessToken(user)
      const claims = jwt.verify(accessToken)
      expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'user'])
      expect(claims.user).toEqual({ id: 11 })
      expect(claims.exp - claims.iat).toBe(25200)
      for (const field of [
        'userPassword',
        'verificationToken',
        'resetPasswordToken',
        'resetPasswordExpires',
        'email',
        'userName',
        'isAdmin'
      ])
        expect(claims.user).not.toHaveProperty(field)
    } finally {
      await db.close()
    }
  })
})

// Real controllers/guards/signature verification. Only persistence and side effects
// are replaced. No real user/credential, DB, email, storage or external HTTP.
describe('JWT consumer compatibility and rejection boundary', () => {
  let app: INestApplication
  let service: AuthService
  let people: Array<typeof owner>
  let log: jest.SpyInstance
  const users = {
    findOne: jest.fn(async (email) =>
      people.find((user) => user.email === email)
    ),
    findOneById: jest.fn(async (id) =>
      people.find((user) => String(user.id) === id)
    ),
    login: jest.fn(async ({ email }) =>
      people.find((user) => user.email === email)
    )
  }
  const profile = {
    getUserInfo: jest.fn(async (id) => ({ id })),
    updateProfile: jest.fn(async (id) => ({ id })),
    getUserPurchases: jest.fn(async (id) => [{ userId: id }])
  }
  const cart = {
    getUserPaintings: jest.fn(async () => ({ favorites: [701], cart: [702] })),
    updateUserPaintings: jest.fn(async (_id, body) => body)
  }
  const paintings = {
    getAllSortedPaintings: jest.fn(async () => ({ data: [], total: 0 }))
  }
  beforeAll(async () => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    service = new AuthService(users as never, jwt)
    const module = await Test.createTestingModule({
      controllers: [
        AuthController,
        ProfileController,
        PaintingsController,
        UserPaintingsController
      ],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: UsersService, useValue: users },
        { provide: ProfileService, useValue: profile },
        { provide: UserPaintingsService, useValue: cart },
        { provide: PaintingsService, useValue: paintings },
        { provide: StorageService, useValue: {} },
        {
          provide: CacheRevalidationPublisher,
          useValue: { schedule: jest.fn() }
        }
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
    log?.mockRestore()
  })
  beforeEach(() => {
    people = [{ ...owner }, { ...other }, { ...admin }]
    jest.clearAllMocks()
  })

  it.each(['minimal', 'legacy'] as const)(
    '%s access works across profile/purchases/admin/owner',
    async (kind) => {
      const token = kind === 'minimal' ? minimal(11) : legacy(owner)
      const info = await request(app.getHttpServer())
        .get('/profile/info')
        .auth(token, { type: 'bearer' })
        .expect(200)
      expect(info.body).toEqual({ id: 11 })
      const patch = await request(app.getHttpServer())
        .patch('/profile/info')
        .auth(token, { type: 'bearer' })
        .send({ userName: 'Updated' })
        .expect(200)
      expect(patch.body).toEqual({ id: 11 })
      const purchases = await request(app.getHttpServer())
        .get('/profile/purchases')
        .auth(token, { type: 'bearer' })
        .expect(200)
      expect(purchases.body).toEqual([{ userId: 11 }])
      await request(app.getHttpServer())
        .get('/user-paintings/11')
        .auth(token, { type: 'bearer' })
        .expect(200)
      await request(app.getHttpServer())
        .get('/user-paintings/22')
        .auth(token, { type: 'bearer' })
        .expect(403)
      await request(app.getHttpServer())
        .get('/paintings/admin')
        .auth(token, { type: 'bearer' })
        .expect(401)
      const adminToken = kind === 'minimal' ? minimal(33) : legacy(admin)
      await request(app.getHttpServer())
        .get('/paintings/admin')
        .auth(adminToken, { type: 'bearer' })
        .expect(200)
      await request(app.getHttpServer())
        .get('/user-paintings/11')
        .auth(adminToken, { type: 'bearer' })
        .expect(403)
    }
  )

  it('uses verified stable ID even when legacy email/isAdmin point at a different account', async () => {
    const token = jwt.sign({
      user: { id: 11, email: admin.email, isAdmin: true }
    })
    const result = await request(app.getHttpServer())
      .get('/profile/info')
      .auth(token, { type: 'bearer' })
      .expect(200)
    expect(result.body).toEqual({ id: 11 })
    await request(app.getHttpServer())
      .get('/paintings/admin')
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('rechecks current DB admin status instead of trusting legacy role claims', async () => {
    const token = legacy(admin)
    people.find((user) => user.id === 33)!.isAdmin = false
    await request(app.getHttpServer())
      .get('/paintings/admin')
      .auth(token, { type: 'bearer' })
      .expect(401)
  })

  it('keeps exact login/refresh outer fields, durations and original refresh while issuing minimal access', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, userPassword: password })
      .expect(200)
    expect(Object.keys(login.body).sort()).toEqual([
      'accessToken',
      'isAdmin',
      'refreshToken',
      'userId',
      'userName'
    ])
    expect(login.body).toMatchObject({
      userId: 11,
      userName: 'Owner',
      isAdmin: false
    })
    const accessClaims = jwt.verify(login.body.accessToken),
      refreshClaims = jwt.verify(login.body.refreshToken)
    expect(accessClaims.user).toEqual({ id: 11 })
    expect(accessClaims.exp - accessClaims.iat).toBe(25200)
    expect(refreshClaims.userId).toBe(11)
    expect(refreshClaims.exp - refreshClaims.iat).toBe(2592000)
    const renewed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200)
    expect(Object.keys(renewed.body).sort()).toEqual([
      'accessToken',
      'isAdmin',
      'refreshToken',
      'userName'
    ])
    expect(renewed.body).toMatchObject({
      refreshToken: login.body.refreshToken,
      userName: 'Owner',
      isAdmin: false
    })
    expect(jwt.verify(renewed.body.accessToken).user).toEqual({ id: 11 })
  })

  it('renews an existing valid legacy refresh without requiring new claims', async () => {
    const token = refresh('11')
    const result = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: token })
      .expect(200)
    expect(result.body.refreshToken).toBe(token)
    expect(jwt.verify(result.body.accessToken).user).toEqual({ id: 11 })
  })

  const invalidAccess = [
    undefined,
    'Bearer',
    'Bearer malformed',
    'Basic ' + legacy(owner),
    'Bearer ' + wrongJwt.sign({ user: owner }),
    'Bearer ' + jwt.sign({ user: owner }, { expiresIn: -1 }),
    'Bearer ' + refresh(11),
    ...[
      undefined,
      null,
      0,
      -1,
      1.5,
      '011',
      '11e0',
      '11junk',
      9007199254740992
    ].map((id) => 'Bearer ' + jwt.sign({ user: { id } }))
  ]
  it.each(invalidAccess)(
    'rejects invalid access before user lookup/private service',
    async (header) => {
      for (const path of [
        '/profile/info',
        '/paintings/admin',
        '/user-paintings/11'
      ]) {
        const req = request(app.getHttpServer()).get(path)
        await (header ? req.set('Authorization', header) : req).expect(401)
      }
      expect(users.findOne).not.toHaveBeenCalled()
      expect(users.findOneById).not.toHaveBeenCalled()
      expect(profile.getUserInfo).not.toHaveBeenCalled()
      expect(cart.getUserPaintings).not.toHaveBeenCalled()
      expect(paintings.getAllSortedPaintings).not.toHaveBeenCalled()
    }
  )

  it.each([
    undefined,
    null,
    11,
    'malformed',
    wrongJwt.sign({ userId: 11 }),
    jwt.sign({ userId: 11 }, { expiresIn: -1 }),
    legacy(owner),
    minimal(11),
    ...[
      undefined,
      null,
      0,
      -1,
      1.5,
      '011',
      '11e0',
      '11junk',
      9007199254740992
    ].map((userId) => jwt.sign({ userId }))
  ])('rejects invalid refresh before any user lookup', async (token) => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send(token === undefined ? {} : { refreshToken: token })
      .expect(401)
    expect(users.findOneById).not.toHaveBeenCalled()
    expect(users.findOne).not.toHaveBeenCalled()
  })

  it('preserves jwt expired message so opaque-token clients can refresh', async () => {
    const token = jwt.sign({ user: { id: 11 } }, { expiresIn: -1 })
    for (const path of [
      '/profile/info',
      '/paintings/admin',
      '/user-paintings/11'
    ]) {
      const result = await request(app.getHttpServer())
        .get(path)
        .auth(token, { type: 'bearer' })
        .expect(401)
      expect(result.body.message).toBe('jwt expired')
    }
  })

  it('denies deleted users for profile, admin, ownership and refresh', async () => {
    for (const path of [
      '/profile/info',
      '/paintings/admin',
      '/user-paintings/44'
    ])
      await request(app.getHttpServer())
        .get(path)
        .auth(minimal(44), { type: 'bearer' })
        .expect(401)
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refresh(44) })
      .expect(401)
    expect(profile.getUserInfo).not.toHaveBeenCalled()
    expect(cart.getUserPaintings).not.toHaveBeenCalled()
    expect(paintings.getAllSortedPaintings).not.toHaveBeenCalled()
  })

  it('the reusable user resolver itself rejects an unverified signature before lookup', async () => {
    await expect(
      service.getUserEmailByTokenData(wrongJwt.sign({ user: owner }))
    ).rejects.toMatchObject({ status: 401 })
    expect(users.findOne).not.toHaveBeenCalled()
    expect(users.findOneById).not.toHaveBeenCalled()
  })
})
