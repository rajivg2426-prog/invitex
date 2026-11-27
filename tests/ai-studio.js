const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 await page.route(/js\/config\.js/,r=>r.fulfill({contentType:'text/javascript',body:"window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};"}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.BASE||'http://localhost:8765/')+'index.html#/new');
 await page.click('[data-cat=wedding]');
 await page.click('[data-way=ai]');
 await page.fill('#aiDesc','royal ivory gold wedding');
 await page.click('#aiUnderstand');
 await page.locator('[data-concept]').first().waitFor();
 assert.equal(await page.locator('[data-concept]').count(),3);
 assert.equal(new Set(await page.locator('.ix-concept b').allTextContents()).size,3);
 await page.locator('[data-concept]').first().click();
 assert.equal(await page.locator('[data-concept]').count(),3);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
 await page.click('#aiCopyStudio');
 await page.locator('#csGen').waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS AI concept generation, selection, mobile width and Copy Studio navigation');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
