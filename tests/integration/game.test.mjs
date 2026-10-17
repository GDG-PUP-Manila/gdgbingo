import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { databaseAdapter } from '../../src/server/db/transaction.ts';
import { newToken, tokenDigest } from '../../src/server/crypto/tokens.ts';
import { joinEvent } from '../../src/server/game/join.ts';
import { ownState } from '../../src/server/game/state.ts';
import { redeemClaim } from '../../src/server/game/claim.ts';
import { setRoundState } from '../../src/server/game/host.ts';
import { publicBoard, hostStandings } from '../../src/server/reports/board.ts';
import { revealSkills } from '../../src/server/reports/reveal.ts';
import { exportResults } from '../../src/server/reports/export.ts';
import { saveProfile } from '../../src/server/game/profile.ts';
import { consumeClaimLimit } from '../../src/server/ratelimit/consume.ts';
import { purgeExpiredEvent } from '../../src/server/game/retention.ts';
import { localPostgres } from './postgres.mjs';

test('claim, host and reporting services on the full PostgreSQL schema', async t => {
  const postgres = await localPostgres();
  t.after(() => postgres.close());
  const pool = postgres.pool;
  for (const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()) await pool.query(await readFile(`drizzle/${file}`,'utf8'));
  const db = databaseAdapter(drizzle(pool));
  const keys = {digest:randomBytes(32),encryption:randomBytes(32)};
  for(let i=0;i<24;i++) await pool.query('INSERT INTO square (card_version,square_key,label,category,skill_key) VALUES ($1,$2,$3,$4,$5)', ['game-v1',`square-${i}`,`Synthetic ${i}`,'skill',`skill-${i}`]);
  async function fixture(open=true) {
    const eventId = randomUUID();
    await pool.query('INSERT INTO event (id,slug,title,rules_version,card_version,code_allowance) VALUES ($1,$4,$2,1,$3,2)',[eventId,'Synthetic game','game-v1',eventId]);
    await pool.query('INSERT INTO event_host (event_id,auth_user_id) VALUES ($1,$2)',[eventId,'host']);
    const users=[];
    for(let i=0;i<4;i++) {
      const invitation = newToken(); const userId=`user-${eventId}-${i}`;
      await pool.query('INSERT INTO invitation (event_id,token_digest) VALUES ($1,$2)',[eventId,tokenDigest(keys,'invitation',invitation)]);
      await joinEvent(db,keys,{eventId,userId,displayName:i===0?'=Synthetic formula':'Synthetic '+i,invitation});
      users.push({userId,...await ownState(db,keys,eventId,userId)});
    }
    if(open) await setRoundState(db,eventId,'host','open');
    const claim=(claimant=0,owner=1,ordinal=0,square=0,requestId=randomUUID())=>({eventId,userId:users[claimant].userId,code:users[owner].codes[ordinal].token,squareKey:`square-${square}`,requestId});
    return {eventId,users,claim};
  }
  await t.test('one contested code commits once and replay works after closure',async()=>{
    const f=await fixture(); const a=f.claim(),b=f.claim(2);
    const results=await Promise.allSettled([redeemClaim(db,keys,a),redeemClaim(db,keys,b)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const winner=results[0].status==='fulfilled'?a:b;
    await setRoundState(db,f.eventId,'host','close');
    assert.equal((await redeemClaim(db,keys,winner)).replayed,true);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM claim WHERE event_id=$1',[f.eventId])).rows[0].n,1);
  });
  await t.test('concurrent identical retries replay one success; changed payload rejects',async()=>{
    const f=await fixture(); const input=f.claim();
    const results=await Promise.all([redeemClaim(db,keys,input),redeemClaim(db,keys,{...input,eventId:input.eventId.toUpperCase(),requestId:input.requestId.toUpperCase()})]);
    assert.equal(results[0].claimId,results[1].claimId);
    assert.equal(results.filter(r=>!r.replayed).length,1);
    await assert.rejects(redeemClaim(db,keys,{...input,squareKey:'square-1'}),{code:'request_id_reused'});
  });
  await t.test('two distinct codes from one confirmer may fill two different squares',async()=>{
    const f=await fixture();
    await Promise.all([redeemClaim(db,keys,f.claim()),redeemClaim(db,keys,f.claim(0,1,1,1))]);
    assert.equal((await ownState(db,keys,f.eventId,f.users[0].userId)).progress.claimedCount,2);
    assert.equal((await ownState(db,keys,f.eventId,f.users[1].userId)).codes.filter(c=>c.spent).length,2);
  });
  await t.test('racing codes onto one square roll back the losing code',async()=>{
    const f=await fixture();
    const results=await Promise.allSettled([redeemClaim(db,keys,f.claim()),redeemClaim(db,keys,f.claim(0,2))]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.find(r=>r.status==='rejected').reason.code,'square_already_claimed');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM code WHERE event_id=$1 AND redeemed_claim_id IS NOT NULL',[f.eventId])).rows[0].n,1);
  });
  await t.test('self, missing square, foreign code, before-open and expired rounds spend nothing',async()=>{
    const f=await fixture(false);
    await assert.rejects(redeemClaim(db,keys,f.claim()),{code:'round_not_open'});
    await setRoundState(db,f.eventId,'host','open');
    await assert.rejects(redeemClaim(db,keys,f.claim(0,0)),{code:'self_claim'});
    await assert.rejects(redeemClaim(db,keys,{...f.claim(),squareKey:'free'}),{code:'square_invalid'});
    const other=await fixture();
    await assert.rejects(redeemClaim(db,keys,{...f.claim(),code:other.users[1].codes[0].token}),{code:'code_invalid'});
    await pool.query("UPDATE event SET opens_at=now()-interval '15 minutes',closes_at=now()-interval '1 second' WHERE id=$1",[f.eventId]);
    await assert.rejects(redeemClaim(db,keys,f.claim()),{code:'round_not_open'});
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM claim WHERE event_id=$1',[f.eventId])).rows[0].n,0);
  });
  await t.test('shared limiter allows ten simultaneous attempts, rejects excess, and refills from database time',async()=>{
    const f=await fixture();
    const results=await Promise.allSettled(Array.from({length:16},()=>consumeClaimLimit(db,f.users[0].participationId)));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,10);
    assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='rate_limited').length,6);
    await pool.query("UPDATE rate_limit_bucket SET refilled_at=clock_timestamp()-interval '6 seconds' WHERE participation_id=$1",[f.users[0].participationId]);
    await consumeClaimLimit(db,f.users[0].participationId);
  });
  await t.test('public board uses an allowlist and host reports reject ordinary players',async()=>{
    const f=await fixture(); await redeemClaim(db,keys,f.claim());
    const board=await publicBoard(db,f.eventId);
    assert.equal(board.total,4); assert.equal(board.players[0].claimedCount,1);
    const encoded=JSON.stringify(board);
    for(const u of f.users) {assert.ok(!encoded.includes(u.userId)); for(const c of u.codes) assert.ok(!encoded.includes(c.token));}
    for(const fn of [hostStandings,revealSkills,exportResults]) await assert.rejects(fn(db,f.eventId,f.users[0].userId),{code:'host_required'});
    await assert.rejects(setRoundState(db,f.eventId,f.users[0].userId,'close'),{code:'host_required'});
  });
  await t.test('skill reveal counts distinct code owners and exports only consented follow-up fields',async()=>{
    const f=await fixture();
    await redeemClaim(db,keys,f.claim()); await redeemClaim(db,keys,f.claim(2,1,1));
    const reveal=await revealSkills(db,f.eventId,'host');
    assert.equal(reveal.skills.find(s=>s.skillKey==='skill-0').peerConfirmedCount,1);
    assert.equal(reveal.skills.find(s=>s.skillKey==='skill-1').peerConfirmedCount,0);
    await saveProfile(db,f.eventId,f.users[0].userId,true,['skill-0']);
    const csv=await exportResults(db,f.eventId,'host');
    assert.ok(csv.includes("'=Synthetic formula")); assert.ok(csv.includes(f.users[0].userId));
    assert.ok(!csv.includes(f.users[1].userId));
    await saveProfile(db,f.eventId,f.users[0].userId,false,[]);
    assert.ok(!(await exportResults(db,f.eventId,'host')).includes(f.users[0].userId));
  });
  await t.test('lost commit acknowledgement returns unknown outcome and same-ID retry recovers the committed success',async()=>{
    const f=await fixture(); const input=f.claim();
    const dialect=new PgDialect();
    const lostAck={transaction:async work=>{
      let wroteClaim=false;
      const result=await db.transaction(tx=>work({execute:async query=>{
        if(dialect.sqlToQuery(query).sql.includes('INSERT INTO claim')) wroteClaim=true;
        return tx.execute(query);
      }}));
      if(wroteClaim) throw new Error('simulated-acknowledgement-loss-after-commit');
      return result;
    }};
    await assert.rejects(redeemClaim(lostAck,keys,input),{code:'claim_outcome_unconfirmed'});
    await setRoundState(db,f.eventId,'host','close');
    assert.equal((await redeemClaim(db,keys,input)).replayed,true);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM claim WHERE event_id=$1',[f.eventId])).rows[0].n,1);
  });
  await t.test('manual closure waits for the actual in-flight claim transaction',async()=>{
    const f=await fixture(); const dialect=new PgDialect();
    let signal,release;
    const inserted=new Promise(resolve=>{signal=resolve;});
    const proceed=new Promise(resolve=>{release=resolve;});
    const held={transaction:work=>db.transaction(tx=>work({execute:async query=>{
      const result=await tx.execute(query);
      if(dialect.sqlToQuery(query).sql.includes('INSERT INTO claim')) { signal(); await proceed; }
      return result;
    }}))};
    const claim=redeemClaim(held,keys,f.claim());
    await inserted;
    let closed=false;
    const close=setRoundState(db,f.eventId,'host','close').then(result=>{closed=true;return result;});
    let blocked=false;
    try {
      for(let i=0;i<100;i++) {
        const waiting=await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT status FROM event%'");
        if(waiting.rowCount) { blocked=true; break; }
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.equal(blocked,true); assert.equal(closed,false);
    } finally { release(); }
    await claim; await close;
    await assert.rejects(redeemClaim(db,keys,f.claim(2,3)),{code:'round_not_open'});
  });
  await t.test('retention deletes only the selected expired event and defaults to a dry run',async()=>{
    const f=await fixture(); const other=await fixture();
    await redeemClaim(db,keys,f.claim());
    await assert.rejects(purgeExpiredEvent(db,f.eventId,true),{code:'retention_not_elapsed'});
    await pool.query("UPDATE event SET status='closed',closed_at=clock_timestamp()-interval '31 days' WHERE id=$1",[f.eventId]);
    assert.equal((await purgeExpiredEvent(db,f.eventId)).deleted,false);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM participation WHERE event_id=$1',[f.eventId])).rows[0].n,4);
    assert.equal((await purgeExpiredEvent(db,f.eventId,true)).deleted,true);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM event WHERE id=$1',[f.eventId])).rows[0].n,0);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM participation WHERE event_id=$1',[other.eventId])).rows[0].n,4);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM square WHERE card_version='game-v1'")).rows[0].n,24);
  });
  await t.test('a code lock held across the deadline cannot admit a late claim',async()=>{
    const f=await fixture();const blocker=await pool.connect();
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM code WHERE event_id=$1 AND token_digest=$2 FOR UPDATE',[f.eventId,tokenDigest(keys,'code',f.users[1].codes[0].token)]);
    await pool.query("UPDATE event SET closes_at=clock_timestamp()+interval '1 second' WHERE id=$1",[f.eventId]);
    const result=redeemClaim(db,keys,f.claim()).then(value=>({value}),error=>({error}));
    try {
      await pool.query('SELECT pg_sleep(1.2)');
    } finally {await blocker.query('ROLLBACK');blocker.release();}
    assert.equal((await result).error?.code,'round_not_open');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM claim WHERE event_id=$1',[f.eventId])).rows[0].n,0);
    assert.equal((await ownState(db,keys,f.eventId,f.users[1].userId)).codes[0].spent,false);
  });
});
