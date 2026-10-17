import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { databaseAdapter } from '../../src/server/db/transaction.ts';
import { joinEvent } from '../../src/server/game/join.ts';
import { ownState } from '../../src/server/game/state.ts';
import { tokenDigest, newToken } from '../../src/server/crypto/tokens.ts';
import { localPostgres } from './postgres.mjs';

test('production schema and join service against isolated real PostgreSQL', async t => {
  const postgres = await localPostgres();
  t.after(() => postgres.close());
  const pool = postgres.pool;
  for (const file of (await readdir('drizzle')).filter(name => name.endsWith('.sql')).sort()) {
    await pool.query(await readFile(`drizzle/${file}`, 'utf8'));
  }
  const db = databaseAdapter(drizzle(pool));
  const keys = { digest: randomBytes(32), encryption: randomBytes(32) };
  const eventId = randomUUID();
  await pool.query('INSERT INTO event (id,slug,title,rules_version,card_version,code_allowance) VALUES ($1,$2,$3,1,$4,2)', [eventId, 'test', 'Synthetic test', 'test-v1']);
  for (let i = 0; i < 24; i++) await pool.query('INSERT INTO square (card_version,square_key,label,category) VALUES ($1,$2,$3,$4)', ['test-v1',`square-${i}`,`Synthetic square ${i}`,'human']);
  async function invite() {
    const token = newToken();
    await pool.query('INSERT INTO invitation (event_id,token_digest) VALUES ($1,$2)', [eventId, tokenDigest(keys, 'invitation', token)]);
    return token;
  }
  const invitation = await invite();
  const input = { eventId, userId: 'synthetic-user', displayName: 'Synthetic player', invitation };
  let initial;
  await t.test('simultaneous same-user joins create exactly one participation, card and code allowance', async () => {
    const result = await Promise.all(Array.from({ length: 8 }, () => joinEvent(db, keys, input)));
    assert.equal(new Set(result.map(r => r.participationId)).size, 1);
    assert.equal(result.filter(r => r.created).length, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM participation')).rows[0].n, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM card_cell')).rows[0].n, 25);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM code')).rows[0].n, 2);
    initial = await ownState(db, keys, eventId, input.userId);
    assert.equal(initial.card[12].squareKey, null);
    assert.equal(initial.codes.length, 2);
    assert.equal(initial.recruitmentConsent, false);
  });
  await t.test('returning account keeps the same card and decrypted codes without a fresh invitation', async () => {
    await joinEvent(db, keys, { ...input, eventId: eventId.toUpperCase(), invitation: 'not-a-new-invite' });
    assert.deepEqual(await ownState(db, keys, eventId, input.userId), initial);
    assert.deepEqual(await ownState(db, keys, eventId.toUpperCase(), input.userId), initial);
  });
  await t.test('another account cannot reuse a redeemed invitation or read private state', async () => {
    await assert.rejects(joinEvent(db, keys, { ...input, userId: 'someone-else' }), { code: 'invitation_invalid' });
    await assert.rejects(ownState(db, keys, eventId, 'someone-else'), { code: 'participation_required' });
  });
  await t.test('competing users redeeming one invitation produce exactly one winner', async () => {
    const token = await invite();
    const results = await Promise.allSettled(['racer-a','racer-b'].map(userId => joinEvent(db, keys, { ...input, userId, invitation: token })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'invitation_invalid');
  });
  await t.test('injected failure after code insertion rolls back participation, cells, codes and invitation redemption', async () => {
    const token = await invite();
    const failingDb = { transaction: work => db.transaction(async tx => {
      const result = await work(tx);
      throw new Error('injected-before-commit');
    }) };
    await assert.rejects(joinEvent(failingDb, keys, { ...input, userId: 'rollback-user', invitation: token }), /injected-before-commit/);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM participation WHERE auth_user_id=$1', ['rollback-user'])).rows[0].n, 0);
    assert.equal((await pool.query('SELECT participation_id FROM invitation WHERE token_digest=$1', [tokenDigest(keys, 'invitation', token)])).rows[0].participation_id, null);
    const retry = await joinEvent(db, keys, { ...input, userId: 'rollback-user', invitation: token });
    assert.equal(retry.created, true);
  });
  await t.test('expired invitations and closed events issue no participation', async () => {
    const token = await invite();
    await pool.query("UPDATE invitation SET expires_at=now()-interval '1 second' WHERE token_digest=$1", [tokenDigest(keys, 'invitation', token)]);
    await assert.rejects(joinEvent(db, keys, { ...input, userId: 'expired-user', invitation: token }), { code: 'invitation_invalid' });
    await pool.query("UPDATE event SET status='closed' WHERE id=$1", [eventId]);
    await assert.rejects(joinEvent(db, keys, { ...input, userId: 'closed-user', invitation: await invite() }), { code: 'joining_closed' });
    assert.equal((await joinEvent(db, keys, input)).created, false);
  });
  await t.test('schema rejects cross-event ownership and non-centre free cells', async () => {
    const otherEvent = randomUUID();
    await pool.query('INSERT INTO event (id,slug,title,rules_version,card_version,code_allowance) VALUES ($1,$2,$3,1,$4,2)', [otherEvent, 'other', 'Synthetic other', 'test-v1']);
    await assert.rejects(pool.query('INSERT INTO code (event_id,owner_participation_id,token_digest,token_ciphertext,ordinal) VALUES ($1,$2,$3,$4,1)', [otherEvent, initial.participationId, randomBytes(32), randomBytes(64)]), { code: '23503' });
    await assert.rejects(pool.query('UPDATE card_cell SET square_id=NULL WHERE participation_id=$1 AND position=0', [initial.participationId]), { code: '23514' });
  });
  await t.test('code storage contains encrypted bytes and keyed digests only', async () => {
    const rows = (await pool.query('SELECT token_digest,token_ciphertext FROM code WHERE owner_participation_id=$1', [initial.participationId])).rows;
    assert.equal(rows.length, 2);
    for (const row of rows) {
      assert.equal(row.token_digest.length, 32);
      for (const code of initial.codes) assert.equal(row.token_ciphertext.includes(Buffer.from(code.token)), false);
    }
  });
});
