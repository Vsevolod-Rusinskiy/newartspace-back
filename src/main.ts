import * as dotenv from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common'
dotenv.config()

// const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')

async function bootstrap() {
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
  await app.listen(process.env.PORT || 3000)
}

bootstrap()
