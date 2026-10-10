import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseOptions } from './config';
import { Initial1781000000000 } from './migrations/1781000000000-Initial';
export default new DataSource({...databaseOptions(),migrations:[Initial1781000000000]});
