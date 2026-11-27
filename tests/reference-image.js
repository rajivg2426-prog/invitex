const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route(/js\/config\.js/,r=>r.fulfill({contentType:'text/javascript',body:"window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};"}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.BASE||'http://localhost:8765/')+'index.html#/new');
 await page.click('[data-cat=wedding]');
 await page.click('[data-way=ai]');
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=40;const x=c.getContext('2d');x.fillStyle='#aa2233';x.fillRect(0,0,40,40);x.fillStyle='#eebb44';x.fillRect(0,0,10,40);return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#aiRef').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 await page.locator('.ix-reference-swatches').waitFor();
 assert.deepEqual(await page.locator('.ix-reference-swatches span').allTextContents(),['#aa2233','#eebb44']);
 assert.equal(await page.locator('[data-concept]').count(),3);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('[data-concept]').first().click();
 await page.locator('#aiRefDel').click();
 assert.equal(await page.locator('.ix-reference').count(),0);
 await page.locator('#aiRef').setInputFiles({name:'invalid.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
 await page.getByText('Could not read that photo.',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS reference colours, three recommendations, mobile layout, selection, removal and invalid image');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
