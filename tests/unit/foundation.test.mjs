import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { newToken, tokenKeys, tokenDigest, encryptToken, decryptToken, normalizeToken } from '../../src/server/crypto/tokens.ts';
import { makeCard, scoreCard } from '../../src/server/game/card.ts';
import { readBody } from '../../src/server/http/endpoint.ts';
import { csvCell } from '../../src/server/reports/export.ts';

const keys = { digest: randomBytes(32), encryption: randomBytes(32) };
test('encrypted code redisplay rejects tampering, wrong owner and wrong encryption key', () => {
  const code = newToken();
  const encrypted = encryptToken(keys, code, 'event:owner:code');
  assert.equal(decryptToken(keys, encrypted, 'event:owner:code'), code);
  assert.ok(!encrypted.includes(Buffer.from(code)));
  assert.throws(() => decryptToken(keys, encrypted, 'event:someone-else:code'));
  assert.throws(() => decryptToken({ ...keys, encryption: randomBytes(32) }, encrypted, 'event:owner:code'));
  const damaged = Buffer.from(encrypted); damaged[damaged.length - 1] ^= 1;
  assert.throws(() => decryptToken(keys, damaged, 'event:owner:code'));
});
test('tokens use purpose-separated keyed digests and reject absent or shared keys', () => {
  const token = newToken();
  assert.equal(token.length, 32);
  assert.equal(normalizeToken(' '+token.toLowerCase()+' '), token);
  assert.notDeepEqual(tokenDigest(keys, 'code', token), tokenDigest(keys, 'invitation', token));
  assert.throws(() => tokenKeys({}));
  assert.throws(() => tokenKeys({ CODE_DIGEST_KEY: 'a'.repeat(64), CODE_ENCRYPTION_KEY: 'a'.repeat(64) }));
});
test('cards contain exactly 24 unique squares and a free centre', () => {
  const squares = Array.from({ length: 24 }, (_, i) => String(i));
  const card = makeCard(squares);
  assert.equal(card.length, 25); assert.equal(card[12], null);
  assert.deepEqual(card.filter(Boolean).sort(), squares.sort());
  assert.throws(() => makeCard(['same', 'same']));
});
test('scoring handles free-centre diagonals, duplicate inputs and blackout', () => {
  assert.deepEqual(scoreCard([0, 6, 18, 24]), { claimedCount: 4, lineCount: 1, blackout: false });
  assert.deepEqual(scoreCard([12, 12, -1, 25]), { claimedCount: 0, lineCount: 0, blackout: false });
  assert.deepEqual(scoreCard(Array.from({ length: 25 }, (_, i) => i)), { claimedCount: 24, lineCount: 12, blackout: true });
});
test('mutations reject foreign origins and oversized bodies before parsing tokens', async () => {
  const url = new URL('https://bingo.example/api/events/test/join');
  const context = (body, origin='https://bingo.example') => ({ url, request: new Request(url, { method: 'POST', headers: {origin, 'Content-Type':'application/json'}, body }) });
  await assert.rejects(readBody(context('{}', 'https://evil.example')), { code: 'origin_rejected' });
  await assert.rejects(readBody(context('x'.repeat(4097))), { code: 'body_too_large' });
  await assert.rejects(readBody(context('[]')), { code: 'invalid_input' });
});
test('CSV neutralises formula prefixes and preserves quoted multiline cells', () => {
  for (const value of ['=SUM(A1:A2)','+1','-1','@formula','\tformula','\rformula','  =formula']) {
    assert.ok(csvCell(value).startsWith('"\''));
  }
  assert.equal(csvCell('A "quoted", name\nnext line'),'"A ""quoted"", name\nnext line"');
});
