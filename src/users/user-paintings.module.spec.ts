jest.mock('../auth/constants', () => ({
  jwtConstants: { secret: 'isolated-module-security-test-only' }
}))

import { Test } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { getModelToken } from '@nestjs/sequelize'
import * as request from 'supertest'
import * as bcrypt from 'bcryptjs'
import { UserPaintingsModule } from './user-paintings.module'
import { UsersService } from './users.service'
import { User } from './models/user.model'
import { UserPainting } from './models/user-paintings.model'
import { Painting } from '../paintings/models/painting.model'
import { MailService } from '../mail/mail.service'

// Actual feature/auth modules and services. Only DB/mail are replaced; no env,
// DB credentials, application bootstrap or external calls are used.
describe('UserPaintingsModule login/refresh/data integration', () => {
  let app: INestApplication
  let rows: Array<{ userId: number; paintingId: number; type: string }>
  const owner = {
    id: 11,
    email: 'owner@example.test',
    userName: 'Owner',
    isAdmin: false,
    isEmailVerified: true,
    userPassword: bcrypt.hashSync('isolated-test-password', 4)
  }
  const other = { ...owner, id: 22, email: 'other@example.test' }
  const model = {
    findAll: jest.fn(async ({ where }) =>
      rows.filter((row) => row.userId === where.userId)
    ),
    destroy: jest.fn(async ({ where }) => {
      rows = rows.filter((row) => row.userId !== where.userId)
    }),
    bulkCreate: jest.fn(async (records) => {
      rows.push(...records)
    })
  }
  const users = {
    findOne: jest.fn(async (email) =>
      [owner, other].find((user) => user.email === email)
    ),
    findOneById: jest.fn(async (id) =>
      [owner, other].find((user) => String(user.id) === id)
    ),
    login: jest.fn(async ({ email }) =>
      [owner, other].find((user) => user.email === email)
    )
  }
  let log: jest.SpyInstance
  beforeAll(async () => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const module = await Test.createTestingModule({
      imports: [UserPaintingsModule]
    })
      .overrideProvider(UsersService)
      .useValue(users)
      .overrideProvider(MailService)
      .useValue({ sendMail: jest.fn() })
      .overrideProvider(getModelToken(User))
      .useValue({})
      .overrideProvider(getModelToken(UserPainting))
      .useValue(model)
      .overrideProvider(getModelToken(Painting))
      .useValue({ findAll: async () => [{ id: 701 }, { id: 702 }] })
      .compile()
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
    rows = [
      { userId: 11, paintingId: 701, type: 'favorite' },
      { userId: 22, paintingId: 702, type: 'cart' }
    ]
    jest.clearAllMocks()
  })

  it('login -> owner read/update -> refresh -> owner read keeps contracts and isolation', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: owner.email, userPassword: 'isolated-test-password' })
      .expect(200)
    expect(login.body).toMatchObject({
      userId: 11,
      userName: 'Owner',
      isAdmin: false,
      accessToken: expect.any(String),
      refreshToken: expect.any(String)
    })
    const initial = await request(app.getHttpServer())
      .get('/user-paintings/11')
      .auth(login.body.accessToken, { type: 'bearer' })
      .expect(200)
    expect(initial.body).toEqual({ favorites: [701], cart: [] })
    const put = await request(app.getHttpServer())
      .put('/user-paintings/11')
      .auth(login.body.accessToken, { type: 'bearer' })
      .send({ favorites: [701], cart: [702] })
      .expect(200)
    expect(put.body).toEqual({ favorites: [701], cart: [702] })
    expect(rows.filter((row) => row.userId === 22)).toEqual([
      { userId: 22, paintingId: 702, type: 'cart' }
    ])
    const refresh = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200)
    expect(refresh.body).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: login.body.refreshToken,
      userName: 'Owner',
      isAdmin: false
    })
    const after = await request(app.getHttpServer())
      .get('/user-paintings/11')
      .auth(refresh.body.accessToken, { type: 'bearer' })
      .expect(200)
    expect(after.body).toEqual({ favorites: [701], cart: [702] })
    await request(app.getHttpServer())
      .get('/user-paintings/11')
      .auth(login.body.refreshToken, { type: 'bearer' })
      .expect(401)
  })

  it('denied GET/PUT leave both users data unchanged before model access', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: other.email, userPassword: 'isolated-test-password' })
      .expect(200)
    const before = JSON.parse(JSON.stringify(rows))
    await request(app.getHttpServer())
      .get('/user-paintings/11')
      .auth(login.body.accessToken, { type: 'bearer' })
      .expect(403)
    await request(app.getHttpServer())
      .put('/user-paintings/11')
      .auth(login.body.accessToken, { type: 'bearer' })
      .send({ favorites: [], cart: [] })
      .expect(403)
    expect(rows).toEqual(before)
    expect(model.findAll).not.toHaveBeenCalled()
    expect(model.destroy).not.toHaveBeenCalled()
    expect(model.bulkCreate).not.toHaveBeenCalled()
  })
})
