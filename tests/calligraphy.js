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
 await page.click('[data-way=callig]');
 await page.locator('[data-callig]').first().click();
 await page.locator('#ixCard svg').waitFor();
 await page.click('[data-tab=ink]');
 const before=await page.locator('#ixCard svg').innerHTML();
 await page.click('[data-ink-preset=silver]');
 await page.waitForFunction(()=>document.querySelector('#ixCard svg [id$="-mo-silver"]'));
 await page.click('[data-ink-preset=rose-gold]');
 await page.waitForFunction(()=>document.querySelector('#ixCard svg [id$="-mo-rose-gold"]'));
 await page.click('#ixUndo');
 await page.waitForFunction(()=>document.querySelector('#ixCard svg [id$="-mo-silver"]'));
 await page.click('#ixRedo');
 await page.waitForFunction(()=>document.querySelector('#ixCard svg [id$="-mo-rose-gold"]'));
 assert.notEqual(await page.locator('#ixCard svg').innerHTML(),before);
 assert.deepEqual(errors,[]);
 console.log('PASS calligraphy metallic presets, live preview, undo and redo');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
