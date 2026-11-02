import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from '../config';
import { migrations } from './migrations';

/** Used by the TypeORM CLI (db:* scripts) and by the seed and admin scripts. */
export default new DataSource({ ...databaseOptions(), migrations });
