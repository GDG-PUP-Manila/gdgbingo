import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
import type { Page } from '@playwright/test';

let bundle: string;
let css: string;
const eventId='11111111-1111-4111-8111-111111111111';
// Server fixtures use their own clock; changing the browser clock must not move a deadline.
const serverNow=new Date('2026-10-18T04:00:00Z');
const serverDeadline=new Date(serverNow.getTime()+720_000).toISOString();
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
async function mount(page: Page, options: {joined?:boolean;unknown?:boolean;refreshFails?:boolean;host?:boolean;status?:string;closesAt?:string|null;realLabels?:boolean;signedOut?:boolean;linkedInvitation?:string}={}) {
  let joined=options.joined??true;let attempts=0;const requests: {squareKey:string;code:string;requestId:string}[]=[],joinRequests:Record<string,string>[]=[];
  const own=state();
  let sessionUser:string|null=options.signedOut?null:'synthetic-user';
  if(options.realLabels) {
    const labels=['Has written Python','Likes pancakes','Is learning a new language','Enjoys coffee','Has used spreadsheet formulas','Commutes to campus','Has finished a book this month','Has used Azure','Has pulled an all-nighter','Is at their first GDG event','Likes cooking','Has resolved a Git conflict','Has a pet','Has hosted an event','Plays an instrument','Has volunteered at an event','Has built with Flutter','Has managed a budget','Has designed a poster','Has written SQL','Has used Figma','Enjoys board games','Has published a website','Has edited a video'];
    let index=0;
    for(const cell of own.card)if(cell.position!==12)cell.label=labels[index++]!;
    own.displayName='Example player';
  }
  let round=options.status??'open';
  // Keep ordinary tests independent of the wall clock, and allow explicit server deadlines in timing tests.
  const closesAt=options.closesAt===undefined?null:options.closesAt;
  let boardReads=0;
  await page.route('https://bingo.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const send=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path.startsWith('/brand/')||path.startsWith('/_astro/')) {
      const body=await readFile(`.vercel/output/static${path}`);
      return route.fulfill({body,contentType:path.endsWith('.png')?'image/png':path.endsWith('.svg')?'image/svg+xml':'font/woff2'});
    }
    if(path==='/api/session')return sessionUser?send({authenticated:true,userId:sessionUser}):send({error:'unauthenticated'},401);
    if(path==='/api/auth/sign-in/social')return send({code:'INVALID_CALLBACKURL',message:'Invalid callback URL'},403);
    if(path.endsWith('/board')){boardReads++;return send({event:{title:'Synthetic event',status:round,closesAt},players:[],page:1,total:0});}
    if(path.endsWith('/me'))return sessionUser!=='synthetic-user'||(options.refreshFails&&attempts)?send({code:'unavailable'},503):joined?send(own):send({code:'participation_required'},403);
    if(path.endsWith('/join')){joinRequests.push(route.request().postDataJSON());joined=true;return send({participationId:'synthetic-player',created:true},201);}
    if(path.endsWith('/claims')){
      requests.push(route.request().postDataJSON());attempts++;
      if(options.unknown&&attempts===1)return send({code:'claim_outcome_unconfirmed'},503);
      own.card[0]!.claimed=true;own.progress.claimedCount=1;
      return send({claimId:'synthetic-claim',replayed:attempts>1,progress:own.progress},attempts>1?200:201);
    }
    if(path.includes('/host/')) {
      if(!options.host||sessionUser!=='synthetic-user')return send({code:'host_required'},403);
      if(path.endsWith('/open')||path.endsWith('/close')){round=path.endsWith('/open')?'open':'closed';return send({status:round,closes_at:closesAt});}
      if(path.endsWith('/reveal'))return send({description:'Peer-confirmed and self-selected skills are separate.',skills:[{skillKey:'test',label:'Has used Figma',peerConfirmedCount:1,selfSelectedCount:0}]});
      return send({event:{title:'Synthetic event',status:round,closesAt},players:[{...own.progress,displayName:own.displayName,participationId:own.participationId,codesRemaining:2,firstLineAt:null}],firstLineWinners:[],tiePolicy:'Equal first-line times share qualification.'});
    }
    if(path.endsWith('/profile'))return send({recruitmentConsent:false,skills:[]});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>Test event</title></head><body><div id="root"></div></body></html>'});
  });
  async function load(){await page.goto(`https://bingo.test/events/${eventId}${options.linkedInvitation?`#invite=${encodeURIComponent(options.linkedInvitation)}`:''}`);await page.addStyleTag({content:css});await page.addScriptTag({content:bundle});}
  await load();
  return {requests,joinRequests,load,get boardReads(){return boardReads;},setRound:(value:string)=>{round=value;},setSession:(value:string|null)=>{sessionUser=value;}};
}

async function setVisibility(page:Page,visibility:'hidden'|'visible') {
  await page.evaluate(value=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>value});
    document.dispatchEvent(new Event('visibilitychange'));
  },visibility);
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
  // Animated translations can report 43.99999px for a 44px target; compare rendered pixels.
  await expect.poll(()=>page.getByRole('button').evaluateAll(buttons=>buttons.filter(button=>{const box=button.getBoundingClientRect();return box.width>0&&box.height>0&&(Math.round(box.width)<44||Math.round(box.height)<44);}).map(button=>button.textContent))).toEqual([]);
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

test('rejected OAuth callback address explains the deployment configuration problem',async({page})=>{
  await mount(page,{signedOut:true});
  await page.getByRole('button',{name:'Sign in with Google'}).click();
  await expect(page.getByRole('status')).toHaveText('Google sign-in is not enabled for this website address. Please contact your organiser.');
});
test('board polling pauses when hidden and stops after closure',async({page})=>{
  await page.clock.install();
  const app=await mount(page);
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  await page.getByRole('button',{name:'Board',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Meet the room'})).toBeVisible();
  const initial=app.boardReads;
  await page.clock.fastForward(40_000);
  await expect.poll(()=>app.boardReads).toBeGreaterThan(initial);
  await setVisibility(page,'hidden');
  const hidden=app.boardReads;
  await page.clock.fastForward(90_000);
  expect(app.boardReads).toBe(hidden);
  app.setRound('closed');
  await setVisibility(page,'visible');
  await expect(page.getByText('Round closed',{exact:true})).toBeVisible();
  expect(app.boardReads).toBeGreaterThan(hidden);
  const closed=app.boardReads;
  await page.clock.fastForward(120_000);
  await setVisibility(page,'hidden');
  await setVisibility(page,'visible');
  await page.clock.fastForward(40_000);
  expect(app.boardReads).toBe(closed);
});

// PRD-F6/F7, H-06/H-07: people waiting for the host should not need to reload or change views.
for(const view of ['My card','Board'] as const) {
  test(`a waiting round opens automatically while staying on ${view}`,async({page})=>{
    await page.clock.install({time:serverNow});
    const app=await mount(page,{status:'draft',closesAt:serverDeadline});
    await expect(page.getByText('Waiting for the host',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Synthetic square 0',exact:true})).toBeDisabled();
    if(view==='Board')await page.getByRole('button',{name:view,exact:true}).click();
    app.setRound('open');
    await page.clock.fastForward(40_000);
    await expect(page.getByText('Round open',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:view,exact:true})).toHaveAttribute('aria-pressed','true');
    if(view==='My card') {
      await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
      await page.getByLabel('Code from your match').fill('C'.repeat(32));
      await page.getByRole('button',{name:'Claim square',exact:true}).click();
      await expect(page.getByLabel('Your progress')).toContainText('1/24');
      expect(app.requests).toHaveLength(1);
    } else await expect(page.getByRole('heading',{name:'Meet the room'})).toBeVisible();
  });
}

test('manual closure reaches My card, blocks an unfinished claim and stops polling',async({page})=>{
  await page.clock.install({time:serverNow});
  const app=await mount(page,{closesAt:serverDeadline});
  await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
  await page.getByLabel('Code from your match').fill('C'.repeat(32));
  await expect(page.getByRole('button',{name:'Claim square',exact:true})).toBeEnabled();
  // The host closes early while this participant stays in the claim form.
  app.setRound('closed');
  await page.clock.fastForward(40_000);
  await expect(page.getByText('Round closed',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'My card',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Synthetic square 1',exact:true})).toBeDisabled();
  // Dismissing the form or disabling submission both prevent a new claim after server closure.
  await expect(page.getByRole('button',{name:'Claim square',exact:true}).filter({visible:true}).and(page.locator(':enabled'))).toHaveCount(0);
  await expect(page.getByText('This round has ended. Your confirmed squares are saved.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  expect(app.requests).toHaveLength(0);
  const closed=app.boardReads;
  await page.clock.fastForward(120_000);
  await setVisibility(page,'hidden');
  await setVisibility(page,'visible');
  await page.clock.fastForward(40_000);
  expect(app.boardReads).toBe(closed);
});

// INV-4 / PRD-F6: the SQL clock decides admission; the browser countdown is informational.
for(const skew of [{name:'ahead',offset:3_600_000},{name:'behind',offset:-3_600_000}]) {
  test(`a browser clock ${skew.name} cannot disable a server-open round`,async({page})=>{
    await page.clock.install({time:new Date(serverNow.getTime()+skew.offset)});
    const app=await mount(page,{closesAt:serverDeadline,host:true});
    await expect(page.getByText('Round open',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
    await page.getByLabel('Code from your match').fill('C'.repeat(32));
    await page.getByRole('button',{name:'Claim square',exact:true}).click();
    await expect(page.getByRole('status')).toHaveText('Square claimed!');
    expect(app.requests).toHaveLength(1);
    await page.getByRole('button',{name:'Host',exact:true}).click();
    await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeEnabled();
    // Crossing the displayed deadline also cannot turn a server-open round into local closure.
    await page.clock.setSystemTime(new Date(serverNow.getTime()+7_200_000));
    await page.clock.fastForward(1_000);
    await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'My card',exact:true}).click();
    await expect(page.getByRole('button',{name:'Synthetic square 1',exact:true})).toBeEnabled();
  });
}

test('visible polling does not overlap a slow request or a header Refresh',async({page})=>{
  await page.clock.install({time:serverNow});
  await mount(page,{closesAt:serverDeadline});
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  let reads=0;
  let release:()=>Promise<void>=async()=>{};
  await page.route('**/api/events/*/board?*',async route=>{
    reads++;
    await new Promise<void>(resolve=>{
      release=async()=>{
        await route.fulfill({contentType:'application/json',body:JSON.stringify({event:{title:'Synthetic event',status:'open',closesAt:serverDeadline},players:[],page:1,total:0})}).catch(()=>{});
        resolve();
      };
    });
  });
  try {
    await page.clock.fastForward(40_000);
    await expect.poll(()=>reads).toBe(1);
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    // Several visible signals during a slow response must reuse the outstanding public read.
    await setVisibility(page,'visible');
    await setVisibility(page,'visible');
    await page.clock.fastForward(15_000);
    expect(reads).toBe(1);
    await release();
    await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeEnabled();
  } finally {await release();}
});

test('My card suspends polling while hidden and catches up when visible',async({page})=>{
  await page.clock.install({time:serverNow});
  const app=await mount(page,{status:'draft',closesAt:serverDeadline});
  await expect(page.getByText('Waiting for the host',{exact:true})).toBeVisible();
  await setVisibility(page,'hidden');
  const hidden=app.boardReads;
  app.setRound('open');
  await page.clock.fastForward(90_000);
  expect(app.boardReads).toBe(hidden);
  await expect(page.getByRole('button',{name:'Synthetic square 0',exact:true})).toBeDisabled();
  await setVisibility(page,'visible');
  await expect(page.getByRole('button',{name:'Synthetic square 0',exact:true})).toBeEnabled();
  expect(app.boardReads).toBeGreaterThan(hidden);
});

for(const view of ['My card','Board'] as const) {
  test(`an idle waiting ${view} notices the round starting without activity`,async({page})=>{
    await page.clock.install({time:serverNow});
    const app=await mount(page,{status:'draft',closesAt:serverDeadline});
    await expect(page.getByText('Waiting for the host',{exact:true})).toBeVisible();
    if(view==='Board')await page.getByRole('button',{name:view,exact:true}).click();
    const initial=app.boardReads;
    await page.clock.fastForward(40_000);
    await expect.poll(()=>app.boardReads).toBeGreaterThan(initial);
    // Stay visible and idle beyond the former inactivity cutoff.
    await page.clock.fastForward(12*60_000);
    const idle=app.boardReads;
    expect(idle).toBeGreaterThan(initial);
    app.setRound('open');
    await page.clock.fastForward(40_000);
    await expect(page.getByText('Round open',{exact:true})).toBeVisible();
    expect(app.boardReads).toBeGreaterThan(idle);
    await expect(page.getByRole('button',{name:view,exact:true})).toHaveAttribute('aria-pressed','true');
  });
}

test('one shared event link carries admission through sign-in and joins with its invitation',async({page})=>{
  const app=await mount(page,{joined:false,linkedInvitation:'shared-development-invitation'});
  await expect(page.getByLabel('Private invitation',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Your invitation'})).toBeVisible();
  expect(await page.evaluate(()=>location.hash)).toBe('');
  expect(await page.evaluate(()=>sessionStorage.getItem('gdgbingo:invitation:11111111-1111-4111-8111-111111111111'))).toBe('shared-development-invitation');
  await page.getByLabel('Display name',{exact:true}).fill('Synthetic player');
  await page.getByRole('button',{name:'Join event',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  expect(app.joinRequests).toEqual([{displayName:'Synthetic player',invitation:'shared-development-invitation'}]);
  expect(await page.evaluate(()=>sessionStorage.getItem('gdgbingo:invitation:11111111-1111-4111-8111-111111111111'))).toBeNull();
});

test('returning visible during an aborted poll immediately recovers the latest round',async({page})=>{
  await page.clock.install({time:serverNow});
  await mount(page,{closesAt:serverDeadline});
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  let reads=0;
  let release:()=>Promise<void>=async()=>{};
  await page.route('**/api/events/*/board?*',async route=>{
    reads++;
    if(reads===1) {
      await new Promise<void>(resolve=>{
        release=async()=>{await route.abort().catch(()=>{});resolve();};
      });
    } else await route.fulfill({contentType:'application/json',body:JSON.stringify({event:{title:'Synthetic event',status:'closed',closesAt:serverDeadline},players:[],page:1,total:0})});
  });
  try {
    await page.clock.fastForward(40_000);
    await expect.poll(()=>reads).toBe(1);
    // Both signals arrive before the aborted fetch has settled, as with a rapid tab switch.
    await page.evaluate(()=>{
      let visibility='hidden';
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
      document.dispatchEvent(new Event('visibilitychange'));
      visibility='visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByText('Round closed',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Synthetic square 0',exact:true})).toBeDisabled();
    expect(reads).toBe(2);
  } finally {await release();}
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


test('expired sessions remove previously loaded host data and player codes',async({page})=>{
  const app=await mount(page,{host:true});
  await page.getByRole('button',{name:'Host',exact:true}).click();
  await expect(page.getByRole('link',{name:'Download results CSV'})).toBeVisible();
  app.setSession(null);
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in with Google'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Download results CSV'})).toHaveCount(0);
  await expect(page.locator('.wallet')).toHaveCount(0);
});

test('changing accounts cannot retain the previous card when the new private request fails',async({page})=>{
  const app=await mount(page);
  await expect(page.getByRole('heading',{name:'Give a code'})).toBeVisible();
  app.setSession('another-user');
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry saved card'})).toBeVisible();
  await expect(page.locator('.wallet')).toHaveCount(0);
  await expect(page.getByLabel('Private invitation',{exact:true})).toHaveCount(0);
});

test('private host state overrides an older cached public round status',async({page})=>{
  await mount(page,{host:true});
  await page.route('**/api/events/*/board?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({event:{title:'Synthetic event',status:'draft',closesAt:null},players:[],page:1,total:0})}));
  await page.getByRole('button',{name:'Host',exact:true}).click();
  await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Start 12-minute round',exact:true})).toBeDisabled();
});

// PRD-F8 / H-08: Refresh must reload the private standings and shared first-line qualification.
for(const status of ['open','closed'] as const) {
  test(`Host header Refresh updates standings and qualifiers while preserving private ${status} status`,async({page})=>{
    await page.clock.install({time:serverNow});
    await mount(page,{host:true,status:'open',closesAt:serverDeadline});
    let updated=false,privateReads=0,publicReads=0;
    const staleStatus=status==='open'?'draft':'open';
    await page.route('**/api/events/*/board?*',async route=>{
      publicReads++;
      await route.fulfill({contentType:'application/json',body:JSON.stringify({event:{title:'Synthetic event',status:staleStatus,closesAt:serverDeadline},players:[],page:1,total:0})});
    });
    await page.route('**/api/events/*/host/state',async route=>{
      privateReads++;
      const players=updated?[
        {participationId:'synthetic-player',displayName:'Synthetic player',claimedCount:5,lineCount:1,blackout:false,codesRemaining:0,firstLineAt:'2026-10-18T04:01:00Z'},
        {participationId:'tied-player',displayName:'Tied player',claimedCount:6,lineCount:1,blackout:false,codesRemaining:1,firstLineAt:'2026-10-18T04:01:00Z'},
      ]:[{participationId:'synthetic-player',displayName:'Synthetic player',claimedCount:0,lineCount:0,blackout:false,codesRemaining:2,firstLineAt:null}];
      await route.fulfill({contentType:'application/json',body:JSON.stringify({event:{title:'Synthetic event',status:updated?status:'open',closesAt:serverDeadline},players,firstLineWinners:updated?['synthetic-player','tied-player']:[],tiePolicy:'Equal first-line times share qualification.'})});
    });
    await page.getByRole('button',{name:'Host',exact:true}).click();
    await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeEnabled();
    await expect(page.locator('.qualification')).toContainText('No qualifiers yet.');
    const oldRow=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Synthetic player'})});
    await expect(oldRow.getByRole('cell')).toHaveText(['0/24','0','2']);
    expect(privateReads).toBe(1);
    updated=true;
    await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await expect.poll(()=>privateReads).toBe(2);
    await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeEnabled();
    await expect(oldRow.getByRole('cell')).toHaveText(['5/24','1','0']);
    await expect(page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Tied player'})}).getByRole('cell')).toHaveText(['6/24','1','1']);
    await expect(page.locator('.qualification')).toContainText('Synthetic player, Tied player');
    await expect(page.locator('.qualification')).toContainText('Equal first-line times share qualification.');
    expect(publicReads).toBeGreaterThanOrEqual(2);
    await expect(page.getByText(status==='open'?'Round open':'Round closed',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Start 12-minute round',exact:true})).toBeDisabled();
    if(status==='open')await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeEnabled();
    else await expect(page.getByRole('button',{name:'Close round',exact:true})).toBeDisabled();
    // Moving back to My card and receiving another older public response cannot undo host authority.
    await page.getByRole('button',{name:'My card',exact:true}).click();
    const beforePoll=publicReads;
    await page.clock.fastForward(40_000);
    if(status==='open')await expect.poll(()=>publicReads).toBeGreaterThan(beforePoll);
    await expect(page.getByText(status==='open'?'Round open':'Round closed',{exact:true})).toBeVisible();
    if(status==='open')await expect(page.getByRole('button',{name:'Synthetic square 1',exact:true})).toBeEnabled();
    else await expect(page.getByRole('button',{name:'Synthetic square 1',exact:true})).toBeDisabled();
  });
}


test('a stalled claim times out into same-request recovery instead of staying busy',async({page})=>{
  await page.clock.install();
  await mount(page);
  let release:()=>void=()=>{};
  let submitted=false;
  await page.route('**/api/events/*/claims',route=>new Promise<void>(resolve=>{
    submitted=true;
    release=()=>{void route.abort().catch(()=>{}).finally(resolve);};
  }));
  try {
    await page.getByRole('button',{name:'Synthetic square 0',exact:true}).click();
    await page.getByLabel('Code from your match').fill('C'.repeat(32));
    await page.getByRole('button',{name:'Claim square',exact:true}).click();
    await expect.poll(()=>submitted).toBe(true);
    await page.clock.fastForward(31_000);
    await expect(page.getByRole('button',{name:'Retry claim',exact:true})).toBeEnabled();
    await expect(page.getByRole('button',{name:'Sign out',exact:true})).toBeDisabled();
    const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gdgbingo:pending:11111111-1111-4111-8111-111111111111')??'null'));
    expect(pending.requestId).toBeTruthy();
    expect(pending.code).toBe('C'.repeat(32));
  } finally {release();}
});
