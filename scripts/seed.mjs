import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';
import { tokenKeys, newToken, tokenDigest } from '../src/server/crypto/tokens.ts';

if (process.env.DATABASE_ENVIRONMENT !== 'development' || !process.argv.includes('--development-only') || !process.env.DATABASE_URL) {
  throw new Error('Synthetic seed requires development environment and --development-only. Production event creation is separate.');
}
const host = process.argv.find(value => value.startsWith('--host-user-id='))?.slice('--host-user-id='.length);
if (!host || host.length > 200) throw new Error('Provide --host-user-id with the ID from your validated development session.');
const keys = tokenKeys();
const eventId = randomUUID();
const cardVersion = `rehearsal-${eventId}`;
const invitations = Array.from({ length: 350 }, () => newToken());
const labels = [
  ['sql', 'Has written SQL', 'skill', 'sql'], ['figma', 'Has used Figma', 'skill', 'figma'],
  ['azure', 'Has used Azure', 'skill', 'azure'], ['flutter', 'Has built with Flutter', 'skill', 'flutter'],
  ['python', 'Has written Python', 'skill', 'python'], ['git', 'Has resolved a Git conflict', 'skill', 'git'],
  ['web', 'Has published a website', 'skill', 'web'], ['design', 'Has designed a poster', 'skill', 'design'],
  ['budget', 'Has managed a budget', 'skill', 'budget'], ['host', 'Has hosted an event', 'skill', 'hosting'],
  ['video', 'Has edited a video', 'skill', 'video'], ['sheets', 'Has used spreadsheet formulas', 'skill', 'spreadsheets'],
  ['pet', 'Has a pet', 'human', null], ['pancakes', 'Likes pancakes', 'human', null],
  ['allnighter', 'Has pulled an all-nighter', 'human', null], ['coffee', 'Enjoys coffee', 'human', null],
  ['music', 'Plays an instrument', 'human', null], ['book', 'Has finished a book this month', 'human', null],
  ['commute', 'Commutes to campus', 'human', null], ['game', 'Enjoys board games', 'human', null],
  ['cook', 'Likes cooking', 'human', null], ['first', 'Is at their first GDG event', 'human', null],
  ['language', 'Is learning a new language', 'human', null], ['volunteer', 'Has volunteered at an event', 'human', null],
];
await mkdir('.private', { recursive: true });
const manifest = `.private/rehearsal-${eventId}.json`;
// Save private invitations before the transaction so a local write failure
// cannot commit invitations whose plaintext was lost. Never log the tokens.
await writeFile(manifest, JSON.stringify({ state: 'prepared', eventId, invitations }, null, 2), { flag: 'wx', mode: 0o600 });
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await drizzle(pool).transaction(async tx => {
    await tx.execute(sql`INSERT INTO event (id,slug,title,rules_version,card_version,code_allowance) VALUES (${eventId},${`rehearsal-${eventId}`},'GDG Bingo rehearsal',1,${cardVersion},2)`);
    await tx.execute(sql`INSERT INTO event_host (event_id,auth_user_id) VALUES (${eventId},${host})`);
    await tx.execute(sql`INSERT INTO square (card_version,square_key,label,category,skill_key) VALUES ${sql.join(labels.map(([key,label,category,skill]) => sql`(${cardVersion},${key},${label},${category},${skill})`), sql`, `)}`);
    await tx.execute(sql`INSERT INTO invitation (event_id,token_digest) VALUES ${sql.join(invitations.map(token => sql`(${eventId},${tokenDigest(keys, 'invitation', token)})`), sql`, `)}`);
  });
  await writeFile(manifest, JSON.stringify({ state: 'created', eventId, invitations }, null, 2), { mode: 0o600 });
  console.log(`Created synthetic event ${eventId}. Private invitations saved in ${manifest}; do not share or commit that file.`);
} catch {
  console.error('Seed outcome requires inspection. Private manifest remains prepared; do not distribute invitations until the event is confirmed in the database.');
  process.exitCode = 1;
} finally { await pool.end(); }
