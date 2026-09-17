// What every browser review needs before it can look at anything: a server
// with the game on it, a browser that can draw, a page that reports its own
// errors, and the hook that lets a review drive the running game a frame at a
// time instead of watching it run away.
//
// Each review used to carry its own copy of all four. That meant the same
// absolute path into one machine's package cache repeated fifteen times, and
// fifteen scripts each waiting on a different hardcoded port — 5173, 5174,
// 5176, 5177, 5184, 5191, 5199 — so running one meant knowing which server it
// wanted and starting that first. A review now serves the game itself on
// whatever port is free, and needs nothing set up to run.
const fs=require('fs'),path=require('path'),http=require('http');

const PROJECT=path.resolve(__dirname,'..','..');

// Playwright is a review tool, not something the game depends on, so it is not
// in package.json and lives wherever the agent runtime put it. Look in the
// places it is actually found rather than naming one machine's.
const CACHED='/Users/moritzgrassy/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
function playwright(){
  const tried=[];
  for(const where of [process.env.PLAYWRIGHT_MODULE,'playwright',CACHED]){
    if(!where)continue;
    try{return require(where);}catch{tried.push(where);}
  }
  throw new Error('Playwright not found; set PLAYWRIGHT_MODULE to its module directory. Tried: '+tried.join(', '));
}

// The bundled Chromium cannot always get a GPU, and these reviews exist to see
// what the GPU draws. Prefer real Chrome where it is installed, and let
// Playwright fall back to its own build rather than failing outright.
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
function chromePath(){
  const chosen=process.env.CHROME_PATH||CHROME;
  return fs.existsSync(chosen)?chosen:undefined;
}

async function launch(options={}){
  const executablePath=chromePath();
  return playwright().chromium.launch({
    headless:true,
    args:['--no-sandbox','--enable-unsafe-swiftshader'],
    ...(executablePath?{executablePath}:{}),
    ...options
  });
}

const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg',
  '.svg':'image/svg+xml','.ico':'image/x-icon','.wav':'audio/wav','.mp3':'audio/mpeg','.webp':'image/webp'};

// Serves the authored game straight from dist/, which is what it is for: it
// runs from any static server with no build step. Port 0 means the operating
// system picks a free one, so two reviews can run at once and neither needs to
// be told about the other.
function serve(root=PROJECT){
  const base=path.join(root,'dist');
  if(!fs.existsSync(path.join(base,'index.html')))throw new Error('no dist/index.html under '+root);
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
    const file=path.join(base,rel);
    if(!file.startsWith(base)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>
    resolve({url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(done=>server.close(done))})));
}

// Collect what the page complains about, so a review can assert it drew
// cleanly rather than only that it drew something.
function watch(page){
  const errors=[],requests=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message);});
  page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE ERROR',m.text());}});
  page.on('response',r=>{if(r.status()>=400)requests.push({url:r.url(),status:r.status()});});
  return {errors,requests};
}

const HOOK='function frame(now){';
// Hand the review the running game and let it hold the frame loop. `during` is
// what still has to happen on a held frame — the clay benches keep their
// pointer controls live, for instance. `expose` is appended to the module, and
// is where a review names the parts of app.js it wants to reach.
async function patchApp(page,{root=PROJECT,expose='',during='',pattern='**/app.js*'}={}){
  await page.route(pattern,async route=>{
    const source=fs.readFileSync(path.join(root,'dist/app.js'),'utf8');
    // Without this the review would serve an unpatched app.js and then sit
    // waiting for a handle that is never going to appear.
    if(!source.includes(HOOK))throw new Error(`dist/app.js no longer contains "${HOOK}", which the reviews replace to hold the frame loop`);
    const body=source.replace(HOOK,`${HOOK}if(window.playtest?.manual){${during}requestAnimationFrame(frame);return;}`);
    await route.fulfill({contentType:'text/javascript',body:body+'\n'+expose});
  });
}

// Stand everything up, run the review, and take it all down again whatever
// happens — including the server, which a killed review used to leave behind.
async function review(body,{viewport={width:1672,height:941},root=PROJECT,page:pageOptions={},...options}={}){
  const server=await serve(root);
  const browser=await launch(options);
  try{
    const page=await browser.newPage({viewport,...pageOptions});
    await body({page,url:server.url,root,browser,...watch(page)});
  }finally{
    await browser.close();
    await server.close();
  }
}

module.exports={PROJECT,playwright,chromePath,launch,serve,watch,patchApp,review,HOOK};
