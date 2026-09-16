// Screenshot the asset preview page for a supplied model.
const fs=require('fs'),path=require('path');
const {chromium}=require('/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const query=process.env.QUERY||'file=forest-waterfall.glb';
const out=path.resolve(root,process.env.OUT||'docs/asset-preview.png');
(async()=>{
 fs.mkdirSync(path.dirname(out),{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:576},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto((process.env.REVIEW_URL||'http://127.0.0.1:5176')+'/asset-preview.html?'+query);
  await page.waitForSelector('body[data-ready="1"]',{timeout:120000});
  await page.screenshot({path:out});
  console.log(out,JSON.stringify(await page.evaluate(()=>preview)),errors);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
