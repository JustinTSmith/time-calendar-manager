import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/time_calendar_manager';

export const client = postgres(databaseUrl, {
  prepare: false,
});

export const db = drizzle(client, {
  schema,
});

export type Database = typeof db;

export const closeDbConnection = async () => {
  await client.end();
};
