// DOM/event integration without a browser or GPU. The real app, editor and
// simulation run; only canvas drawing, audio, fullscreen and frame scheduling
// are replaced. Responsive CSS still requires a live-device visual check.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const {window,document}=parseHTML(await readFile(new URL('../dist/index.html',import.meta.url),'utf8'));
const timers=new Map();let timerId=0;const setTimer=(fn,delay=0)=>{timers.set(++timerId,{fn,delay});return timerId;},clearTimer=id=>timers.delete(id);
const storage=new Map(),localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
let surface={width:900,height:600};
Object.defineProperty(document,'activeElement',{value:document.body,writable:true});
window.HTMLElement.prototype.focus=function(){document.activeElement=this;};window.HTMLElement.prototype.blur=function(){document.activeElement=document.body;};
window.HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:this.id==='editor-map'?400:surface.width,height:this.id==='editor-map'?49:surface.height};};
window.HTMLElement.prototype.setPointerCapture=function(id){this._pointers??=new Set();this._pointers.add(id);};
window.HTMLElement.prototype.hasPointerCapture=function(id){return this._pointers?.has(id)||false;};
window.HTMLElement.prototype.releasePointerCapture=function(id){this._pointers?.delete(id);};
window.HTMLInputElement.prototype.checkValidity=function(){return this.type!=='number'||this.value!==''&&Number.isFinite(Number(this.value))&&Number(this.value)>=Number(this.getAttribute('min'))&&Number(this.value)<=Number(this.getAttribute('max'));};
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||'';},set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',option.value===String(value));}});
const context2d=()=>new Proxy({measureText:t=>({width:t.length*6})},{get:(o,k)=>k in o?o[k]:()=>{}});
window.HTMLCanvasElement.prototype.getContext=context2d;
class ImageStub{set src(v){this._src=v;}}
const globals={window,document,innerWidth:900,innerHeight:600,devicePixelRatio:1,matchMedia:()=>({matches:false}),Image:ImageStub,setTimeout:setTimer,clearTimeout:clearTimer,requestAnimationFrame:()=>1,localStorage};
for(const [k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
Object.assign(window,{matchMedia:globals.matchMedia,innerWidth:900,innerHeight:600});
let worldCount=0,releaseFirstWorld;
class WorldStub{
 constructor(canvas){worldCount++;this.canvas=canvas;this.ready=worldCount===1?new Promise(resolve=>releaseFirstWorld=resolve):Promise.resolve();this.reducedMotion=true;this.castleAsset=true;this.platforms=new Map();this.coinViews=[];this.stampViews=[];this.streamViews=new Map();}
 build(L,index){if(L.biome==='desert')assert(this.drifterAsset,'drifter is loaded before canyon build');if(L.biome==='forest')assert(this.forestAssets,'forest is loaded before build');if(L.biome==='cave')assert(this.cavernAssets,'cavern scenery is loaded before build');this.biome=L.biome;this.levelIndex=index;this.platforms=new Map(L.platforms.map(p=>[p.id,{root:{scale:{x:1},position:{set(){}}}}]));this.decorViews=(L.decor||[]).map(()=>({position:{set(){}},rotation:{set(){}},scale:{setScalar(){}}}));this.refreshes=(this.refreshes||0)+1;}
 refreshEditor(L){this.build(L,this.levelIndex);}
 setEditorCamera(c){this.editorCamera=c;}
 setEditorScenery(show){this.editorScenery=show;}
 prepareLevel(L){this.prepared=(this.prepared||0)+1;if(L.biome==='desert'||L.enemies.some(e=>e.kind==='drifter'))this.drifterAsset??={};if(L.biome==='forest'){this.forestAssets??={};this.sporeAsset??={};}if(L.biome==='cave'){this.batAsset??={};this.cavernAssets??={};}return Promise.resolve();}event(){}resize(){}render(){}
}
class SoundStub{enabled=true;unlock(){}effect(){}update(){}wind(){}setForeground(){}}
class HealthHUDStub{draw(){}}
class TitleSceneStub{constructor(w){this.world=w;w.titleView=this;}show(){this.active=true;}hide(){this.active=false;}render(){}}
class FullscreenStub{active=false;pending=false;sync(){}toggle(){}enter(){return Promise.resolve();}}
const context=vm.createContext({...globals,console,structuredClone,performance,URL,Blob,Set,Map,Promise});
vm.runInContext(await readFile(new URL('../dist/lib/lucide.min.js',import.meta.url),'utf8'),context);window.lucide=context.lucide;
const source=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
const appModule=new vm.SourceTextModule(source+'\nglobalThis.appTest={get game(){return game;},get editor(){return editor;},get saved(){return saved;},input,get joystick(){return joystick;},begin,home,pause,chapters,onEvent,result};',{context});
const linkApp=async specifier=>{
 let exports;if(specifier==='./world.js')exports={World:WorldStub};else if(specifier==='./title-scene.js')exports={TitleScene:TitleSceneStub};else if(specifier==='./title-assets.js')exports={loadTitleAssets:async w=>{w.titleMesa={};}};else if(specifier==='./health-hud.js')exports={HealthHUD:HealthHUDStub};else if(specifier==='./audio.js')exports={Sound:SoundStub,windExposure:()=>0};else if(specifier==='./fullscreen.js')exports={Fullscreen:FullscreenStub};else exports=await import(new URL('../dist/'+specifier,import.meta.url));
 const names=Object.keys(exports);return new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,exports[name]);},{context});
};
await appModule.link(linkApp);
await appModule.evaluate();for(let i=0;i<4;i++)await Promise.resolve();
const app=context.appTest,editor=app.editor,$=id=>document.getElementById(id);
const flush=limit=>{for(const [id,t]of [...timers])if(t.delay<=limit){timers.delete(id);t.fn();}};
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();flush(0);};
const click=selector=>{const el=document.querySelector(selector);assert(el,selector);el.click();return settle();};
const pointer=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});
// Title navigation is available before the expensive WebGL scene loads.
assert($('loading').classList.contains('hidden'));assert(!$('menu').inert);
assert.equal($('play-label').textContent,'Play');assert(!$('menu').textContent.toLowerCase().includes('handmade'));
await click('#chapters');assert.equal(document.querySelectorAll('.chapter-collectibles').length,5);assert(document.querySelector('.chapter-choice[data-level="0"] .chapter-collectibles').textContent.includes('0/'));assert($('menu').inert);
await click('[data-action="close"]');assert(!$('menu').inert);
await click('#settings');assert.equal(document.querySelector('[data-action="settings-sound"]').getAttribute('aria-checked'),'true');
await click('[data-action="settings-sound"]');assert.equal(app.saved.sound,false);assert.equal(document.querySelector('[data-action="settings-sound"]').getAttribute('aria-checked'),'false');assert.equal($('menu-sound').getAttribute('aria-label'),'Enable sound');
await click('[data-action="close"]');await click('#settings');assert.equal(document.querySelector('[data-action="settings-sound"]').getAttribute('aria-checked'),'false');
await click('[data-action="close"]');await click('#menu-sound');assert.equal(app.saved.sound,true);
$('settings').focus();await click('#settings');await click('[data-action="help"]');await click('[data-action="close"]');assert.equal(document.activeElement,$('settings'),'Nested help returns focus to the title trigger');
await click('#chapters');assert.equal(document.querySelectorAll('.chapter-choice[data-level]').length,5);assert.equal(document.querySelectorAll('.chapter-choice[data-action="playground"]').length,0,'the clay lab is hidden until it is unlocked');
window.dispatchEvent(Object.assign(new window.Event('keydown'),{key:'ß'}));await settle();
assert.equal(app.saved.labUnlocked,true,'ß with the chapter list open unlocks the lab');assert.equal(document.querySelectorAll('.chapter-choice[data-action="playground"]').length,1,'and the clay lab sits under the five chapters');
await click('[data-action="close"]');await click('#chapters');assert.equal(document.querySelectorAll('.chapter-choice[data-action="playground"]').length,1,'found once, it stays');await click('[data-action="close"]');
assert.equal(editor.world,undefined,'Menu dialogs stay responsive during a slow asset load');
assert.equal(worldCount,1,'The title creates just one renderer');
const firstBegin=app.begin(0),secondBegin=app.begin(0);releaseFirstWorld();await Promise.all([firstBegin,secondBegin]);
assert.equal(worldCount,1,'Overlapping play requests share the in-flight title load');
assert.equal(editor.world.prepared,1,'Only the latest play request prepares a chapter');
app.home();assert(editor.world.titleView.active,'Title scene runs while menus remain available');
console.log('PASS title menu: slow/shared loading, overlapping play requests, immediate navigation, five chapters, saved collectibles, sound preference and dialog focus boundaries');
await click('#play');assert.equal(app.game.status,'playing');assert(editor.world);assert($('loading').classList.contains('hidden'));
assert(!editor.world.titleView.active,'Gameplay releases the title hero and stops its render');
app.pause();await click('[data-action="home"]');assert.equal(app.game.status,'menu');assert(!$('menu').inert);assert.equal($('play-label').textContent,'Play');
assert(editor.world.titleView.active,'Returning home reuses the live scene');
await click('#open-editor');assert(editor.active);assert.equal(app.game.status,'editing');assert(document.body.classList.contains('is-editing'));assert(!$('level-editor').classList.contains('hidden'));
editor.draw();
// Select and drag the first rope lift. The screen-to-world conversion is used
// by the exact production pointer handlers, not a separate test controller.
const liftIndex=editor.session.level.platforms.findIndex(p=>p.kind==='lift');editor.select({list:'platforms',index:liftIndex});editor.focus();editor.draw();
const p=structuredClone(editor.session.level.platforms[liftIndex]),screen=editor.toScreen(p.x+p.w/2,p.y),u=surface.height/editor.camera.viewH;
editor.pointerDown(pointer(1,screen.x,screen.y));editor.pointerMove(pointer(1,screen.x+2*u,screen.y-u));editor.pointerUp(pointer(1,screen.x+2*u,screen.y-u));
assert.equal(editor.session.level.platforms[liftIndex].x,p.x+2);assert.equal(editor.session.level.platforms[liftIndex].y,Math.round((p.y+1)*4)/4);assert(storage.has('claybound-editor-v1'));
await click('[data-edit="undo"]');assert.equal(editor.session.level.platforms[liftIndex].x,p.x);await click('[data-edit="redo"]');assert.equal(editor.session.level.platforms[liftIndex].x,p.x+2);
// Resize from the large right-hand handle, then exercise the properties form.
const moved=editor.session.level.platforms[liftIndex],edge=editor.toScreen(moved.x+moved.w,moved.y);editor.pointerDown(pointer(2,edge.x,edge.y));editor.pointerMove(pointer(2,edge.x+u,edge.y));editor.pointerUp(pointer(2,edge.x+u,edge.y));assert.equal(editor.session.level.platforms[liftIndex].w,p.w+1);
let input=$('editor-inspector').querySelector('[data-field="period"]');input.value='6';input.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(editor.session.level.platforms[liftIndex].period,6);
await click('[data-edit="test-here"]');assert(editor.testing&&!editor.active);assert.equal(app.game.status,'playing');assert.equal(app.game.player.groundId,editor.session.level.platforms[liftIndex].id);assert.equal(app.game.player.x,editor.session.level.platforms[liftIndex].x+(p.w+1)/2);assert(document.body.classList.contains('is-editor-test'));
const snapshot=JSON.stringify(editor.session.level),view={...editor.camera};app.game.tick(1/120,{jumpPressed:true,jumpHeld:true});assert(app.game.player.vy>0);await click('#return-editor');assert(editor.active&&!editor.testing);assert.equal(JSON.stringify(editor.session.level),snapshot);assert.deepEqual(editor.camera,view);
await click('[data-edit="add"]');await click('[data-type="coins"]');assert.equal(editor.session.selection.list,'coins');const count=editor.session.level.coins.length;await click('[data-edit="duplicate"]');assert.equal(editor.session.level.coins.length,count+1);await click('[data-edit="delete"]');assert.equal(editor.session.level.coins.length,count);
await click('[data-edit="more"]');assert(!$('editor-popover').classList.contains('hidden'));assert(editor.canvas.inert);await click('#editor-popover [data-edit="close"]');assert(!editor.canvas.inert);
// Mobile pinch and one-finger pan, without selecting or moving any objects.
surface={width:390,height:844};globalThis.innerWidth=390;globalThis.innerHeight=844;editor.draw();editor.mode='pan';const originalH=editor.camera.viewH;editor.pointerDown(pointer(3,120,330));editor.pointerDown(pointer(4,260,330));editor.pointerMove(pointer(4,320,330));assert(editor.camera.viewH<originalH);editor.pointerUp(pointer(3,120,330));editor.pointerUp(pointer(4,320,330));const originalX=editor.camera.x;editor.pointerDown(pointer(5,200,360));editor.pointerMove(pointer(5,230,360));editor.pointerUp(pointer(5,230,360));assert(editor.camera.x<originalX);
// Playtesting never writes regular chapter scores, including reaching the bell.
await click('[data-edit="test"]');const bestBefore=JSON.stringify(app.saved.best);app.game.status='complete';app.onEvent({type:'complete',index:0,time:1,coins:999,stamps:99});assert.equal(JSON.stringify(app.saved.best),bestBefore);assert($('dialog-content').textContent.includes('You reached the bell'));await click('[data-action="back-editor"]');assert(editor.active);
await click('[data-edit="exit"]');assert(!editor.active);assert.equal(app.game.status,'menu');assert(!document.body.classList.contains('is-editor-test'));
await app.begin(0);assert(app.game.level.custom);assert.equal(app.game.level.platforms[liftIndex].w,p.w+1);assert(!$('hud').inert);
app.game.status='complete';app.onEvent({type:'complete',index:0,time:108,coins:24,stamps:3});flush(750);assert($('dialog').classList.contains('is-completion'));assert($('dialog-content').textContent.includes('LevelComplete!'));assert($('dialog-content').textContent.includes('New best!'));assert.equal(app.saved.customBest[0].time,108);assert.equal(JSON.stringify(app.saved.best),bestBefore);
await click('[data-action="chapters"]');assert(!$('dialog').classList.contains('is-completion'));await click('[data-action="close"]');assert($('dialog').classList.contains('is-completion'));assert($('dialog-content').textContent.includes('New best!'));
await click('[data-action="restart"]');assert.equal(app.game.status,'playing');assert(!document.body.classList.contains('is-complete'));assert(!$('hud').inert);
console.log('PASS app/DOM integration: touch select/drag/resize, properties, undo/redo, palette, modal focus, mobile pinch/pan, test/return, saved custom play and completion actions');

// Wall blocks are selectable through their full body and resize on both axes.
await editor.open(0);editor.mode='select';editor.camera.x=500;editor.camera.y=10;editor.draw();
await click('[data-edit="add"]');await click('[data-type="wall"]');
const wallIndex=editor.session.selection.index,wallBefore=structuredClone(editor.session.level.platforms[wallIndex]);
assert.equal(wallBefore.kind,'wall');assert.equal(wallBefore.h,4);
assert.equal($('editor-inspector').querySelectorAll('[data-field="h"]').length,1);
assert($('editor-inspector').textContent.includes('Wall height'));
assert.deepEqual(editor.hit(editor.toScreen(wallBefore.x+2,wallBefore.y-2)),{list:'platforms',index:wallIndex});
const wallUnit=surface.height/editor.camera.viewH;
for(const [side,dy] of [['bottom',wallUnit],['top',-wallUnit]]){
 const block=editor.session.level.platforms[wallIndex],edge=editor.toScreen(block.x+block.w/2,block.y-(side==='bottom'?block.h:0));
 editor.pointerDown(pointer(81,edge.x,edge.y));assert.equal(editor.gesture.handle,side);
 editor.pointerMove(pointer(81,edge.x,edge.y+dy));
 assert.equal(editor.game.level.platforms[wallIndex].h,block.h+1,'live preview follows vertical resize');
 editor.pointerUp(pointer(81,edge.x,edge.y+dy));
}
assert.equal(editor.session.level.platforms[wallIndex].h,6);assert.equal(editor.session.level.platforms[wallIndex].y,wallBefore.y+1);
const wallWidth=$('editor-inspector').querySelector('[data-field="w"]');wallWidth.value='8';wallWidth.dispatchEvent(new window.Event('change',{bubbles:true}));
const wallHeight=$('editor-inspector').querySelector('[data-field="h"]');wallHeight.value='9';wallHeight.dispatchEvent(new window.Event('change',{bubbles:true}));
assert.equal(editor.session.level.platforms[wallIndex].h,9);await click('[data-edit="undo"]');assert.equal(editor.session.level.platforms[wallIndex].h,6);await click('[data-edit="redo"]');
editor.focus(true);editor.draw();assert.equal(editor.camera.y,editor.session.level.platforms[wallIndex].y-4.5);
const wallBody=editor.toScreen(editor.session.level.platforms[wallIndex].x+4,editor.session.level.platforms[wallIndex].y-4.5),wallDragUnit=surface.height/editor.camera.viewH;
editor.pointerDown(pointer(82,wallBody.x,wallBody.y));editor.pointerMove(pointer(82,wallBody.x+wallDragUnit,wallBody.y));editor.pointerUp(pointer(82,wallBody.x+wallDragUnit,wallBody.y));
assert.equal(editor.session.level.platforms[wallIndex].x,wallBefore.x+1);
const wallDraft=JSON.stringify(editor.session.level.platforms[wallIndex]);
await click('[data-edit="test-here"]');assert.equal(app.game.player.groundId,editor.session.level.platforms[wallIndex].id);assert.equal(app.game.level.platforms[wallIndex].h,9);
app.game.tick(1/120,{});assert.equal(app.game.player.y,editor.session.level.platforms[wallIndex].y);
await click('#return-editor');assert.equal(JSON.stringify(editor.session.level.platforms[wallIndex]),wallDraft);
await click('[data-edit="duplicate"]');assert.equal(editor.session.level.platforms.at(-1).h,9);await click('[data-edit="delete"]');
await click('[data-edit="exit"]');await app.begin(0);assert.equal(app.game.level.platforms[wallIndex].h,9);
console.log('PASS wall editor: palette, body selection/drag, top/bottom handles, live resize, properties, undo/redo, framing, test/return, duplicate/delete and saved play');

// Actual app wiring: steering and jumping with separate fingers, keyboard
// precedence, and interruptions. Pointer capture is emulated, not browser QA.
const pad=$('move-pad');pad.getBoundingClientRect=()=>({left:20,top:680,width:132,height:132});
const emit=(element,type,props={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:51,clientX:86,clientY:746,button:0,pointerType:'touch',...props});element.dispatchEvent(e);};
assert(!$('left')&&!$('right'));assert(pad.querySelector('.joystick-thumb'));
emit(pad,'pointerdown');assert.equal(app.input.moveAxis,0);
emit(pad,'pointermove',{clientX:105});const precision=app.input.moveAxis;assert(precision>.1&&precision<.3);
emit($('jump'),'pointerdown',{pointerId:52});assert(app.input.jumpPressed&&app.input.jumpHeld);assert.equal(app.input.moveAxis,precision);
emit(pad,'pointerdown',{pointerId:53,clientX:30});emit(pad,'pointerup',{pointerId:53});assert.equal(app.input.moveAxis,precision);
emit(pad,'pointermove',{clientX:600,clientY:1100});assert.equal(app.input.moveAxis,1);assert(app.input.jumpHeld);
emit(window,'keydown',{code:'KeyA'});assert.equal(app.input.moveAxis,-1);emit(window,'keyup',{code:'KeyA'});assert.equal(app.input.moveAxis,1);
emit(pad,'pointerup');assert.equal(app.input.moveAxis,0);assert(app.input.jumpHeld);emit($('jump'),'pointerup',{pointerId:52});assert(!app.input.jumpHeld);
emit(pad,'pointerdown',{clientX:130});app.pause();assert.equal(app.input.moveAxis,0);assert.equal(app.joystick.pointerId,null);assert(!pad.hasPointerCapture(51));
await click('[data-action="resume"]');emit(pad,'pointermove',{clientX:130});assert.equal(app.input.moveAxis,0);
for(const event of ['resize','orientationchange']){emit(pad,'pointerdown',{clientX:130});assert.equal(app.input.moveAxis,1);window.dispatchEvent(new window.Event(event));assert.equal(app.input.moveAxis,0);assert.equal(app.joystick.pointerId,null);}
emit(pad,'pointerdown',{clientX:130});window.dispatchEvent(new window.Event('blur'));assert.equal(app.input.moveAxis,0);assert.equal(app.game.status,'paused');
await click('[data-action="resume"]');emit(pad,'pointerdown',{clientX:130});Object.defineProperty(document,'hidden',{value:true,writable:true});document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(app.input.moveAxis,0);assert.equal(app.game.status,'paused');document.hidden=false;
await click('[data-action="resume"]');emit(pad,'pointerdown',{clientX:130});app.pause();await click('[data-action="editor"]');assert(editor.active);assert.equal(app.input.moveAxis,0);emit(pad,'pointerdown',{clientX:130});assert.equal(app.joystick.pointerId,null);await click('[data-edit="exit"]');
console.log('PASS app joystick: simultaneous jump, keyboard precedence, pause/resume, resize/rotation, focus loss, hidden page and editor input boundaries');

// Cave-only assets and bat editing use the same app and touch-property flow.
const prepared=editor.world.prepared||0;await app.begin(2);assert.equal(app.game.status,'playing');assert(editor.world.batAsset);assert.equal(editor.world.prepared,prepared+1);assert($('loading').classList.contains('hidden'));assert(app.game.level.enemies.some(e=>e.kind==='bat')&&app.game.level.enemies.some(e=>e.kind==='spitter'));
const batAsset=editor.world.batAsset;app.home();await app.begin(2);assert.equal(editor.world.batAsset,batAsset,'bat asset is reused on re-entry');app.pause();await click('[data-action="editor"]');assert(editor.active&&editor.session.index===2);
await click('[data-edit="add"]');await click('[data-type="bat"]');assert.equal(editor.session.selection.list,'enemies');const batIndex=editor.session.selection.index;assert.equal(editor.session.level.enemies[batIndex].kind,'bat');
const bobField=$('editor-inspector').querySelector('[data-field="bob"]');bobField.value='0.9';bobField.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(editor.session.level.enemies[batIndex].bob,.9);
editor.draw();const bat=editor.session.level.enemies[batIndex],batScreen=editor.toScreen(bat.x,bat.y+.53);assert.deepEqual(editor.hit(batScreen),{list:'enemies',index:batIndex});
await click('[data-edit="test"]');assert.equal(app.game.level.enemies[batIndex].kind,'bat');assert.equal(app.game.level.enemies[batIndex].bob,.9);await click('#return-editor');assert(editor.active);await click('[data-edit="exit"]');
console.log('PASS cave bat loading/re-entry, touch selection, palette, hover controls and editor playtest return');
await app.begin(1);assert.equal(app.game.status,'playing');assert(editor.world.forestAssets);assert.equal(app.game.level.biome,'forest');
app.home();await app.begin(1);assert.equal(app.game.status,'playing');
console.log('PASS forest and cavern scenery readiness on chapter entry and return');
assert(editor.world.sporeAsset);const sporeAsset=editor.world.sporeAsset;
app.pause();await click('[data-action="editor"]');editor.camera.x=30;editor.camera.y=6.6;
await click('[data-edit="add"]');await click('[data-type="spore"]');
const sporeIndex=editor.session.selection.index;assert.equal(editor.session.level.enemies[sporeIndex].kind,'spore');
const sporeSpeed=$('editor-inspector').querySelector('[data-field="speed"]');sporeSpeed.value='0.7';sporeSpeed.dispatchEvent(new window.Event('change',{bubbles:true}));
editor.draw();const spore=editor.session.level.enemies[sporeIndex];assert.deepEqual(editor.hit(editor.toScreen(spore.x,spore.y+.5)),{list:'enemies',index:sporeIndex});
await click('[data-edit="test"]');assert.equal(app.game.level.enemies[sporeIndex].kind,'spore');assert.equal(app.game.level.enemies[sporeIndex].speed,.7);
await click('#return-editor');assert(editor.active);await click('[data-edit="exit"]');
app.home();await app.begin(1);assert.equal(editor.world.sporeAsset,sporeAsset,'forest re-entry reuses the prepared enemy');
console.log('PASS Spore Puff touch palette/selection, patrol tuning, saved draft, asset reuse and editor playtest return');
app.home();await app.begin(0);assert(editor.world.drifterAsset);const drifterAsset=editor.world.drifterAsset;
app.home();await app.begin(0);assert.equal(editor.world.drifterAsset,drifterAsset);
app.pause();await click('[data-action="editor"]');editor.camera.x=17;editor.camera.y=6;
await click('[data-edit="add"]');await click('[data-type="drifter"]');
const drifterIndex=editor.session.selection.index;assert.equal(editor.session.level.enemies[drifterIndex].kind,'drifter');
const driftBob=$('editor-inspector').querySelector('[data-field="bob"]');driftBob.value='0.3';driftBob.dispatchEvent(new window.Event('change',{bubbles:true}));
assert.equal(editor.session.level.enemies[drifterIndex].bob,.3);
editor.draw();const drifter=editor.session.level.enemies[drifterIndex];
assert.deepEqual(editor.hit(editor.toScreen(drifter.x,drifter.y)),{list:'enemies',index:drifterIndex});
await click('[data-edit="test"]');assert.equal(app.game.level.enemies[drifterIndex].kind,'drifter');assert.equal(app.game.level.enemies[drifterIndex].bob,.3);
await click('#return-editor');assert(editor.active);await click('[data-edit="exit"]');
console.log('PASS canyon drifter readiness/reuse, touch palette/selection, hover tuning and editor playtest return');

// Reproduce the missing-Drifter report with a saved pre-Drifter canyon. Choosing
// the shipped chapter must preserve the draft, both checkpoints and the choice.
const legacy=structuredClone(editor.library.levels[0]);legacy.platforms[0].w+=.6;
legacy.enemies=[{x:21,y:2,min:19,max:23,speed:1.35},{x:121,y:10.8,min:119,max:122.3,speed:1.5},{x:173,y:16,min:171,max:175,speed:1.6}];
editor.library.save(0,legacy);const draftBefore=JSON.stringify(editor.library.get(0)),storedDraft=storage.get('claybound-editor-v1');
app.home();await app.begin(0);assert(app.game.level.custom);assert.equal(app.game.level.enemies.filter(e=>e.kind==='drifter').length,0,'old saved placements mask the new original roster');
app.game.checkpointId='windwell';app.game.checkpoint={x:45,y:4.3};app.game.elapsed=12.3;app.pause();
const customCheckpoint=JSON.stringify(app.saved.customRuns[0]);
await click('[data-action="chapters"]');await click('[data-level="0"][data-source="original"]');
assert(!app.game.level.custom);assert.equal(app.game.level.enemies.filter(e=>e.kind==='drifter'&&e.alive).length,4);
assert.equal(app.game.level.platforms[0].w,editor.library.levels[0].platforms[0].w);
assert.equal(JSON.stringify(editor.library.get(0)),draftBefore);assert.equal(storage.get('claybound-editor-v1'),storedDraft);assert.equal(JSON.stringify(app.saved.customRuns[0]),customCheckpoint);
app.game.checkpointId='basin';app.game.checkpoint={x:93,y:9.2};app.game.elapsed=33;app.pause();
const originalCheckpoint=JSON.stringify(app.saved.runs[0]);
await click('[data-action="chapters"]');await click('[data-level="0"][data-source="edited"]');
assert(app.game.level.custom);assert.equal(app.game.level.enemies.filter(e=>e.kind==='drifter').length,0);assert.equal(app.game.elapsed,12.3);assert.equal(app.game.checkpointId,'windwell');
assert.equal(JSON.stringify(app.saved.runs[0]),originalCheckpoint);
app.pause();await click('[data-action="chapters"]');await click('[data-level="0"][data-source="original"]');
assert.equal(app.game.elapsed,33);assert.equal(app.game.checkpointId,'basin');app.home();await app.begin(0);assert(!app.game.level.custom);
assert.equal(JSON.parse(storage.get('claybound-v1')).chapterSource[0],'original');
// A fresh app module reads the same device storage, as after refreshing the tab.
const reload=new vm.SourceTextModule(source+'\nglobalThis.reloadedApp={get game(){return game;},begin};',{context});
await reload.link(linkApp);await reload.evaluate();await context.reloadedApp.begin(0);
assert(!context.reloadedApp.game.level.custom);assert.equal(context.reloadedApp.game.level.enemies.filter(e=>e.kind==='drifter'&&e.alive).length,4);
assert.equal(context.reloadedApp.game.checkpointId,'basin');assert.equal(storage.get('claybound-editor-v1'),storedDraft);
console.log('PASS pre-Drifter saved canyon reproduction, original/edit selection, all four restored Drifters, preserved drafts and independent checkpoints, and remembered choice after reload');

// Decoration is a second layer of the same chapter, reached by a toggle and
// edited through the same pointer, properties and history paths. It reaches the
// props it places and the scenery a platform carries, and nothing else: the
// route stays visible, and closed to everything that would move it.
editor.library.reset(0);app.home();await app.begin(0);app.pause();await click('[data-action="editor"]');
assert(editor.active&&!editor.decorating);editor.mode='select';
editor.select({list:'platforms',index:0});editor.focus(true);editor.draw();
const deck=editor.session.level.platforms[0],tap=editor.toScreen(deck.x+deck.w-.4,deck.y);
assert.equal(editor.hit(tap)?.list,'platforms');
editor.select({list:'coins',index:0});
await click('[data-edit="decorate"]');
assert(editor.decorating);assert.equal(document.querySelector('[data-edit="decorate"]').getAttribute('aria-pressed'),'true');
assert.equal(editor.world.editorScenery,true,'decorating puts the foreground props back on screen');
assert.equal(editor.session.selection,null,'entering decoration mode drops a selection it cannot dress');
assert($('editor-inspector').textContent.includes('collider'),'the empty panel says what decoration is not');
// A landmark stands metres above the deck that owns it, and the deck's own hit
// line is a thin band at its surface. Tapping the prop being looked at has to
// reach it: without this the windwell's windmill could only be selected by
// clicking the bare rock well below it, which is no way to find anything.
{
 const windwell=editor.session.level.platforms.findIndex(p=>p.landmark==='windmill');
 assert(windwell>=0,'the canyon has a windmill to tap');
 const deck=editor.session.level.platforms[windwell];
 editor.select({list:'platforms',index:windwell});editor.focus(true);editor.draw();
 const box=editor.sceneryBox(deck);
 assert(box,'and the workshop knows where it stands');
 assert(box.bottom-box.top>0&&box.right-box.left>0);
 const middle={x:(box.left+box.right)/2,y:(box.top+box.bottom)/2};
 assert.deepEqual(editor.hit(middle),{list:'platforms',index:windwell},'tapping the prop selects the deck that carries it');
 assert.deepEqual(editor.hit({x:middle.x,y:box.top+4}),{list:'platforms',index:windwell},'including up near its top');
 // The deck line still works, and is still the precise way in.
 assert.deepEqual(editor.hit(editor.toScreen(deck.x+.4,deck.y)),{list:'platforms',index:windwell});
 // A bare deck has no outline, because there is nothing there to select.
 assert.equal(editor.sceneryBox(editor.session.level.platforms.find(p=>!p.landmark)),null);
 // None of this reaches out of decoration mode.
 await click('[data-edit="decorate"]');editor.draw();
 assert.notDeepEqual(editor.hit(middle),{list:'platforms',index:windwell},'the prop is not a target outside decoration mode');
 await click('[data-edit="decorate"]');
 editor.select(null);
}
// A platform opens for its landmark and its scenery flags. The canyon's start
// deck names its own prop, so it gets the full choice.
editor.select({list:'platforms',index:0});editor.focus(true);editor.draw();
assert(editor.dressing());assert(!editor.trace.length,'no jump guides while dressing a deck');
assert($('editor-inspector').textContent.includes('Select mode'),'and says where its position lives');
assert(!$('editor-inspector').querySelector('[data-field="w"]'),'the route fields stay out of the scenery panel');
const landmark=$('editor-inspector').querySelector('[data-field="landmark"]');
assert(landmark&&landmark.tagName==='SELECT','a deck that names its own prop gets the full choice');
assert([...landmark.querySelectorAll('option')].some(o=>o.textContent==='Camp tent'),'labelled as the canyon builds it');
assert(!$('editor-inspector').textContent.includes('Cottage'),'and without the cottage the canyon cannot build');
const refreshes=editor.world.refreshes;
landmark.value='windmill';landmark.dispatchEvent(new window.Event('change',{bubbles:true}));
assert.equal(editor.session.level.platforms[0].landmark,'windmill');
assert(editor.world.refreshes>refreshes,'setting it rebuilds the chapter');
for(const flag of ['house','arch','entrance','rest']){
 const control=$('editor-inspector').querySelector(`[data-field="${flag}"]`);assert(control,flag);
 control.checked=true;control.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.equal(editor.session.level.platforms[0][flag],true);
}
// The deck itself must not come away with the finger, or be copied or deleted.
const body=editor.toScreen(deck.x+deck.w/2,deck.y),deckUnit=surface.height/editor.camera.viewH;
editor.pointerDown(pointer(95,body.x,body.y));assert.equal(editor.gesture.type,'pan','a tap on a deck selects it and then pans');
editor.pointerMove(pointer(95,body.x+2*deckUnit,body.y));editor.pointerUp(pointer(95,body.x+2*deckUnit,body.y));
assert.equal(editor.session.level.platforms[0].x,deck.x,'the platform stays where the route put it');
const platformCount=editor.session.level.platforms.length;
assert(!$('editor-inspector').querySelector('[data-edit="delete"]'),'the scenery panel does not offer to remove a platform');
const press=code=>editor.key({code,ctrlKey:code==='KeyD',metaKey:false,shiftKey:false,target:document.body,preventDefault(){}});
for(const code of ['KeyD','Delete'])press(code);
assert.equal(editor.session.level.platforms.length,platformCount,'and the keys that copy or remove one are refused');
assert($('editor-message').textContent.includes('Decorate off'));
const nudged=editor.session.level.platforms[0].x;press('ArrowRight');
assert.equal(editor.session.level.platforms[0].x,nudged,'arrows pan instead of nudging the deck');
await click('[data-edit="more"]');await click('#editor-popover [data-edit="browse"]');
assert($('editor-browse').textContent.includes('Windmill on start'),'browsing finds a dressed deck by its prop');
await click('#editor-popover [data-edit="close"]');
$('editor-inspector').querySelector('[data-field="landmark"]').value='';
$('editor-inspector').querySelector('[data-field="landmark"]').dispatchEvent(new window.Event('change',{bubbles:true}));
assert.equal(editor.session.level.platforms[0].landmark,undefined,'choosing None takes the prop away again');
editor.select(null);
await click('[data-edit="add"]');
assert(document.querySelector('[data-type="decor:boulder"]'),'the palette offers decoration while decorating');
assert(!document.querySelector('[data-type="wall"]'),'and holds the gameplay palette back');
await click('[data-type="decor:cactus"]');
assert.equal(editor.session.selection.list,'decor');
const propIndex=editor.session.selection.index;
assert.equal(editor.session.level.decor[propIndex].kind,'cactus');
for(const [key,value]of [['size','3'],['z','-2.5'],['turn','35'],['lean','-8']]){
 const control=$('editor-inspector').querySelector(`[data-field="${key}"]`);assert(control,key);
 control.value=value;control.dispatchEvent(new window.Event('change',{bubbles:true}));
 assert.equal(editor.session.level.decor[propIndex][key],Number(value));
}
// A number field checks the range its own message names. An off-grid value a
// drag could have produced is accepted; one outside the bounds is refused and
// leaves the draft alone.
const enter=(key,value)=>{const control=$('editor-inspector').querySelector(`[data-field="${key}"]`);control.value=value;control.dispatchEvent(new window.Event('change',{bubbles:true}));};
enter('size','3.1');assert.equal(editor.session.level.decor[propIndex].size,3.1,'a size between the spinner steps is accepted');
enter('size','900');assert.equal(editor.session.level.decor[propIndex].size,3.1,'a size beyond the bounds is refused');
assert($('editor-message').textContent.includes('0.25'),'and says what the bounds are');
enter('size','3');
editor.draw();
const prop=structuredClone(editor.session.level.decor[propIndex]),decorUnit=surface.height/editor.camera.viewH;
assert.deepEqual(editor.hit(editor.toScreen(prop.x,prop.y+1)),{list:'decor',index:propIndex},'a prop wins the tap over the deck behind it');
// Drag to move, then drag a handle to resize about the prop's own centre.
const hold=editor.toScreen(prop.x,prop.y+.5);
editor.pointerDown(pointer(91,hold.x,hold.y));editor.pointerMove(pointer(91,hold.x+2*decorUnit,hold.y-decorUnit));editor.pointerUp(pointer(91,hold.x+2*decorUnit,hold.y-decorUnit));
assert.equal(editor.session.level.decor[propIndex].x,prop.x+2);assert.equal(editor.session.level.decor[propIndex].y,prop.y+1);
const slid=editor.session.level.decor[propIndex],box=editor.decorBox(slid),base=editor.toScreen(slid.x,slid.y);
editor.pointerDown(pointer(92,box.right,base.y));assert.equal(editor.gesture.handle,'across');
editor.pointerMove(pointer(92,box.right+decorUnit,base.y));
assert.equal(editor.game.level.decor[propIndex].size,prop.size+2,'live preview follows the scale handle');
editor.pointerUp(pointer(92,box.right+decorUnit,base.y));
assert.equal(editor.session.level.decor[propIndex].size,prop.size+2);
await click('[data-edit="undo"]');assert.equal(editor.session.level.decor[propIndex].size,prop.size);
await click('[data-edit="redo"]');assert.equal(editor.session.level.decor[propIndex].size,prop.size+2);
const propCount=editor.session.level.decor.length;
await click('[data-edit="duplicate"]');assert.equal(editor.session.level.decor.length,propCount+1);
await click('[data-edit="delete"]');assert.equal(editor.session.level.decor.length,propCount);
await click('[data-edit="more"]');await click('#editor-popover [data-edit="browse"]');
assert($('editor-browse').textContent.includes('Cactus'),'browsing while decorating lists props');
await click('#editor-popover [data-edit="close"]');
// A playtest carries it, returning keeps the mode, and leaving the mode hands
// the gameplay objects back.
const decorated=JSON.stringify(editor.session.level.decor);
editor.select({list:'decor',index:propIndex});
await click('[data-edit="test"]');assert.equal(JSON.stringify(app.game.level.decor),decorated,'a playtest carries the decoration');
await click('#return-editor');assert(editor.active&&editor.decorating,'returning from a test stays in decoration mode');
assert.equal(JSON.stringify(editor.session.level.decor),decorated);
await click('[data-edit="decorate"]');
assert(!editor.decorating);assert.equal(editor.world.editorScenery,false);assert.equal(editor.session.selection,null,'leaving decoration mode drops the prop selection');
editor.draw();assert.equal(editor.hit(tap)?.list,'platforms','gameplay objects are selectable again');
await click('[data-edit="exit"]');
await app.begin(0);assert.equal(JSON.stringify(app.game.level.decor),decorated,'the saved chapter plays with its decoration');
console.log('PASS decoration mode: toggle and scenery visibility, its own palette and browse list, properties, pointer move/scale with live preview, history, duplicate/delete, playtest carry and return, mode boundaries and saved play');
