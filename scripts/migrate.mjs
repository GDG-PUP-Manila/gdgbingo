import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import ws from 'ws';

const selected = process.argv.find(arg => arg.startsWith('--environment='))?.split('=')[1];
if (!['development', 'production'].includes(selected) || selected !== process.env.DATABASE_ENVIRONMENT || !process.env.DATABASE_URL) {
  throw new Error('Select --environment=development or production matching DATABASE_ENVIRONMENT and configure DATABASE_URL.');
}
if (selected === 'production' && !process.argv.includes('--reviewed-production-migration')) {
  throw new Error('Production requires prior SQL review and --reviewed-production-migration. Never run migrations during a Vercel build.');
}
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('Reviewed database migrations applied.');
} catch {
  process.exitCode = 1;
  console.error('Migration failed. Inspect the database privately; no connection details are logged.');
} finally { await pool.end(); }
