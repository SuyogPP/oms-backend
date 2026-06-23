import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                type: 'mssql',
                host: config.get('database.host'),
                port: config.get<number>('database.port'),
                username: config.get('database.username'),
                password: config.get('database.password'),
                database: config.get('database.database'),
                autoLoadEntities: true,
                synchronize: false,
                options: {
                    encrypt: false,
                    trustServerCertificate: true,
                },
            }),
        }),
    ],
})
export class DatabaseModule { }