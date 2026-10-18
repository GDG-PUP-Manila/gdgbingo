import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { databaseAdapter, type Database } from './transaction.ts';

neonConfig.webSocketConstructor = ws;
let database: Database | undefined;
export function getDatabase(): Database {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database is not configured.');
  // Small pools per server instance; no database connection at build time.
  const pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
  database = databaseAdapter(drizzle(pool));
  return database;
}
