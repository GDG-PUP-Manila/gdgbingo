import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

// Isolated RFC experiment, not a production migration or claim implementation.
const external = process.env.SPIKE_DATABASE_URL;
if (external && process.env.SPIKE_ALLOW_EXTERNAL_DATABASE !== 'yes') {
  throw new Error('External test DB requires SPIKE_ALLOW_EXTERNAL_DATABASE=yes; never use production.');
}
const schema = `spike_${randomUUID().replaceAll('-', '')}`;
let server;
let pool;
let dataDir;
let makeDrizzle = drizzle;
const results = [];

function run(binary, args) {
  return new Promise((done, reject) => {
    const child = spawn(binary, args, { windowsHide: true, stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? done() : reject(new Error(`Local PostgreSQL utility failed (${code}): ${output.slice(-1500)}`)));
  });
}

async function startLocal() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Local binary runner targets Windows x64; use an explicit disposable SPIKE_DATABASE_URL elsewhere.');
  }
  const bin = resolve('node_modules/@embedded-postgres/windows-x64/native/bin');
  dataDir = resolve('.local-postgres', randomUUID());
  await mkdir(dataDir, { recursive: true });
  await run(resolve(bin, 'initdb.exe'), ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
  const probe = createServer();
  await new Promise(done => probe.listen(0, '127.0.0.1', done));
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  server = spawn(resolve(bin, 'postgres.exe'), ['-D', dataDir, '-h', '127.0.0.1', '-p', String(port), '-F'], {
    windowsHide: true, stdio: 'ignore',
  });
  let processError;
  server.on('error', error => { processError = error; });
  pool = new pg.Pool({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres', max: 15, connectionTimeoutMillis: 1000 });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (processError) throw processError;
    try { await pool.query('select 1'); return; } catch { await delay(100); }
  }
  throw new Error('Local PostgreSQL did not become ready.');
}

function deferred() {
  let resolvePromise;
  const promise = new Promise(done => { resolvePromise = done; });
  return { promise, resolve: resolvePromise };
}

async function clientForScope() {
  // Never rely on session SET state with Neon's transaction-mode pooler.
  return pool.connect();
}

async function query(text, args = []) {
  const client = await clientForScope();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await client.query(text, args);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

async function seed() {
  await query('TRUNCATE claims, codes, events');
  await query("INSERT INTO events VALUES ('event', 'open')");
  for (let n = 1; n <= 8; n++) {
    await query('INSERT INTO codes (id, owner) VALUES ($1, $2)', [`code${n}`, `owner${n}`]);
  }
}

const lockKey = (claimant, requestId) => createHash('sha256')
  .update(JSON.stringify(['gdgbingo:claim:v1', 'event', claimant, requestId])).digest().readBigInt64BE().toString();
const payloadHash = (square, code) => createHash('sha256').update(JSON.stringify([square, code])).digest('hex');

async function claim({ claimant = 'alice', code = 'code1', square = 'sql', requestId = randomUUID(), afterLock, beforeCommit } = {}) {
  const client = await clientForScope();
  const db = makeDrizzle(client);
  try {
    return await db.transaction(async tx => {
      await tx.execute(sql.raw(`SET LOCAL search_path TO ${schema}, public`));
      await tx.execute(sql`SET LOCAL statement_timeout = '10s'`);
      await tx.execute(sql`SET LOCAL lock_timeout = '5s'`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey(claimant, requestId)}::bigint)`);
      if (afterLock) await afterLock();
      const replay = await tx.execute(sql`SELECT * FROM claims WHERE claimant = ${claimant} AND request_id = ${requestId}`);
      if (replay.rows[0]) {
        if (replay.rows[0].request_hash !== payloadHash(square, code)) throw new Error('request_id_reused');
        return { status: 200, id: replay.rows[0].id };
      }
      const event = await tx.execute(sql`SELECT * FROM events WHERE id = 'event' FOR SHARE`);
      if (event.rows[0].status !== 'open') throw new Error('round_not_open');
      const codes = await tx.execute(sql`SELECT * FROM codes WHERE id = ${code} FOR UPDATE`);
      if (!codes.rows[0]) throw new Error('code_invalid');
      if (codes.rows[0].spent_claim) throw new Error('code_spent');
      if (codes.rows[0].owner === claimant) throw new Error('self_claim');
      const id = randomUUID();
      await tx.execute(sql`INSERT INTO claims (id, claimant, confirmer, square, code_id, request_id, request_hash)
        VALUES (${id}, ${claimant}, ${codes.rows[0].owner}, ${square}, ${code}, ${requestId}, ${payloadHash(square, code)})`);
      await tx.execute(sql`UPDATE codes SET spent_claim = ${id} WHERE id = ${code}`);
      if (beforeCommit) await beforeCommit();
      return { status: 201, id };
    }, { isolationLevel: 'read committed' });
  } finally {
    client.release();
  }
}

async function waitForBlockedAdvisory() {
  for (let n = 0; n < 200; n++) {
    const r = await pool.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())");
    if (r.rowCount) return;
    await delay(10);
  }
  throw new Error('Duplicate did not reach the advisory-lock barrier.');
}

async function check(name, test) {
  await seed();
  await test();
  const integrity = await query('SELECT count(*)::int AS count FROM codes c LEFT JOIN claims q ON q.id=c.spent_claim WHERE c.spent_claim IS NOT NULL AND q.id IS NULL');
  assert.equal(integrity.rows[0].count, 0);
  results.push(name);
  console.log(`PASS ${name}`);
}

try {
  if (external) {
    // This path tests the actual Neon Pool/Drizzle adapter when configured.
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { default: ws } = await import('ws');
    neonConfig.webSocketConstructor = ws;
    makeDrizzle = (await import('drizzle-orm/neon-serverless')).drizzle;
    pool = new Pool({ connectionString: external, max: 15, connectionTimeoutMillis: 5000 });
  } else {
    await startLocal();
  }
  await pool.query(`CREATE SCHEMA ${schema}`);
  await query(`CREATE TABLE events (id text PRIMARY KEY, status text NOT NULL);
    CREATE TABLE codes (id text PRIMARY KEY, owner text NOT NULL, spent_claim uuid);
    CREATE TABLE claims (id uuid PRIMARY KEY, claimant text NOT NULL, confirmer text NOT NULL,
      square text NOT NULL, code_id text NOT NULL REFERENCES codes(id), request_id text NOT NULL,
      request_hash text NOT NULL, CONSTRAINT uq_code UNIQUE(code_id),
      CONSTRAINT uq_square UNIQUE(claimant,square), CONSTRAINT uq_confirmer UNIQUE(claimant,confirmer),
      CONSTRAINT uq_request UNIQUE(claimant,request_id));`);

  await check('competing players spend one code once', async () => {
    const r = await Promise.allSettled([claim(), claim({ claimant: 'bob' })]);
    assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
    assert.equal(r.find(x => x.status === 'rejected').reason.message, 'code_spent');
  });
  await check('concurrent identical retry waits and replays success', async () => {
    const entered = deferred(), release = deferred();
    const requestId = randomUUID();
    const original = claim({ requestId, beforeCommit: async () => { entered.resolve(); await release.promise; } });
    await entered.promise;
    const duplicate = claim({ requestId });
    try { await waitForBlockedAdvisory(); } finally { release.resolve(); }
    const [a, b] = await Promise.all([original, duplicate]);
    assert.equal(a.status, 201); assert.equal(b.status, 200); assert.equal(a.id, b.id);
  });
  await check('concurrent changed payload is rejected without spending second code', async () => {
    const entered = deferred(), release = deferred();
    const requestId = randomUUID();
    const original = claim({ requestId, beforeCommit: async () => { entered.resolve(); await release.promise; } });
    await entered.promise;
    const changed = claim({ requestId, code: 'code2', square: 'figma' }).catch(error => error);
    try { await waitForBlockedAdvisory(); } finally { release.resolve(); }
    await original;
    assert.equal((await changed).message, 'request_id_reused');
    assert.equal((await query("SELECT spent_claim FROM codes WHERE id='code2'")).rows[0].spent_claim, null);
  });
  await check('unique square conflict fully rolls back losing code', async () => {
    const r = await Promise.allSettled([claim(), claim({ code: 'code2' })]);
    assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
    const rejected = r.find(x => x.status === 'rejected').reason;
    assert.equal((rejected.cause ?? rejected).code, '23505');
    assert.equal((await query('SELECT count(*)::int AS n FROM codes WHERE spent_claim IS NOT NULL')).rows[0].n, 1);
  });
  await check('committed replay works after host closure', async () => {
    const requestId = randomUUID();
    const a = await claim({ requestId });
    await query("UPDATE events SET status='closed' WHERE id='event'");
    const b = await claim({ requestId });
    assert.equal(a.id, b.id); assert.equal(b.status, 200);
    await assert.rejects(claim({ code: 'code2' }), /round_not_open/);
  });
  await check('rejected transaction leaves code usable', async () => {
    await assert.rejects(claim({ beforeCommit: () => { throw new Error('injected rollback'); } }), /injected rollback/);
    assert.equal((await query("SELECT spent_claim FROM codes WHERE id='code1'")).rows[0].spent_claim, null);
    assert.equal((await claim()).status, 201);
  });
  await check('unrelated players retain concurrent event shared locks', async () => {
    const entered = deferred(), release = deferred();
    const original = claim({ beforeCommit: async () => { entered.resolve(); await release.promise; } });
    await entered.promise;
    try { assert.equal((await claim({ claimant: 'bob', code: 'code2' })).status, 201); }
    finally { release.resolve(); await original; }
  });
  await check('host closure waits for the in-flight claim and rejects new claims', async () => {
    const entered = deferred(), release = deferred();
    const original = claim({ beforeCommit: async () => { entered.resolve(); await release.promise; } });
    await entered.promise;
    const host = await clientForScope();
    const pid = (await host.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const close = host.query(`BEGIN; SET LOCAL search_path TO ${schema}, public; SET LOCAL statement_timeout = '10s'; SELECT id FROM events WHERE id='event' FOR UPDATE; UPDATE events SET status='closed' WHERE id='event'; COMMIT`);
    try {
      let blocked = false;
      for (let n = 0; n < 200; n++) {
        const r = await pool.query('SELECT cardinality(pg_blocking_pids($1)) AS n', [pid]);
        if (r.rows[0].n > 0) { blocked = true; break; }
        await delay(10);
      }
      assert.equal(blocked, true, 'Close must wait on the active claim');
    } finally {
      release.resolve();
      await original;
      await close;
      host.release();
    }
    await assert.rejects(claim({ claimant: 'bob', code: 'code2' }), /round_not_open/);
    assert.equal((await query("SELECT spent_claim FROM codes WHERE id='code2'")).rows[0].spent_claim, null);
  });
  const version = await pool.query('SHOW server_version');
  console.log(JSON.stringify({ postgres: version.rows[0].server_version, driver: external ? 'Neon Pool' : 'node-postgres local', passed: results.length,
    limits: ['Reduced spike schema; not product acceptance', 'No deadline/commit-ack-loss fault injection yet', external ? 'Hosted capacity not measured' : 'Neon pooling and hosted performance not verified'] }, null, 2));
} catch (error) {
  // Avoid emitting DB connection strings or query payloads.
  console.error('Database spike failed:', error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted connection]'));
  process.exitCode = 1;
} finally {
  if (pool) {
    // Keep the isolated schema/data for inspection. Never drop user tables.
    await pool.end();
  }
  if (server && dataDir) {
    const ctl = resolve('node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe');
    try { await run(ctl, ['-D', dataDir, 'stop', '-m', 'fast', '-w']); }
    catch { server.kill(); }
  }
}
