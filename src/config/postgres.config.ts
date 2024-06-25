import { registerAs } from '@nestjs/config'
import { Dialect } from 'sequelize'
import { EnumConfig } from './enumConfig/enumConfig'

export const pgConfig = registerAs(EnumConfig.DATABASE, () => {
  console.log(
    `Connecting to database at ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}`,
  )
  return {
    dialect: <Dialect>process.env.SQL_DIALECT || 'postgres',
    logging: process.env.SQL_LOGGING === 'true',
    host: process.env.POSTGRES_HOST,
    port: +process.env.POSTGRES_PORT,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_NAME,
    autoLoadEntities: true,
    synchronize: true,
  }
})
