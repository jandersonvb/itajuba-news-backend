import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseOptions } from '../config';

/** PostgreSQL connection. Tests replace this module with an in-memory database. */
@Module({ imports: [TypeOrmModule.forRootAsync({ useFactory: databaseOptions })] })
export class DatabaseModule {}
