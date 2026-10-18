import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';

// Copies only development settings, never prints credentials, never overwrites.
try {
  await readFile('.env');
  console.error('Root .env already exists; no settings were changed.');
  process.exitCode = 1;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const source = parseEnv(await readFile('spikes/phase1/.env', 'utf8'));
  if (!source.SPIKE_DATABASE_URL || !source.NEON_AUTH_BASE_URL || !source.NEON_AUTH_COOKIE_SECRET) {
    throw new Error('Configure the development spike first. No environment file was written.');
  }
  const env = {
    DATABASE_URL: source.SPIKE_DATABASE_URL,
    NEON_AUTH_BASE_URL: source.NEON_AUTH_BASE_URL,
    NEON_AUTH_COOKIE_SECRET: source.NEON_AUTH_COOKIE_SECRET,
    CODE_DIGEST_KEY: randomBytes(32).toString('hex'),
    CODE_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    DATABASE_ENVIRONMENT: 'development',
  };
  await writeFile('.env', Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n')+'\n', { flag: 'wx', mode: 0o600 });
  console.log('Created ignored root .env from development settings with new token keys. No database changes made.');
}
