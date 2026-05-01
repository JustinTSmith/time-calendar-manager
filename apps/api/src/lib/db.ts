import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';

// Import schema from the db package
import * as schema from '../../../packages/db/src/schema.js';

const client = postgres(env.DATABASE_URL, {
  prepare: false,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;

export const closeDbConnection = async (): Promise<void> => {
  await client.end();
};

// Re-export schema for convenience
export * from '../../../packages/db/src/schema.js';
