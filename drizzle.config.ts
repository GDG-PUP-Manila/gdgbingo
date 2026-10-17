import { defineConfig } from 'drizzle-kit';

// Generating SQL is offline. Applying it is an explicit, separate operation.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  strict: true,
});
