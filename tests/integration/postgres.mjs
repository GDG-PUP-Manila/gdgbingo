import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

function run(binary, args) {
  return new Promise((done, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`Local PostgreSQL utility failed (${code}).`)));
  });
}

export async function localPostgres() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This offline integration runner requires Windows x64. It never connects to an external database.');
  const bin = resolve('node_modules/@embedded-postgres/windows-x64/native/bin');
  const data = resolve('.local-postgres', randomUUID());
  await mkdir(data, { recursive: true });
  await run(resolve(bin, 'initdb.exe'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
  const probe = createServer();
  await new Promise(done => probe.listen(0, '127.0.0.1', done));
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  const server = spawn(resolve(bin, 'postgres.exe'), ['-D', data, '-h', '127.0.0.1', '-p', String(port), '-F'], { windowsHide: true, stdio: 'ignore' });
  const pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', max: 15, connectionTimeoutMillis: 1000 });
  let startupError;
  server.on('error', error => { startupError = error; });
  async function close() {
    try { await pool.end(); } finally { await run(resolve(bin, 'pg_ctl.exe'), ['-D', data, 'stop', '-m', 'fast']); }
  }
  try {
    for (let n = 0; n < 100; n++) {
      if (startupError) throw startupError;
      try { await pool.query('SELECT 1'); return { pool, close }; } catch { await delay(100); }
    }
    throw new Error('Local PostgreSQL startup timed out.');
  } catch (error) { await close(); throw error; }
}
