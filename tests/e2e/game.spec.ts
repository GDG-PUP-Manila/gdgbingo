import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';

let bundle: string;
let css: string;
const eventId='11111111-1111-4111-8111-111111111111';
test.beforeAll(async()=>{
  bundle=(await build({entryPoints:['tests/e2e/mount.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}})).outputFiles[0]!.text;
  const asset=(await readdir('.vercel/output/static/_astro')).find(name=>name.endsWith('.css'));
  if(!asset) throw new Error('Run npm run build before browser tests.');
  css=await readFile(`.vercel/output/static/_astro/${asset}`,'utf8');
});
function state() {
  return {participationId:'synthetic-player',displayName:'Synthetic player',recruitmentConsent:false,skills:[],
    card:Array.from({length:25},(_,position)=>({position,squareKey:position===12?null:`square-${position}`,label:position===12?null:`Synthetic square ${position}`,skillKey:position<2?`skill-${position}`:null,claimed:false})),
    codes:[{ordinal:1,token:'A'.repeat(32),spent:false},{ordinal:2,token:'B'.repeat(32),spent:false}],
    progress:{claimedCount:0,lineCount:0,blackout:false}};
}
async function mount(page: Page, options: {joined?:boolean;unknown?:boolean;refreshFails?:boolean;host?:boolean;status?:string;realLabels?:boolean}={}) {
  let joined=options.joined??true;let attempts=0;const requests: {squareKey:string;code:string;requestId:string}[]=[];
  const own=state();
  if(options.realLabels) {
    const labels=['Has written Python','Likes pancakes','Is learning a new language','Enjoys coffee','Has used spreadsheet formulas','Commutes to campus','Has finished a book this month','Has used Azure','Has pulled an all-nighter','Is at their first GDG event','Likes cooking','Has resolved a Git conflict','Has a pet','Has hosted an event','Plays an instrument','Has volunteered at an event','Has built with Flutter','Has managed a budget','Has designed a poster','Has written SQL','Has used Figma','Enjoys board games','Has published a website','Has edited a video'];
    let index=0;
    for(const cell of own.card)if(cell.position!==12)cell.label=labels[index++]!;
    own.displayName='Example player';
  }
  let round=options.status??'open';
  await page.route('https://bingo.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const send=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path.startsWith('/brand/')||path.startsWith('/_astro/')) {
      const body=await readFile(`.vercel/output/static${path}`);
      return route.fulfill({body,contentType:path.endsWith('.png')?'image/png':path.endsWith('.svg')?'image/svg+xml':'font/woff2'});
    }
    if(path==='/api/session')return send({authenticated:true,userId:'synthetic-user'});
    if(path.endsWith('/board'))return send({event:{title:'Synthetic event',status:round,closesAt:new Date(Date.now()+720000).toISOString()},players:[],page:1,total:0});
    if(path.endsWith('/me'))return options.refreshFails&&attempts?send({code:'unavailable'},503):joined?send(own):send({code:'participation_required'},403);
    if(path.endsWith('/join')){joined=true;return send({participationId:'synthetic-player',created:true},201);}
    if(path.endsWith('/claims')){
      requests.push(route.request().postDataJSON());attempts++;
      if(options.unknown&&attempts===1)return send({code:'claim_outcome_unconfirmed'},503);
      own.card[0]!.claimed=true;own.progress.claimedCount=1;
      return send({claimId:'synthetic-claim',replayed:attempts>1,progress:own.progress},attempts>1?200:201);
    }
    if(path.includes('/host/')) {
      if(!options.host)return send({code:'host_required'},403);
      if(path.endsWith('/open')||path.endsWith('/close')){round=path.endsWith('/open')?'open':'closed';return send({status:round,closes_at:new Date(Date.now()+720000).toISOString()});}
      if(path.endsWith('/reveal'))return send({description:'Peer-confirmed and self-selected skills are separate.',skills:[{skillKey:'test',label:'Has used Figma',peerConfirmedCount:1,selfSelectedCount:0}]});
      return send({players:[{...own.progress,displayName:own.displayName,participationId:own.participationId,codesRemaining:2,firstLineAt:null}],firstLineWinners:[],tiePolicy:'Equal first-line times share qualification.'});
    }
    if(path.endsWith('/profile'))return send({recruitmentConsent:false,skills:[]});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test event</title></head><body><div id="root"></div></body></html>'});
  });
  async function load(){await page.goto(`https://bingo.test/events/${eventId}`);await page.addStyleTag({content:css});await page.addScriptTag({content:bundle});}
  await load();
  return {requests,load};
}
test('phone join flow issues a card and two codes with consent initially off',async({page})=>{
  await mount(page,{joined:false,realLabels:true});
  await page.getByLabel('Display name',{exact:true}).fill('Synthetic player');
  await page.getByLabel('Private invitation',{exact:true}).fill('synthetic-invitation');
  await page.getByRole('button',{name:'Join event',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copy code 1',exact:true})).toBeVisible();
  await page.locator('.preferences summary').click();
  await expect(page.getByRole('checkbox',{name:'I agree to GDG organisers contacting me about future projects using my event identity.'})).not.toBeChecked();
  await page.locator('.preferences summary').click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const smallTargets=await page.getByRole('button').evaluateAll(buttons=>buttons.filter(button=>{const box=button.getBoundingClientRect();return box.width>0&&box.height>0&&(box.width<44||box.height<44);}).map(button=>button.textContent));
  expect(smallTargets).toEqual([]);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/player-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/player-real-desktop.png',fullPage:true});
});
test('claim selection focuses input and updates confirmed progress',async({page})=>{
  const {requests}=await mount(page);
  await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
  await expect(page.getByLabel('Code from your match')).toBeFocused();
  await page.getByLabel('Code from your match').fill('C'.repeat(32));
  await page.getByRole('button',{name:'Claim square',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Square claimed!');
  await expect(page.getByLabel('Your progress')).toContainText('1/24');
  expect(requests).toHaveLength(1);
});
test('unknown outcome survives refresh and retries the identical request ID and payload',async({page})=>{
  const {requests,load}=await mount(page,{unknown:true});
  await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
  await page.getByLabel('Code from your match').fill('C'.repeat(32));
  await page.getByRole('button',{name:'Claim square',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry claim',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeDisabled();
  await load();
  await page.getByRole('button',{name:'Retry claim',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Square claimed!');
  expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0]);
});
test('ordinary participant sees no host controls after access is rejected',async({page})=>{
  await mount(page);
  await page.getByRole('button',{name:'Host',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('This account is not a host for this event.');
  await expect(page.getByRole('button',{name:'Start 12-minute round',exact:true})).toHaveCount(0);
});
test('board polling pauses when hidden and stops after closure',async({page})=>{
  await page.clock.install();
  await mount(page);
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  let reads=0;
  await page.route('**/api/events/*/board?*',async route=>{
    reads++;
    await route.fulfill({contentType:'application/json',body:JSON.stringify({event:{title:'Synthetic event',status:reads>=3?'closed':'open',closesAt:null},players:[],page:1,total:0})});
  });
  await page.getByRole('button',{name:'Board',exact:true}).click();
  await expect.poll(()=>reads).toBe(1);
  await page.clock.fastForward(40_000);
  await expect.poll(()=>reads).toBe(2);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.fastForward(90_000);
  expect(reads).toBe(2);
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(()=>reads).toBe(3);
  await page.clock.fastForward(120_000);
  expect(reads).toBe(3);
});


test('confirmed receipt remains successful when the following private refresh fails',async({page})=>{
  const {requests}=await mount(page,{refreshFails:true});
  await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
  await page.getByLabel('Code from your match').fill('C'.repeat(32));
  await page.getByRole('button',{name:'Claim square',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Square claimed! Some details could not refresh.');
  await expect(page.getByLabel('Your progress')).toContainText('1/24');
  await expect(page.getByRole('button',{name:'Synthetic square 0, claimed',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Retry claim',exact:true})).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test('cancelling a claim returns focus to its selected square',async({page})=>{
  await mount(page);
  const square=page.getByRole('button',{name:'Synthetic square 0',exact:true});
  await square.click();
  await page.getByLabel('Code from your match').press('Escape');
  await expect(square).toBeFocused();
  await expect(page.getByLabel('Code from your match')).toHaveCount(0);
});

test('host must confirm closing and can reveal distinct skill counts',async({page})=>{
  await mount(page,{host:true});
  await page.getByRole('button',{name:'Host',exact:true}).click();
  await page.getByRole('button',{name:'Close round',exact:true}).click();
  await expect(page.getByRole('group',{name:'Confirm round closure'})).toBeVisible();
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await expect(page.getByRole('group',{name:'Confirm round closure'})).toHaveCount(0);
  await page.getByRole('button',{name:'Close round',exact:true}).click();
  await page.getByRole('button',{name:'Confirm close round',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('The round is closed.');
  await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Reveal skills',exact:true}).click();
  await expect(page.getByText('Has used Figma',{exact:true})).toBeVisible();
  await expect(page.getByText('1 peer-confirmed',{exact:true})).toBeVisible();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/host-mobile.png',fullPage:true});
});

test('waiting and closed rounds keep the saved card read-only',async({page})=>{
  await mount(page,{status:'draft'});
  await expect(page.getByText('Waiting for the host',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Synthetic square 0',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Board',exact:true}).click();
  await expect(page.getByText('The room is getting ready',{exact:true})).toBeVisible();
});

test('desktop keeps the card beside a private wallet and renders the real brand mark',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await mount(page);
  await expect(page.getByRole('heading',{name:'Give a code',exact:true})).toBeVisible();
  const card=await page.locator('.card-panel').boundingBox();
  const wallet=await page.locator('.wallet').boundingBox();
  expect(wallet!.x).toBeGreaterThan(card!.x+card!.width);
  expect(await page.locator('.brand img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'test-results/player-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Board',exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/board-desktop.png',fullPage:true});
});
