// Run with a local server serving dist, and a Playwright installation.
// PLAYWRIGHT_MODULE can point to an externally installed module's index.mjs.
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
try {
 const page=await browser.newPage({viewport:{width:1500,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.REVIEW_ORIGIN||'http://localhost:5173')+'/cavern-game-review.html');
 await page.waitForFunction(()=>window.review?.ready);
 const results=[];
 for(const viewport of [{width:1500,height:850},{width:720,height:1280}]){
  await page.setViewportSize(viewport);
  for(const [x,y]of [[8,3],[80,5],[130,12],[233,4],[291,29]]){
   const result=await page.evaluate(async({x,y,viewport})=>{
    const {w,game}=review,{cullCaveCells}=await import('./cavern.js');
    w.editorCamera={x,y,viewH:viewport.width>viewport.height?10:16};w.render(game,0);
    let staticNodes=0,totalNodes=0,visibleNodes=0,totalCells=0,culledCells=0;
    w.backRoot.traverse(o=>{totalNodes++;if(!o.matrixAutoUpdate)staticNodes++;});
    cullCaveCells(w);w.backRoot.traverseVisible(()=>visibleNodes++);
    for(const l of w.parallax)for(const c of l.group.children){totalCells++;if(!c.visible)culledCells++;}
    const frozen=[];w.backRoot.traverse(o=>{if(!o.matrixAutoUpdate){frozen.push(o);o.matrixAutoUpdate=true;}});
    for(const l of w.parallax)for(const c of l.group.children)c.visible=true;
    w.renderer.render(w.scene,w.camera);const before=w.renderer.domElement.toDataURL();
    frozen.forEach(o=>o.matrixAutoUpdate=false);cullCaveCells(w);w.renderer.render(w.scene,w.camera);
    return {x,y,viewport,staticNodes,totalNodes,visibleNodes,totalCells,culledCells,pixelIdentical:before===w.renderer.domElement.toDataURL(),calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles};
   },{x,y,viewport});
   results.push(result);
  }
 }
 await writeFile('docs/cavern-refinement/verification.json',JSON.stringify({errors,results},null,2)+'\n');
 if(errors.length||results.some(r=>!r.pixelIdentical))throw new Error('WebGL verification failed; see verification.json');
 console.log('PASS: pixel-identical optimization at ten landscape/portrait camera positions; no browser errors.');
}finally{await browser.close();}
