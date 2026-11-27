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
 await page.click('[data-tab=words]');
 await page.locator('[data-field]').count();
 await page.locator('#ixPanel input').count();
 const fields=await page.locator('#ixPanel input').evaluateAll(es=>es.map(e=>({id:e.id,attrs:[...e.attributes].map(a=>[a.name,a.value])})));
 const bride=fields.find(e=>/bride$/i.test(e.id)), groom=fields.find(e=>/groom$/i.test(e.id));
 assert.ok(bride&&groom,'Name fields exist');
 await page.locator('#'+bride.id).fill('Ananya');
 await page.locator('#'+groom.id).fill('Kabir');
 await page.click('[data-tab=style]');
 await page.selectOption('#ixMonogram','circle');
 await page.locator('#ixCard [data-monogram=circle]').waitFor();
 assert.match(await page.locator('#ixCard [data-monogram=circle]').textContent(),/A & K/);
 await page.selectOption('#ixMonogram','diamond');
 await page.locator('#ixCard [data-monogram=diamond]').waitFor();
 await page.click('[data-lettering=hindi]');
 await page.click('[data-lettering=punjabi]');
 await page.click('[data-lettering=royal]');
 await page.click('[data-tab=orn]');
 await page.locator('[data-add=royal-crown]').click();
 await page.click('[data-tab=ink]');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='#aa2233';x.fillRect(0,0,32,32);return c.toDataURL().split(',')[1];});
 await page.locator('#ixInkRef').setInputFiles({name:'ref.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
 await page.locator('[data-ref-color="#aa2233"]').click();
 await page.waitForFunction(()=>document.querySelector('#ixCard svg rect[fill="#aa2233"]'));
 for(const [type,ext] of [['png','png'],['jpeg','jpg'],['pdf','pdf']]){
   await page.click('#ixDl');
   const pending=page.waitForEvent('download',{timeout:90000});
   await page.locator('[data-dl='+type+']').click();
   const download=await pending;
   assert.ok((type==='jpeg'?['jpg','jpeg']:[ext]).includes(download.suggestedFilename().split('.').pop().toLowerCase()));
   const bytes=require('node:fs').readFileSync(await download.path());
   assert.ok(bytes.length>1000);
   if(type==='png'){assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>=1500);assert.ok(bytes.readUInt32BE(20)>=1500);}
   if(type==='jpeg')assert.equal(bytes.readUInt16BE(0),0xffd8);
   if(type==='pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
   await page.locator('#ixDl').waitFor({state:'visible'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('[data-btab=ink]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS calligraphy metallic presets, live preview, undo and redo');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
