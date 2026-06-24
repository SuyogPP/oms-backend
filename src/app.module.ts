import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [

    // this is to provide env variables to the application
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`,
      load: [configuration],
    }),


    // this is to connect to the database
    DatabaseModule,

    // this is to provide health module
    HealthModule,

    // this is to provide users module
    UsersModule,

    // this is to provide auth module
    AuthModule,


  ],

  // this is to apply jwt guard to all routes globally
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ]


})


export class AppModule { }