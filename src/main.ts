import * as dotenv from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common'
import {
  assertDevCrudRuntimeDatabase,
  assertDevCrudRuntimeEnvironment,
  assertSeoSafeRuntimeDatabase,
  assertSeoSafeRuntimeEnvironment,
  resolveBackendListenOptions
} from './config/database-safety'
dotenv.config()

// const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')
// test ci

async function bootstrap() {
  assertSeoSafeRuntimeEnvironment(process.env)
  assertDevCrudRuntimeEnvironment(process.env)
  await assertSeoSafeRuntimeDatabase(process.env)
  await assertDevCrudRuntimeDatabase(process.env)
  const app = await NestFactory.create(AppModule)
  const logger = new Logger('ValidationPipe')

  app.enableCors()
  // app.enableCors({
  //   origin: function (origin, callback) {
  //     if (allowedOrigins.includes(origin) || !origin) {
  //       callback(null, true)
  //     } else {
  //       callback(new Error('Not allowed by CORS'))
  //     }
  //   },
  //   methods: 'GET,POST,PUT,DELETE,OPTIONS, PATCH',
  //   allowedHeaders: 'Content-Type, Authorization',
  // })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => {
        for (const error of errors) {
          logger.error(
            `Validation error: ${error.property} - ${Object.values(error.constraints).join(', ')}`
          )
        }
        return new BadRequestException(errors)
      }
    })
  )
  const listenOptions = resolveBackendListenOptions(process.env)
  if (listenOptions.host) {
    await app.listen(listenOptions.port, listenOptions.host)
  } else {
    await app.listen(listenOptions.port)
  }
}

bootstrap()
