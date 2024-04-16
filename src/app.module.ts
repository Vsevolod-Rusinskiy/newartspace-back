import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaintingsModule } from './paintings/paintings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PaintingsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
