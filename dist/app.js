import {Game,FIXED_DT} from './simulation.js';
import {HealthHUD} from './health-hud.js';
import {LEVELS} from './levels.js';
import {World} from './world.js';
import {Sound} from './audio.js';
import {Fullscreen} from './fullscreen.js';
import {VirtualJoystick} from './controls.js';
import {completionMarkup,completionRecord,warmCompletionAssets} from './completion.js';
import {DraftLibrary} from './editor-model.js';
import {LevelEditor} from './editor.js';
import {collectiblesMarkup,settingsMarkup} from './title-menu.js';
import {TitleScene} from './title-scene.js';
import {loadTitleAssets} from './title-assets.js';
import {ShapingControls} from './shaping-controls.js';
import {visitStation} from './shaping.js';
import {applyUIPalette} from './palette.js';
import {hintIcon} from './hint-icons.js';
import {motherQuiet,motherCorrupted} from './mother-puff-rules.js';
import {updateMotherAtmosphere} from './mother-puff-hud.js';

applyUIPalette(document.documentElement);

const $=id=>document.getElementById(id);
const icon=name=>`<i data-lucide="${name}"></i>`;
const icons=()=>window.lucide?.createIcons({attrs:{'stroke-width':1.7}});
const show=(id,visible)=>$(id).classList.toggle('hidden',!visible);
let draftStorage;try{draftStorage=localStorage;}catch{}
const drafts=new DraftLibrary(LEVELS,draftStorage);
let saved={last:0,best:{},runs:{},customBest:{},customRuns:{},sound:true,clayDone:[]};
try{const s=JSON.parse(localStorage.getItem('claybound-v1'));if(s&&typeof s==='object')saved={...saved,...s,best:s.best||{}};}catch{}
const persist=()=>{try{localStorage.setItem('claybound-v1',JSON.stringify(saved));}catch{}};
saved.runs??={};
saved.customBest??={};saved.customRuns??={};
if(!saved.chapterSource||typeof saved.chapterSource!=='object'||Array.isArray(saved.chapterSource))saved.chapterSource={};
const activeLevel=index=>saved.chapterSource[index]==='original'?LEVELS[index]:drafts.get(index);
for(const [i,run]of Object.entries(saved.runs))if(run.version!==LEVELS[i]?.layoutVersion)delete saved.runs[i];
const runStore=()=>game.level.custom?saved.customRuns:saved.runs;
const saveJourney=()=>{if(game&&!game.level.playground&&!editor?.active&&!editor?.testing&&game.status!=='complete'&&game.checkpointId!=='start'){runStore()[game.index]=game.snapshot();persist();}};
const sound=new Sound();sound.enabled=saved.sound;
const input={left:false,right:false,moveAxis:0,jumpHeld:false,jumpPressed:false,stompPressed:false};
const pressed=new Set(),touchPointers=new Map();
let joystick,shapingControls;
const clearInput=()=>{shapingControls?.clear();pressed.clear();touchPointers.clear();joystick?.reset();for(const k of Object.keys(input))input[k]=false;input.moveAxis=0;document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));};
let world,game,editor,healthHUD,titleScene,worldError,worldRequested=false,assetsReady=false,worldLoading=null,menu=true,introUntil=0,hintKey='',hintUntil=0,dismissed=new Set(),toastTimer,dialogOrigin='menu',lastFocus=null,lastResult=null,hitStop=0,fullscreenTransition=0,chapterRequest=0,dialogFocusTimer,completionTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2100);}
function onEvent(e){
  if(e.type==='press-impact'&&world&&Math.abs(world.cameraX-e.x)>world.viewW*.8)return;
  world?.event(e);sound.effect(e.type==='shape'?'activate':e.type,e);
  if(e.type==='coin'||e.type==='stamp'){const el=$(e.type==='coin'?'coin-count':'stamp-count');el.animate?.([{transform:'scale(1)'},{transform:'scale(1.4)'},{transform:'scale(1)'}],{duration:190});}
  if(!world?.reducedMotion){if(e.type==='break'||e.type==='squish')hitStop=.035;if(e.type==='hurt')hitStop=.055;}
  if(e.type==='checkpoint')saveJourney();
  if(e.type==='mother-defeat')saveJourney();
  if(e.type==='stamp')saveJourney();
  if(e.type==='activate'){toast(e.message?.split(' · ')[0]||'Mechanism opened');saveJourney();}
  // The hand cue is a tutorial, not furniture: once a few stations have been
  // finished, the violet clay and its idle squash carry the message alone.
  if(e.type==='shape'){
    const done=new Set(saved.clayDone||[]);done.add(e.id);saved.clayDone=[...done];
    if(world)world.clayDone=done;
    persist();saveJourney();
  }
  if(e.type==='pause')saveJourney();
  if(e.type==='fall'){$('fade').classList.add('active');}
  if(e.type==='respawn')$('fade').classList.remove('active');
  if(e.type==='complete'){
    clearInput();show('hint',false);show('touch-controls',false);show('desktop-controls',false);show('timer',false);
    if(game.level.playground){openDialog(`<span class="eyebrow">CLAY PLAYGROUND</span><h2>A world shaped by you.</h2><p>You reached the Hanging Quarter’s bell. Keep experimenting with the five clay stations.</p><button class="primary" data-action="playground">Play again</button><button class="secondary" data-action="home">Return to title</button>`);return;}
    if(editor?.testing){openDialog(`<span class="eyebrow">WORKSHOP PLAYTEST</span><h2>You reached the bell.</h2><p>Your design is saved. Return to the workshop to keep shaping the next leap.</p><button class="primary" data-action="back-editor">${icon('pencil-ruler')} Back to editor</button><button class="secondary" data-action="restart-test">${icon('rotate-ccw')} Test again</button>`,'test');return;}
    const bestStore=game.level.custom?saved.customBest:saved.best;
    const record=completionRecord(e,game.level,bestStore[e.index]);
    if(record.previous&&!game.level.custom){saved.previousRoutes??={};saved.previousRoutes[e.index]=record.previous;}
    bestStore[e.index]=record.best;delete runStore()[e.index];saved.last=Math.min(LEVELS.length-1,e.index+1);persist();
    lastResult=record.result;clearTimeout(completionTimer);
    completionTimer=setTimeout(()=>{if(game.status==='complete'&&game.index===e.index)result(record.result);},750);
  }
}
game=new Game(onEvent);
saved.last=Math.max(0,Math.min(LEVELS.length-1,Math.floor(Number(saved.last)||0)));
function updatePlayLabel(){
  const level=activeLevel(saved.last),run=(level.custom?saved.customRuns:saved.runs)[saved.last];
  const resume=run?.version===level.layoutVersion;
  $('play-label').textContent=resume?'Continue':'Play';
  $('play').setAttribute('aria-label',`${resume?'Continue':'Play'} ${level.short}`);
}
// The title warms the shared renderer and assets without blocking its controls.
// Play/editor join the same promise; chapter-only models still load on demand.
async function ensureWorld(blocking=true){
  if(assetsReady)return true;
  if(blocking){
    worldRequested=true;$('menu').inert=true;$('loading').style.opacity='1';show('loading',true);show('error',false);
    $('loading-fill').style.width='0%';$('loading-status').textContent='Shaping the clay world…';
  }
  if(worldError){if(blocking){show('loading',false);show('error',true);$('error-home').focus();}return false;}
  if(worldLoading)return worldLoading;
  worldLoading=Promise.resolve().then(async()=>{
    if(!world)world=new World($('world'),{onProgress(ratio){
      if(ratio===null)return;
      $('loading-progress').classList.add('determinate');$('loading-fill').style.width=`${Math.round(ratio*100)}%`;
      $('loading-status').textContent=ratio<1?`Shaping the clay world · ${Math.round(ratio*100)}%`:'Finding our feet…';
    }});
    await world.ready;
    await loadTitleAssets(world);
    healthHUD??=new HealthHUD(world,$('health'));
    titleScene=new TitleScene(world);if(menu)titleScene.show();
    editor.world=world;assetsReady=true;
    document.body.classList.add('title-scene-ready');$('title-scene-status').textContent='';
    $('menu').inert=!$('dialog').classList.contains('hidden');show('loading',false);
    prev=performance.now();return true;
  }).catch(err=>{
    worldError=err;
    console.error('World loading failed',err);clearInput();game.pause();show('loading',false);
    $('error-text').textContent='The clay world could not load. Check your connection and enable graphics acceleration, then try again. Your progress is safe.';
    $('title-scene-status').textContent='Enable graphics acceleration to view the 3D world.';
    if(worldRequested){show('error',true);$('error-home').focus();}else $('menu').inert=!$('dialog').classList.contains('hidden');
    return false;
  });
  return worldLoading;
}
const fullscreen=new Fullscreen({
  onChange(active){
    fullscreenTransition=performance.now()+750;clearInput();document.body.classList.toggle('is-fullscreen',active);
    document.querySelectorAll('[data-fullscreen]').forEach(b=>{b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');b.title=active?'Exit fullscreen (F)':'Fullscreen (F)';b.innerHTML=icon(active?'minimize':'expand')+(b.dataset.fullscreen==='label'?`<span>${active?'Exit fullscreen':'Fullscreen'}</span>`:'');});
    icons();requestAnimationFrame(()=>world?.resize());
  },
  onUnavailable(){toast('Fullscreen is unavailable here. Open the game in your browser.');}
});

function resetDialog(){clearTimeout(dialogFocusTimer);clearTimeout(completionTimer);document.body.classList.remove('is-complete');$('dialog').classList.remove('is-completion');$('hud').inert=false;$('menu').inert=false;}
function showPlaying(){titleScene?.hide();menu=false;resetDialog();lastResult=null;document.body.classList.remove('is-menu');show('menu',false);show('hud',true);show('touch-controls',true);show('desktop-controls',false);show('dialog',false);}
async function begin(index=0,restart=false,sourceChoice,playgroundSource=null){
  saveJourney();
  if(editor)editor.request++;
  sound.unlock();
  index=Math.max(0,Math.min(LEVELS.length-1,Number(index)||0));const request=++chapterRequest;
  if(!await ensureWorld()||request!==chapterRequest)return;
  const choice=['original','edited'].includes(sourceChoice)?sourceChoice:saved.chapterSource[index];
  const nextLevel=playgroundSource||(choice==='original'?LEVELS[index]:drafts.get(index));
  {
    const assetName={forest:'woodland',cave:'glowing caverns',citadel:'cloudtop castle',desert:'canyon'}[nextLevel.biome]||'chapter';
    clearInput();game.pause();$('loading').style.opacity='1';show('loading',true);
    $('loading-fill').style.width='0%';$('loading-status').textContent=`Loading the ${assetName}…`;
    try{
      await world.prepareLevel(nextLevel,ratio=>{if(ratio!==null&&request===chapterRequest){$('loading-fill').style.width=`${Math.round(ratio*100)}%`;$('loading-status').textContent=`Loading the ${assetName} · ${Math.round(ratio*100)}%`;}});
    }catch(error){
      if(request!==chapterRequest)return;
      console.error('Chapter assets failed to load',error);show('loading',false);$('error-text').textContent=`The ${assetName} could not load. Check your connection and try again.`;show('error',true);return;
    }
    if(request!==chapterRequest)return;show('loading',false);
  }
  clearInput();showPlaying();dismissed=new Set();hintKey='';hitStop=0;
  game.start(index,nextLevel);if(restart&&!nextLevel.playground)delete runStore()[index];
  const resumed=!nextLevel.playground&&!restart&&game.restore(runStore()[index]);world.build(game.level,index,game.player.x);if(!nextLevel.playground)saved.last=index;
  if(choice&&!nextLevel.playground)saved.chapterSource[index]=choice;persist();
  const L=game.level;world.clayDone=new Set(saved.clayDone||[]);warmCompletionAssets(L.biome);document.body.dataset.biome=L.biome;
  $('coin-total').textContent=L.coins.length;$('intro-number').textContent=['CHAPTER ONE','CHAPTER TWO','CHAPTER THREE','CHAPTER FOUR'][index];
  $('intro-name').textContent=resumed?game.level.sections[game.sectionId].name:L.name;$('intro-text').textContent=resumed?'Your checkpoint is safe. The journey continues.':L.intro;
  show('chapter-intro',false);introUntil=0;
  show('hint',false);$('fade').classList.remove('active');$('play').blur();
}
function home(){saveJourney();clearInput();resetDialog();lastResult=null;menu=true;game.status='menu';document.body.classList.add('is-menu');document.body.dataset.biome='desert';show('menu',true);['hud','dialog','hint','chapter-intro','touch-controls','desktop-controls','timer','error','loading'].forEach(id=>show(id,false));game.load(0);game.status='menu';titleScene?.show();$('fade').classList.remove('active');updatePlayLabel();icons();$('play').focus();}
function openDialog(html,origin=menu?'menu':'game'){
  if(!$('dialog').contains(document.activeElement))lastFocus=document.activeElement;
  dialogOrigin=origin;clearInput();if(game.status==='playing')game.pause();
  clearTimeout(dialogFocusTimer);$('dialog').classList.toggle('is-completion',origin==='complete');$('menu').inert=true;$('hud').inert=true;
  show('hint',false);show('touch-controls',false);show('chapter-intro',false);$('dialog-content').innerHTML=html;show('dialog',true);icons();
  const heading=$('dialog-content').querySelector('h2');if(heading)heading.id='dialog-title';
  $('dialog').scrollTop=0;$('dialog-content').scrollTop=0;
  dialogFocusTimer=setTimeout(()=>$('dialog-content').querySelector('button')?.focus({preventScroll:true}),0);
}
function closeDialog(){if(!menu&&game.status==='complete'&&lastResult){result(lastResult);return;}show('dialog',false);resetDialog();if(!menu&&game.status==='paused'){game.resume();show('touch-controls',true);}(lastFocus?.isConnected?lastFocus:$(menu?'play':'pause')).focus();clearInput();}
function pause(){
  if(game.status!=='playing'&&game.status!=='paused')return;
  if(game.status==='paused'){closeDialog();return;}
  if(editor?.testing){openDialog(`<span class="eyebrow">WORKSHOP PLAYTEST</span><h2>One more little tweak?</h2><button class="primary" data-action="resume">Keep testing ${icon('play')}</button><div class="dialog-actions"><button class="secondary" data-action="restart-test">${icon('rotate-ccw')} Restart test</button><button class="secondary" data-action="back-editor">${icon('pencil-ruler')} Back to editor</button></div>`,'test');return;}
  openDialog(`<button class="dialog-close" data-action="resume" aria-label="Resume game">${icon('x')}</button><span class="eyebrow">TAKE YOUR TIME</span><h2>A little breather.</h2><p>${game.level.name} · ${game.level.sections[game.sectionId].name}</p><button class="primary" data-action="resume">Keep going ${icon('play')}</button><div class="dialog-actions"><button class="secondary" data-action="restart">${icon('rotate-ccw')} Start over</button><button class="secondary" data-action="chapters">${icon('layers-2')} Chapters</button></div>${game.level.playground?'<button class="quiet-button" data-action="stations">Choose a shaping station</button>':`<button class="quiet-button" data-action="editor">${icon('pencil-ruler')} Edit this chapter</button>`}<button class="quiet-button" data-action="sound">${icon(sound.enabled?'volume-2':'volume-x')} Sound ${sound.enabled?'on':'off'}</button><button class="quiet-button" data-action="fullscreen" data-fullscreen="label">${icon(fullscreen.active?'minimize':'expand')}<span>${fullscreen.active?'Exit fullscreen':'Fullscreen'}</span></button><button class="quiet-button" data-action="home">Return to title</button>`);
}
function chapters(){
  const choices=LEVELS.map((base,i)=>{const L=activeLevel(i),edited=drafts.has(i),run=(L.custom?saved.customRuns:saved.runs)[i],best=(L.custom?saved.customBest:saved.best)[i];return `<div class="chapter-option"><button class="chapter-choice" data-level="${i}"><span>0${i+1}</span><div><strong>${L.short}${edited?L.custom?' · Your edit':' · Original':''}</strong><small>${L.sections.length} passages${run?.version===L.layoutVersion?' · Checkpoint saved':best?.version===L.layoutVersion?` · ${best.stamps}/${L.stamps.length} flowers`:''}</small></div>${icon('arrow-up-right')}</button>${edited?`<button class="quiet-button chapter-alternate" data-level="${i}" data-source="${L.custom?'original':'edited'}">${icon(L.custom?'refresh-cw':'pencil-ruler')} ${L.custom?'Play updated original':'Play your edit'}</button>`:''}</div>`;}).join('');
  openDialog(`<button class="dialog-close" data-action="close" aria-label="Close chapters">${icon('x')}</button><span class="eyebrow">FOUR CHAPTERS</span><h2>Choose your path.</h2><div class="chapters-list">${choices}</div><p>Original chapters include the latest updates. Your edits and their checkpoints are kept separately on this device.</p>`);
}
function help(){
  openDialog(`<button class="dialog-close" data-action="close" aria-label="Close help">${icon('x')}</button><span class="eyebrow">HOW TO PLAY</span><h2>Controls.</h2><div class="control-list"><div class="control-row">${hintIcon('walk')}<div><strong>A / D or ← / → to move</strong><span>On a phone, drag the joystick — farther to run.</span></div></div><div class="control-row">${hintIcon('jump')}<div><strong>Space, W or ↑ to jump</strong><span>Hold for a longer leap. Land on claylings to squish them.</span></div></div><div class="control-row">${hintIcon('drop')}<div><strong>S or ↓ to stomp in the air</strong><span>Breaks sealed caps, drops you through thin ledges, bounces you higher off mushrooms.</span></div></div><div class="control-row">${hintIcon('knead')}<div><strong>Violet clay can be shaped</strong><span>Tap or drag it, hold E, or stomp it — violet clay breathes when you are beside it and stretches into ramps, stairs and bridges. R softens it back.</span></div></div><div class="control-row">${hintIcon('bell')}<div><strong>Ring the bell at the end of each chapter</strong><span>Orange flags save your place. Collect beads and hidden flowers.</span></div></div></div><button class="primary" data-action="${menu?'play':'resume'}">${menu?"Let's leap":'Keep going'} ${icon('arrow-right')}</button>`);
}
function collectibles(){openDialog(collectiblesMarkup(LEVELS.map((_,i)=>activeLevel(i)),saved));}
function settings(){openDialog(settingsMarkup(sound.enabled,fullscreen.active));}
function result(e){
  lastResult=e;document.body.classList.add('is-complete');
  openDialog(completionMarkup(e,game.level,LEVELS.length),'complete');
}
editor=new LevelEditor({world,game,levels:LEVELS,library:drafts,
  onFullscreen(){fullscreenTransition=performance.now()+1000;fullscreen.toggle();},
  onEnter(){titleScene?.hide();clearInput();resetDialog();lastResult=null;menu=false;hitStop=0;document.body.classList.remove('is-menu');['menu','hud','dialog','hint','chapter-intro','touch-controls','desktop-controls','timer'].forEach(id=>show(id,false));$('fade').classList.remove('active');},
  onTest(index,level,spawn){
    clearInput();showPlaying();game.start(index,level);
    if(spawn){Object.assign(game.player,spawn,{coyote:.135});game.checkpoint={x:spawn.x,y:spawn.y};game.checkpointId=spawn.groundId;}
    world.build(game.level,index,game.player.x);document.body.dataset.biome=level.biome;$('coin-total').textContent=level.coins.length;introUntil=0;dismissed=new Set();show('chapter-intro',false);$('fade').classList.remove('active');
  },
  onExit(){saved.last=editor.session.index;if(drafts.has(saved.last))saved.chapterSource[saved.last]='edited';persist();home();}
});
async function openEditor(){saveJourney();clearInput();sound.unlock();if(!await ensureWorld())return;const index=menu?saved.last:game.index,focus=menu?null:{x:game.player.x,y:game.player.y};if(LEVELS[index].biome==='citadel'&&!world.castleAsset)toast('Opening the cloudtop workshop…');await editor.open(index,focus);}
$('open-editor').addEventListener('click',openEditor);$('return-editor').addEventListener('click',()=>{clearInput();editor.returnToEditor();});
function toggleSound(){sound.unlock();sound.enabled=!sound.enabled;saved.sound=sound.enabled;persist();$('menu-sound').innerHTML=icon(sound.enabled?'volume-2':'volume-x');$('menu-sound').setAttribute('aria-label',sound.enabled?'Mute sound':'Enable sound');$('menu-sound').setAttribute('aria-pressed',String(sound.enabled));icons();}
// Title music can unlock before a WebGL scene exists, including in its dialogs.
window.addEventListener('pointerdown',()=>sound.unlock(),{passive:true});
window.addEventListener('keydown',e=>{if(!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)sound.unlock();});
$('play').addEventListener('click',()=>begin(saved.last));$('chapters').addEventListener('click',chapters);$('howto').addEventListener('click',help);$('pause').addEventListener('click',pause);$('menu-sound').addEventListener('click',toggleSound);
$('collectibles').addEventListener('click',collectibles);$('settings').addEventListener('click',settings);$('error-home').addEventListener('click',home);
$('dismiss-hint').addEventListener('click',()=>{dismissed.add(hintKey);show('hint',false);});
for(const id of ['fullscreen','hud-fullscreen'])$(id).addEventListener('click',()=>{sound.unlock();fullscreenTransition=performance.now()+1000;fullscreen.toggle();});
async function playFullscreen(){sound.unlock();fullscreenTransition=performance.now()+1500;await fullscreen.enter();begin(saved.last);}
$('dialog-content').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;sound.unlock();
  if(b.hasAttribute('data-level')){begin(Number(b.dataset.level),false,b.dataset.source);return;}
  const a=b.dataset.action;
  if(a==='resume'||a==='close')closeDialog();if(a==='play')begin(saved.last);if(a==='restart')begin(game.index,true);if(a==='next')begin(game.index+1);if(a==='chapters')chapters();if(a==='home')home();
  if(a==='stations')stationPicker();
  if(b.dataset.station){visitStation(game,b.dataset.station);closeDialog();show('touch-controls',true);}
  if(a==='editor')openEditor();if(a==='back-editor')editor.returnToEditor();if(a==='restart-test')editor.playtest(false);
  if(a==='fullscreen'){fullscreenTransition=performance.now()+1000;fullscreen.toggle();}
  if(a==='sound'){toggleSound();b.innerHTML=`${icon(sound.enabled?'volume-2':'volume-x')} Sound ${sound.enabled?'on':'off'}`;icons();}
  if(a==='settings-sound'){toggleSound();b.setAttribute('aria-checked',String(sound.enabled));b.innerHTML=`${icon(sound.enabled?'volume-2':'volume-x')}<span>Sound</span><strong>${sound.enabled?'On':'Off'}</strong>`;icons();}
  if(a==='help')help();if(a==='play-fullscreen')playFullscreen();
});
const leftKeys=['ArrowLeft','KeyA'],rightKeys=['ArrowRight','KeyD'],jumpKeys=['Space','ArrowUp','KeyW'],stompKeys=['ArrowDown','KeyS'];
function syncInput(){
  const left=leftKeys.some(k=>pressed.has(k)),right=rightKeys.some(k=>pressed.has(k));
  input.moveAxis=(left||right)?Number(right)-Number(left):(joystick?.axis||0);
  input.left=input.moveAxis<0;input.right=input.moveAxis>0;input.jumpHeld=jumpKeys.some(k=>pressed.has(k))||[...touchPointers.values()].includes('jump');
}
window.addEventListener('keydown',e=>{
  if(editor?.active)return;
  if(e.code==='KeyF'){e.preventDefault();if(!e.repeat){sound.unlock();fullscreenTransition=performance.now()+1000;fullscreen.toggle();}return;}
  if(e.code==='Tab'&&!$('dialog').classList.contains('hidden')){
    const f=[...$('dialog').querySelectorAll('button:not(:disabled)')];if(!f.length)return;const i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}return;
  }
  if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!e.repeat){if(!$('dialog').classList.contains('hidden')){if(game.status==='paused'||menu||(game.status==='complete'&&dialogOrigin!=='complete'))closeDialog();}else pause();}return;}
  if(![...leftKeys,...rightKeys,...jumpKeys,...stompKeys].includes(e.code))return;
  if(menu&&e.code==='Space'&&$('dialog').classList.contains('hidden')){if(e.target.closest?.('button'))return;e.preventDefault();if(!e.repeat)begin(saved.last);return;}
  if(game.status!=='playing')return;e.preventDefault();sound.unlock();
  if(!pressed.has(e.code)){if(jumpKeys.includes(e.code))input.jumpPressed=true;if(stompKeys.includes(e.code))input.stompPressed=true;}pressed.add(e.code);syncInput();
});
window.addEventListener('keyup',e=>{pressed.delete(e.code);syncInput();});
joystick=new VirtualJoystick($('move-pad'),{enabled:()=>game.status==='playing',onStart:()=>sound.unlock(),onChange:syncInput});
for(const id of ['jump','stomp']){
  const b=$(id);
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(game.status!=='playing')return;sound.unlock();b.setPointerCapture(e.pointerId);touchPointers.set(e.pointerId,id);b.classList.add('pressed');if(id==='jump')input.jumpPressed=true;if(id==='stomp')input.stompPressed=true;syncInput();});
  const up=e=>{touchPointers.delete(e.pointerId);if(![...touchPointers.values()].includes(id))b.classList.remove('pressed');syncInput();};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
}
window.addEventListener('blur',()=>{sound.setForeground(false);clearInput();if(game.status==='playing'&&!fullscreen.pending&&performance.now()>fullscreenTransition)pause();});
function syncAudioFocus(){sound.update(0,game.status==='playing',game.index,game.level.sections[game.sectionId]?.quiet,menu,!!game.flowerCelebration,motherQuiet(game.level.boss),motherCorrupted(game));sound.setForeground(!document.hidden);}
window.addEventListener('focus',syncAudioFocus);
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden&&game.status==='playing')pause();syncAudioFocus();});
window.addEventListener('resize',clearInput);
window.addEventListener('orientationchange',clearInput);
window.addEventListener('pagehide',()=>{sound.setForeground(false);saveJourney();});
window.addEventListener('pageshow',syncAudioFocus);
window.addEventListener('contextmenu',e=>e.preventDefault());
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();game.pause();clearInput();$('error-text').textContent='The graphics connection was interrupted. Reload to continue — your latest checkpoint is saved.';show('error',true);});
function stationPicker(){
  if(!game.level.playground)return;
  openDialog(`<button class="dialog-close" data-action="resume" aria-label="Resume game">${icon('x')}</button><span class="eyebrow">CLAY PLAYGROUND</span><h2>Try a different shape.</h2><p>Drag the orange clay or hold E / KNEAD. R resets a station. Shapes stay until you restart the playground.</p><div class="chapters-list">${game.level.shaping.map((s,i)=>`<button class="chapter-choice" data-station="${s.id}"><span>0${i+1}</span><div><strong>${s.name}</strong><small>${s.verb} · ${Math.round(s.amount*100)}% shaped</small></div>${icon('arrow-up-right')}</button>`).join('')}</div>`);
}
shapingControls=new ShapingControls({game,world:()=>world,input,picker:stationPicker});
function updateHUD(now){
  updateMotherAtmosphere(game,$('mother-mist'),!menu&&!editor?.active&&game.status==='playing');
  if(editor?.active)return;
  const p=game.player;$('coin-count').textContent=game.coins;$('stamp-count').textContent=`${game.stamps}/${game.level.stamps.length}`;
  [...$('health').children].forEach((e,i)=>e.classList.toggle('empty',i>=p.health));$('health').setAttribute('aria-label',`${p.health} health remaining`);
  const channel=game.activeChannel,remaining=game.channels[channel]||0;show('timer',remaining>0&&game.status==='playing');if(remaining>0){$('timer-label').textContent=`${Math.ceil(remaining)}s`;$('timer-bar').style.width=`${remaining/(game.channelDurations[channel]||10)*100}%`;}
  if(now>introUntil)show('chapter-intro',false);
  if(menu||game.status!=='playing'||now<introUntil){show('hint',false);return;}
  const hint=game.level.hints.find(h=>p.x>=h.x&&p.x<=h.end&&(h.y===undefined||Math.abs(p.y-h.y)<4));
  const key=hint?`${game.index}:${hint.x}`:'';
  if(hintKey&&key!==hintKey)dismissed.add(hintKey);
  if(key&&key===hintKey&&now>=hintUntil)dismissed.add(key);
  const visible=!!hint&&!dismissed.has(key);show('hint',visible);
  if(visible&&hintKey!==key){hintKey=key;hintUntil=now+6500;$('hint-mark').innerHTML=hintIcon(hint.icon);$('hint-title').textContent=hint.title;const touch=matchMedia('(pointer:coarse), (max-width:850px)').matches;$('hint-text').textContent=touch?(hint.touchText||hint.text.replace('A / D or arrows to move.','Drag the joystick to move.').replace('↓ / S or STOMP','STOMP')):hint.text;}
}
let prev=performance.now(),accum=0,hudAccum=0;
function frame(now){
  shapingControls?.update();
  const dt=Math.min((now-prev)/1000,.06);prev=now;
  sound.update(dt,game.status==='playing',game.index,game.level.sections[game.sectionId]?.quiet,menu,!!game.flowerCelebration,motherQuiet(game.level.boss),motherCorrupted(game));
  if(!assetsReady||document.hidden){accum=0;requestAnimationFrame(frame);return;}
  if(menu){accum=0;titleScene?.render(dt);requestAnimationFrame(frame);return;}
  if(hitStop>0){hitStop=Math.max(0,hitStop-dt);accum=0;}else accum+=dt;
  while(accum>=FIXED_DT){game.tick(FIXED_DT,input);input.jumpPressed=false;input.stompPressed=false;accum-=FIXED_DT;if(hitStop>0){accum=0;break;}}
  world.render(game,dt,menu);if(!editor?.active&&!$('hud').classList.contains('hidden'))healthHUD?.draw(game,dt);editor?.draw();hudAccum+=dt;if(hudAccum>.06){updateHUD(now);hudAccum=0;}
  requestAnimationFrame(frame);
}
updatePlayLabel();icons();$('menu-sound').innerHTML=icon(sound.enabled?'volume-2':'volume-x');$('menu-sound').setAttribute('aria-label',sound.enabled?'Mute sound':'Enable sound');$('menu-sound').setAttribute('aria-pressed',String(sound.enabled));icons();
document.body.dataset.biome='desert';fullscreen.sync();
requestAnimationFrame(frame);
ensureWorld(false);
