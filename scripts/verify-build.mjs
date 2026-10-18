import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const root = '.vercel/output';
const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
assert.equal(config.version, 3);
assert.match(await readFile(join(root, 'static/index.html'), 'utf8'), /GDG Bingo/);
for (const path of ['/api/auth/get-session', '/api/session', '/auth/callback', '/api/events/11111111-1111-4111-8111-111111111111/join', '/api/events/11111111-1111-4111-8111-111111111111/me', '/api/events/11111111-1111-4111-8111-111111111111/claims', '/api/events/11111111-1111-4111-8111-111111111111/board', '/api/events/11111111-1111-4111-8111-111111111111/host/export.csv', '/events/11111111-1111-4111-8111-111111111111']) {
  assert.ok(config.routes.some(route => route.dest && new RegExp(route.src).test(path)), `Dynamic route missing: ${path}`);
}
let functions = 0;
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (entry.name === '.vc-config.json') {
      assert.equal(JSON.parse(await readFile(target, 'utf8')).runtime, 'nodejs24.x');
      functions++;
    }
  }
}
await walk(join(root, 'functions'));
assert.ok(functions);
const deployment = JSON.parse(await readFile('vercel.json','utf8'));
assert.deepEqual(deployment.regions,['sin1']);
let env = {};
try { env = parseEnv(await readFile('.env','utf8')); }
catch (error) { if(error.code !== 'ENOENT') throw error; }
const secretValues = ['DATABASE_URL','NEON_AUTH_COOKIE_SECRET','CODE_DIGEST_KEY','CODE_ENCRYPTION_KEY'].map(key=>env[key]).filter(Boolean);
async function checkStatic(path) {
  for(const entry of await readdir(path,{withFileTypes:true})) {
    const target=join(path,entry.name);
    if(entry.isDirectory()) await checkStatic(target);
    else if(/\.(html|js|css|json)$/.test(entry.name)) {
      const value=await readFile(target,'utf8');
      assert.ok(secretValues.every(secret=>!value.includes(secret)),'A private environment value was found in a public artifact.');
    }
  }
}
await checkStatic(join(root,'static'));
console.log(`Verified static landing page, dynamic private routes and ${functions} Node 24 function artifact(s). Hosted behaviour remains unverified.`);
