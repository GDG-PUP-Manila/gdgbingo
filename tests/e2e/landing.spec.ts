import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const id='11111111-1111-4111-8111-111111111111';
async function mountLanding(page:Page) {
  await page.route('https://landing.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.startsWith('/events/'))return route.fulfill({contentType:'text/html',body:'<h1>Event destination</h1>'});
    const asset=path==='/'?'index.html':path.slice(1);
    const types:Record<string,string>={js:'text/javascript',css:'text/css',png:'image/png',svg:'image/svg+xml',woff2:'font/woff2',html:'text/html'};
    return route.fulfill({body:await readFile(`.vercel/output/static/${asset}`),contentType:types[asset.split('.').pop()!]??'application/octet-stream'});
  });
  await page.goto('https://landing.test/');
  await expect(page.locator('astro-island[component-url*="EventEntry"][ssr]')).toHaveCount(0);
}
test('landing explains the rules and keeps a 360px layout within the viewport',async({page})=>{
  await mountLanding(page);
  await expect(page.getByRole('heading',{level:1})).toContainText('Bingo.');
  await expect(page.getByLabel('Have an event link?')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({path:'test-results/landing-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/landing-desktop.png',fullPage:true});
});
test('event entry rejects invitations and navigates valid event links within this deployment',async({page})=>{
  await mountLanding(page);
  await page.getByLabel('Have an event link?').fill('this-is-an-invitation');
  await page.getByRole('button',{name:'Open event'}).click();
  await expect(page.getByRole('alert')).toContainText('Your private invitation is entered after sign-in.');
  await page.getByLabel('Have an event link?').fill(`https://another-preview.example/events/${id}`);
  await page.getByRole('button',{name:'Open event'}).click();
  await expect(page).toHaveURL(`https://landing.test/events/${id}`);
});

test('play and join links focus the event entry, including repeated activation',async({page})=>{
  await mountLanding(page);
  const input=page.getByLabel('Have an event link?');
  await page.getByRole('link',{name:'Let’s play'}).click();
  await expect(input).toBeFocused();
  await expect.poll(async()=>input.evaluate(el=>el.getBoundingClientRect().top)).toBeGreaterThan(72);
  await page.getByRole('link',{name:'Join an event',exact:true}).click();
  await expect(input).toBeFocused();
  await page.getByRole('link',{name:'Let’s play'}).click();
  await expect(input).toBeFocused();
});

test('decorative motion can be paused and does not block event entry',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await mountLanding(page);
  await expect.poll(()=>page.locator('.shape-blue').evaluate(el=>getComputedStyle(el).animationName)).toBe('bingo-bounce');
  await page.mouse.move(1100,200);
  await expect.poll(()=>page.locator('.app-frame').evaluate(el=>el.style.getPropertyValue('--grid-parallax-x'))).not.toBe('');
  await page.locator('.motion-control').click();
  await expect(page.getByRole('checkbox',{name:'Pause animations',exact:true})).toBeChecked();
  await expect.poll(()=>page.locator('.shape-blue').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await expect.poll(()=>page.locator('.app-frame').evaluate(el=>el.style.getPropertyValue('--grid-parallax-x'))).toBe('');
  await page.getByRole('link',{name:'Let’s play'}).click();
  await expect(page.getByLabel('Have an event link?')).toBeFocused();
});

test('reduced motion keeps content visible and turns off animation and parallax',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await mountLanding(page);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.locator('.shape-blue')).toHaveCSS('animation-name','none');
  await page.mouse.move(300,200);
  await expect(page.locator('.hero-content')).toHaveCSS('opacity','1');
  expect(await page.locator('.app-frame').evaluate(el=>el.style.getPropertyValue('--grid-parallax-x'))).toBe('');
  await page.getByRole('link',{name:'Let’s play'}).click();
  await expect(page.getByLabel('Have an event link?')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
