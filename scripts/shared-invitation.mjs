import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { newToken, tokenDigest, tokenKeys } from '../src/server/crypto/tokens.ts';

const eventId=process.argv.find(arg=>arg.startsWith('--event-id='))?.slice(11).toLowerCase();
const mode=process.argv.includes('--development-only')?'development':process.argv.includes('--production')?'production':null;
if(!mode||process.env.DATABASE_ENVIRONMENT!==mode||!process.env.DATABASE_URL)
  throw new Error('Select exactly one environment flag matching DATABASE_ENVIRONMENT and configure DATABASE_URL.');
if(process.argv.includes('--development-only')&&process.argv.includes('--production'))
  throw new Error('Select exactly one of --development-only or --production.');
if(!eventId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(eventId))
  throw new Error('Provide --event-id with a valid development event UUID.');
const keys=tokenKeys();
const file=`.private/shared-invitation-${eventId}.json`;
await mkdir('.private',{recursive:true});
let manifest;
try {manifest=JSON.parse(await readFile(file,'utf8'));}
catch(error) {if(error.code!=='ENOENT')throw new Error('Existing private manifest needs inspection.');}
if(manifest&&(manifest.eventId!==eventId||typeof manifest.invitation!=='string'))throw new Error('Invalid private manifest.');
if(!manifest) {
  manifest={state:'prepared',eventId,shared:true,invitation:newToken()};
  await writeFile(file,JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
}
neonConfig.webSocketConstructor=ws;
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
try {
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const event=(await client.query("SELECT status,closes_at<=clock_timestamp() AS expired FROM event WHERE id=$1 FOR SHARE",[eventId])).rows[0];
    if(!event||event.status==='closed'||event.expired)throw new Error('Event unavailable for joining.');
    const digest=tokenDigest(keys,'invitation',manifest.invitation);
    const existing=(await client.query('SELECT token_digest,expires_at<=clock_timestamp() AS expired FROM invitation WHERE event_id=$1 AND reusable',[eventId])).rows[0];
    if(existing) {
      if(!existing.token_digest.equals(digest)||existing.expired)throw new Error('Existing shared invitation needs private inspection.');
    } else await client.query('INSERT INTO invitation (event_id,token_digest,reusable) VALUES ($1,$2,true)',[eventId,digest]);
    await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
  await writeFile(file,JSON.stringify({...manifest,state:'created'},null,2),{mode:0o600});
  console.log(`Shared invitation ready for event ${eventId}. Read ${file} privately; no invitation value is logged.`);
} catch {
  console.error('Shared invitation outcome needs private inspection. The saved manifest supports safe retry; do not distribute until confirmed.');
  process.exitCode=1;
} finally {await pool.end();}
