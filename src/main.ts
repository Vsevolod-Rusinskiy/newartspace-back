import * as dotenv from 'dotenv'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
dotenv.config()

// pipeline check!!!VVV

const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',')

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: function (origin, callback) {
      if (allowedOrigins.includes(origin) || !origin) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: 'GET,POST,PUT,DELETE,OPTIONS, PATCH',
    allowedHeaders: 'Content-Type, Authorization',
  })
  await app.listen(process.env.PORT || 3000)
}

bootstrap()
