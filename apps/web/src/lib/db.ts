import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@time-calendar-manager/db";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/time_calendar_manager";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
