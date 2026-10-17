import assert from 'node:assert/strict';
import { readFile,readdir,mkdir,writeFile } from 'node:fs/promises';
import { randomUUID,randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { databaseAdapter } from '../src/server/db/transaction.ts';
import { newToken,tokenDigest } from '../src/server/crypto/tokens.ts';
import { joinEvent } from '../src/server/game/join.ts';
import { ownState } from '../src/server/game/state.ts';
import { redeemClaim } from '../src/server/game/claim.ts';
import { setRoundState } from '../src/server/game/host.ts';
import { publicBoard } from '../src/server/reports/board.ts';
import { localPostgres } from '../tests/integration/postgres.mjs';

// Deliberately ignores .env, has no hosted URL option and never makes a Neon or
// Vercel request. This is a local service/database baseline, not an HTTP test.
const players=350,concurrency=15;
const postgres=await localPostgres();
const times={join:[],claim:[],board:[]};
async function timed(name,work) {
  const start=performance.now();const result=await work();times[name].push(performance.now()-start);return result;
}
async function batch(items,work) {
  let next=0;
  await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const index=next++;if(index>=items.length)return;await work(items[index],index);}}));
}
try {
  const pool=postgres.pool, db=databaseAdapter(drizzle(pool));
  for(const file of (await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort()) await pool.query(await readFile(`drizzle/${file}`,'utf8'));
  const keys={digest:randomBytes(32),encryption:randomBytes(32)};
  const eventId=randomUUID();
  await pool.query("INSERT INTO event (id,slug,title,rules_version,card_version,code_allowance) VALUES ($1,'load-local','Synthetic local workload',1,'load-v1',2)",[eventId]);
  await pool.query("INSERT INTO event_host (event_id,auth_user_id) VALUES ($1,'synthetic-host')",[eventId]);
  for(let i=0;i<24;i++) await pool.query("INSERT INTO square (card_version,square_key,label,category) VALUES ('load-v1',$1,$2,'human')",[`square-${i}`,`Synthetic ${i}`]);
  const participants=Array.from({length:players},(_,i)=>({userId:`synthetic-${i}`,invitation:newToken()}));
  for(const person of participants) await pool.query('INSERT INTO invitation (event_id,token_digest) VALUES ($1,$2)',[eventId,tokenDigest(keys,'invitation',person.invitation)]);
  await batch(participants,person=>timed('join',()=>joinEvent(db,keys,{eventId,userId:person.userId,displayName:person.userId,invitation:person.invitation})));
  console.log('350 synthetic joins completed on local PostgreSQL.');
  const states=new Array(players);
  await batch(participants,async(person,index)=>{states[index]=await ownState(db,keys,eventId,person.userId);});
  await setRoundState(db,eventId,'synthetic-host','open');
  const claims=participants.flatMap((person,owner)=>[0,1].map(ordinal=>({eventId,userId:participants[(owner+ordinal+1)%players].userId,squareKey:`square-${ordinal}`,code:states[owner].codes[ordinal].token,requestId:randomUUID()})));
  await batch(claims,input=>timed('claim',()=>redeemClaim(db,keys,input)));
  await batch(Array.from({length:30},(_,i)=>i),index=>timed('board',()=>publicBoard(db,eventId,(index%4)+1)));
  await setRoundState(db,eventId,'synthetic-host','close');
  const counts=(await pool.query(`SELECT (SELECT count(*)::int FROM participation) AS players,
    (SELECT count(*)::int FROM code) AS codes,(SELECT count(*)::int FROM claim) AS claims,
    (SELECT count(*)::int FROM code WHERE redeemed_claim_id IS NOT NULL) AS spent,
    (SELECT count(*)::int FROM code c LEFT JOIN claim q ON q.id=c.redeemed_claim_id AND q.code_id=c.id WHERE c.redeemed_claim_id IS NOT NULL AND q.id IS NULL) AS inconsistent`)).rows[0];
  assert.deepEqual(counts,{players:350,codes:700,claims:700,spent:700,inconsistent:0});
  function stats(samples){const sorted=[...samples].sort((a,b)=>a-b);return {samples:sorted.length,p95Ms:Math.round(sorted[Math.ceil(sorted.length*.95)-1]),maxMs:Math.round(sorted.at(-1))};}
  const report={date:new Date().toISOString(),scope:'Compressed local service/database workload only; no HTTP, real Auth, CDN, Vercel or 12-minute pacing.',players,concurrency,counts,timing:Object.fromEntries(Object.entries(times).map(([name,samples])=>[name,stats(samples)])),hostedCapacityVerified:false};
  await mkdir('test-results',{recursive:true});await writeFile('test-results/local-load.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await postgres.close();}
