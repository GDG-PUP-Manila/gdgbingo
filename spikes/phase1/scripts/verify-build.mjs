import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = '.vercel/output';
const config = JSON.parse(await readFile(join(root, 'config.json'), 'utf8'));
assert.equal(config.version, 3);
for (const path of ['/api/public-status', '/api/session', '/api/auth/get-session', '/auth/callback']) {
  assert.ok(config.routes.some(route => route.dest && new RegExp(route.src).test(path)), `Missing dynamic route ${path}`);
}
const html = await readFile(join(root, 'static/index.html'), 'utf8');
assert.match(html, /Phase 1 integration checks/);
assert.match(html, /astro-island/);
const paths = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (entry.name === '.vc-config.json') paths.push(target);
  }
}
await walk(join(root, 'functions'));
assert.ok(paths.length, 'No Vercel function generated');
for (const path of paths) {
  const fn = JSON.parse(await readFile(path, 'utf8'));
  assert.match(fn.runtime, /^nodejs24\.x$/);
}
console.log(JSON.stringify({ staticPage: true, reactIsland: true, generatedFunctions: paths.length, runtime: 'nodejs24.x',
  limits: ['Artifact inspection only', 'Live CDN behaviour and OAuth not verified', 'Not deployed'] }, null, 2));
