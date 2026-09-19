import {Game,FIXED_DT} from './simulation.js';
import {HealthHUD} from './health-hud.js';
import {LEVELS} from './levels.js';
import {World} from './world.js';
import {Sound,windExposure} from './audio.js';
import {Fullscreen} from './fullscreen.js';
import {VirtualJoystick} from './controls.js';
import {completionMarkup,completionRecord,warmCompletionAssets} from './completion.js';
import {DraftLibrary} from './editor-model.js';
import {LevelEditor} from './editor.js';
import {chapterCollections,settingsMarkup,characterMarkup,stopMotionTuningMarkup} from './title-menu.js';
import {normalizeTuning,applyStopMotionTuning} from './stop-motion.js';
import clayLab from './routes/clay-lab.js';
import {CHARACTERS,characterChoice,DEFAULT_CHARACTER} from './characters.js';
import {TitleScene} from './title-scene.js';
import {CompletionScene} from './completion-scene.js';
import {loadTitleAssets} from './title-assets.js';
import {ShapingControls} from './shaping-controls.js';
import {visitStation} from './shaping.js';
import {shapedShare} from './clay-rules.js';
import {applyUIPalette} from './palette.js';
import {hintIcon} from './hint-icons.js';
import {GamepadInput} from './gamepad.js';
import {menuFocusables,moveMenuFocus,menuDirection,MenuRepeat} from './menu-controls.js';
import {Haptics} from './haptics.js';
import {motherQuiet,motherCorrupted} from './mother-puff-rules.js';
import {updateMotherAtmosphere} from './mother-puff-hud.js';

applyUIPalette(document.documentElement);

const $=id=>document.getElementById(id);
const icon=name=>`<i data-lucide="${name}"></i>`;
const icons=()=>window.lucide?.createIcons({attrs:{'stroke-width':1.7}});
const show=(id,visible)=>$(id).classList.toggle('hidden',!visible);
// Hiding the loading overlay always goes through here so a pending reveal can
// never dismiss a newer load's overlay behind its back.
function hideLoading(fade=false){
  clearTimeout(loadingRevealTimer);loadingRevealTimer=null;
  const overlay=$('loading');
  const settle=()=>{show('loading',false);overlay.classList.remove('is-revealing');overlay.style.opacity='1';};
  if(!fade||world?.reducedMotion){settle();return;}
  overlay.classList.add('is-revealing');overlay.style.opacity='0';
  loadingRevealTimer=setTimeout(()=>{loadingRevealTimer=null;settle();},300);
}
let draftStorage;try{draftStorage=localStorage;}catch{}
const drafts=new DraftLibrary(LEVELS,draftStorage);
let saved={last:0,best:{},runs:{},customBest:{},customRuns:{},sound:true,music:Sound.DEFAULT_MUSIC,effects:Sound.DEFAULT_EFFECTS,rumble:true,stopMotion:true,stopMotionChosen:false,clayDone:[]};
try{const s=JSON.parse(localStorage.getItem('claybound-v1'));if(s&&typeof s==='object')saved={...saved,...s,best:s.best||{}};}catch{}
const persist=()=>{try{localStorage.setItem('claybound-v1',JSON.stringify(saved));}catch{}};
saved.runs??={};
saved.customBest??={};saved.customRuns??={};
if(!saved.chapterSource||typeof saved.chapterSource!=='object'||Array.isArray(saved.chapterSource))saved.chapterSource={};
const activeLevel=index=>saved.chapterSource[index]==='original'?LEVELS[index]:drafts.get(index);
for(const [i,run]of Object.entries(saved.runs))if(run.version!==LEVELS[i]?.layoutVersion)delete saved.runs[i];
const runStore=()=>game.level.custom?saved.customRuns:saved.runs;
const saveJourney=()=>{if(game&&!game.level.playground&&!editor?.active&&!editor?.testing&&game.status!=='complete'&&game.checkpointId!=='start'){runStore()[game.index]=game.snapshot();persist();}};
const level=(value,fallback)=>Number.isFinite(Number(value))?Math.min(1,Math.max(0,Number(value))):fallback;
saved.music=level(saved.music,Sound.DEFAULT_MUSIC);saved.effects=level(saved.effects,Sound.DEFAULT_EFFECTS);saved.rumble=saved.rumble!==false;
// On unless the player has turned it off. Every save carried a false written by
// the earlier default, so the switch records that it was actually used, and a
// save it never touched takes the default — which is how the look reached the
// players who had never opened Settings when it went on by default.
saved.stopMotion=saved.stopMotionChosen===true?saved.stopMotion===true:true;
// The look's numbers, clamped to their sliders' ranges; a missing one is the default.
saved.stopMotionTuning=normalizeTuning(saved.stopMotionTuning);
// A character that has since been withdrawn falls back to the original rather
// than leaving the world with nobody in it.
// Who you play as. A save that never had the picker unlocked never made a
// choice, so it wears the default — which is how a new default reaches the
// players who never opened the cast; a save with the picker unlocked keeps
// whatever it says.
saved.character=saved.charactersUnlocked?characterChoice(saved.character).id:DEFAULT_CHARACTER;
const sound=new Sound();sound.enabled=saved.sound;sound.musicLevel=saved.music;sound.effectsLevel=saved.effects;
const pads=new GamepadInput();
const haptics=new Haptics(pads,{enabled:saved.rumble});
const input={left:false,right:false,moveAxis:0,jumpHeld:false,jumpPressed:false,stompPressed:false};
const pressed=new Set(),touchPointers=new Map();
let padSteer=0,padHeld=false;
let joystick,shapingControls;
const clearInput=()=>{shapingControls?.clear();pressed.clear();touchPointers.clear();joystick?.reset();for(const k of Object.keys(input))input[k]=false;input.moveAxis=0;document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));};
// A resize is a change of layout, not a loss of focus — going fullscreen with F
// fires one mid-stride. Thumbs on a moved joystick do have to be let go of, but
// the keyboard never went anywhere: dropping a held E or D here stopped the
// clay and the player dead until the player thought to release and press again.
const clearPointerInput=()=>{shapingControls?.release();touchPointers.clear();joystick?.reset();document.querySelectorAll('.pressed').forEach(e=>e.classList.remove('pressed'));syncInput();};
let world,game,editor,healthHUD,titleScene,completionScene,worldError,worldRequested=false,assetsReady=false,worldLoading=null,menu=true,introUntil=0,hintKey='',hintUntil=0,dismissed=new Set(),toastTimer,dialogOrigin='menu',lastFocus=null,lastResult=null,hitStop=0,fullscreenTransition=0,chapterRequest=0,dialogFocusTimer,completionTimer,loadingRevealTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2100);}
function onEvent(e){
  if(e.type==='press-impact'&&world&&Math.abs(world.cameraX-e.x)>world.viewW*.8)return;
  world?.event(e);sound.effect(e.type==='shape'?'activate':e.type,e);
  if(e.type==='coin'||e.type==='stamp'){const el=$(e.type==='coin'?'coin-count':'stamp-count');el.animate?.([{transform:'scale(1)'},{transform:'scale(1.4)'},{transform:'scale(1)'}],{duration:190});}
  if(!world?.reducedMotion){
    if(e.type==='break'||e.type==='squish')hitStop=.035;
    if(e.type==='hurt')hitStop=.055;
    // A heavy arrival holds the frame for a moment, which is what reads as
    // weight. The gate sits clear of the median landing rather than on top of
    // it, so this stays an event and never becomes a stutter under running.
    if(e.type==='land'&&e.impact>13)hitStop=Math.max(hitStop,Math.min(.055,.02+e.impact*.0014));
  }
  haptics.pulse(e);
  if(e.type==='checkpoint')saveJourney();
  if(e.type==='mother-defeat')saveJourney();
  if(e.type==='stamp')saveJourney();
  if(e.type==='activate')saveJourney();
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
    if(game.level.playground){openDialog(`<span class="eyebrow">CLAY LAB</span><h2>A bench well used.</h2><p>You rang the lab bell. Every experiment is still there — jump straight to any of them from the pause menu.</p><button class="primary" data-action="playground">Back to the bench</button><button class="secondary" data-action="home">Return to title</button>`);return;}
    if(editor?.testing){openDialog(`<span class="eyebrow">WORKSHOP PLAYTEST</span><h2>You reached the bell.</h2><p>Your design is saved. Return to the workshop to keep shaping the next leap.</p><button class="primary" data-action="back-editor">${icon('pencil-ruler')} Back to editor</button><button class="secondary" data-action="restart-test">${icon('rotate-ccw')} Test again</button>`,'test');return;}
    const bestStore=game.level.custom?saved.customBest:saved.best;
    const record=completionRecord(e,game.level,bestStore[e.index]);
    if(record.previous&&!game.level.custom){saved.previousRoutes??={};saved.previousRoutes[e.index]=record.previous;}
    bestStore[e.index]=record.best;delete runStore()[e.index];saved.last=Math.min(lastShown(),e.index+1);persist();
    lastResult=record.result;clearTimeout(completionTimer);
    completionTimer=setTimeout(()=>{if(game.status==='complete'&&game.index===e.index)result(record.result);},750);
  }
}
game=new Game(onEvent);
// A chapter marked hidden is kept out of the list, the progression and the
// editor until someone has typed ß with the chapter list open — the same key
// that reveals the Clay Lab — so the last shown chapter is the last chapter.
const shown=i=>!LEVELS[i]?.hidden||!!saved.labUnlocked;
const lastShown=()=>{let i=LEVELS.length-1;while(i>0&&!shown(i))i--;return i;};
saved.last=Math.max(0,Math.min(lastShown(),Math.floor(Number(saved.last)||0)));
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
  if(worldError){if(blocking){hideLoading();show('error',true);$('error-home').focus();}return false;}
  if(worldLoading)return worldLoading;
  worldLoading=Promise.resolve().then(async()=>{
    if(!world)world=new World($('world'),{character:saved.character,stopMotion:saved.stopMotion,stopMotionTuning:saved.stopMotionTuning,onProgress(ratio){
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
    $('menu').inert=!$('dialog').classList.contains('hidden');hideLoading();
    prev=performance.now();return true;
  }).catch(err=>{
    worldError=err;
    console.error('World loading failed',err);clearInput();game.pause();hideLoading();
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

function resetDialog(){clearTimeout(dialogFocusTimer);clearTimeout(completionTimer);document.body.classList.remove('is-complete');document.body.classList.remove('has-completion-diorama');completionScene?.hide();$('dialog').classList.remove('is-completion');$('hud').inert=false;$('menu').inert=false;}
function showPlaying(){titleScene?.hide();menu=false;resetDialog();lastResult=null;document.body.classList.remove('is-menu');show('menu',false);show('hud',true);show('touch-controls',true);show('desktop-controls',false);show('dialog',false);}
async function begin(index=0,restart=false,sourceChoice,playgroundSource=null){
  saveJourney();
  if(editor)editor.request++;
  sound.unlock();
  index=Math.max(0,Math.min(LEVELS.length-1,Number(index)||0));if(!playgroundSource&&!shown(index))index=lastShown();const request=++chapterRequest;
  if(!await ensureWorld()||request!==chapterRequest)return;
  const choice=['original','edited'].includes(sourceChoice)?sourceChoice:saved.chapterSource[index];
  const nextLevel=playgroundSource||(choice==='original'?LEVELS[index]:drafts.get(index));
  {
    const assetName={forest:'woodland',cave:'glowing caverns',citadel:'cloudtop castle',desert:'canyon',dream:'soft dream'}[nextLevel.biome]||'chapter';
    clearInput();game.pause();hideLoading();$('loading').style.opacity='1';show('loading',true);
    // A response with no Content-Length reports a null ratio, so start on the
    // indeterminate sweep rather than a bar sitting dead at zero per cent.
    $('loading-progress').classList.remove('determinate');$('loading-fill').style.width='';
    $('loading-status').textContent=`Loading the ${assetName}…`;
    try{
      await world.prepareLevel(nextLevel,ratio=>{if(ratio!==null&&request===chapterRequest){$('loading-progress').classList.add('determinate');$('loading-fill').style.width=`${Math.round(ratio*100)}%`;$('loading-status').textContent=`Loading the ${assetName} · ${Math.round(ratio*100)}%`;}});
    }catch(error){
      if(request!==chapterRequest)return;
      console.error('Chapter assets failed to load',error);hideLoading();$('error-text').textContent=`The ${assetName} could not load. Check your connection and try again.`;show('error',true);return;
    }
    if(request!==chapterRequest)return;
    // Downloading is only half the wait: world.build then welds the whole
    // chapter on the main thread and paints nothing while it runs, so the
    // overlay stays up over that too. Dropping back to the indeterminate sweep
    // matters — it is a compositor-driven transform, so the bar keeps moving
    // while the main thread is blocked and the screen still reads as alive.
    $('loading-progress').classList.remove('determinate');$('loading-fill').style.width='';
    $('loading-status').textContent=`Shaping the ${assetName}…`;
  }
  clearInput();showPlaying();dismissed=new Set();hintKey='';hitStop=0;
  game.start(index,nextLevel);if(restart&&!nextLevel.playground)delete runStore()[index];
  const resumed=!nextLevel.playground&&!restart&&game.restore(runStore()[index]);world.build(game.level,index,game.player.x);if(!nextLevel.playground)saved.last=index;
  if(choice&&!nextLevel.playground)saved.chapterSource[index]=choice;persist();
  const L=game.level;world.clayDone=new Set(saved.clayDone||[]);warmCompletionAssets(L.biome);document.body.dataset.biome=L.biome;
  $('coin-total').textContent=L.coins.length;$('intro-number').textContent=['CHAPTER ONE','CHAPTER TWO','CHAPTER THREE','CHAPTER FOUR','CHAPTER FIVE'][index];
  $('intro-name').textContent=resumed?game.level.sections[game.sectionId].name:L.name;$('intro-text').textContent=resumed?'Your checkpoint is safe. The journey continues.':L.intro;
  show('chapter-intro',false);introUntil=0;
  show('hint',false);$('fade').classList.remove('active');$('play').blur();
  // The build blocked for as long as it blocked; start the frame clock fresh so
  // the first step is not a catch-up. Uncovering here is safe: animation frames
  // run before the browser paints, so the frame loop draws the built chapter in
  // the very frame that removes the overlay.
  prev=performance.now();hideLoading(true);
}
function home(){saveJourney();clearInput();resetDialog();lastResult=null;menu=true;game.status='menu';document.body.classList.add('is-menu');document.body.dataset.biome='desert';show('menu',true);['hud','dialog','hint','chapter-intro','touch-controls','desktop-controls','timer','error'].forEach(id=>show(id,false));hideLoading();game.load(0);game.status='menu';titleScene?.show();$('fade').classList.remove('active');updatePlayLabel();icons();$('play').focus();}
// The menu the keys and the pad steer right now: a dialog over everything,
// else the error screen, else the title while it is live — never gameplay.
const menuRoot=()=>!$('dialog').classList.contains('hidden')?$('dialog'):!$('error').classList.contains('hidden')?$('error'):menu&&!$('menu').inert&&!$('menu').classList.contains('hidden')?$('menu'):null;
// Focus moved by script shows no ring on a pad, and the browsers disagree
// about it after a key, so the body says when a menu is being steered and the
// stylesheet draws the cursor from that. A pointer press takes it away again.
const menuKeys=on=>document.body.classList.toggle('menu-keys',on);
// Escape, B and Start back out of whatever is up: a dialog closes where it is
// allowed to (the completion diorama is not), and otherwise the game pauses.
// The error screen is left alone so nothing resumes behind it.
function backOut(){if(!$('error').classList.contains('hidden'))return;if(!$('dialog').classList.contains('hidden')){if(game.status==='paused'||menu||(game.status==='complete'&&dialogOrigin!=='complete'))closeDialog();}else pause();}
function openDialog(html,origin=menu?'menu':'game'){
  if(!$('dialog').contains(document.activeElement))lastFocus=document.activeElement;
  dialogOrigin=origin;clearInput();if(game.status==='playing')game.pause();
  clearTimeout(dialogFocusTimer);$('dialog').classList.toggle('is-completion',origin==='complete');$('menu').inert=true;$('hud').inert=true;
  show('hint',false);show('touch-controls',false);show('chapter-intro',false);$('dialog-content').innerHTML=html;show('dialog',true);icons();
  const heading=$('dialog-content').querySelector('h2');if(heading)heading.id='dialog-title';
  $('dialog').scrollTop=0;$('dialog-content').scrollTop=0;
  // The cursor starts on the first real choice, not on the X in the corner.
  // The completion diorama comes up without the steering mark: its first
  // frame is the composed stage, and the ring arrives with the first press.
  if(origin==='complete')menuKeys(false);
  dialogFocusTimer=setTimeout(()=>{const f=menuFocusables($('dialog-content'));(f.find(el=>!el.classList.contains('dialog-close'))||f[0])?.focus({preventScroll:true});},0);
}
function closeDialog(){if(!menu&&game.status==='complete'&&lastResult){result(lastResult);return;}show('dialog',false);resetDialog();if(!menu&&game.status==='paused'){game.resume();show('touch-controls',true);}(lastFocus?.isConnected?lastFocus:$(menu?'play':'pause')).focus();clearInput();}
function pause(){
  if(game.status!=='playing'&&game.status!=='paused')return;
  if(game.status==='paused'){closeDialog();return;}
  if(editor?.testing){openDialog(`<span class="eyebrow">WORKSHOP PLAYTEST</span><h2>One more little tweak?</h2><button class="primary" data-action="resume">Keep testing ${icon('play')}</button><div class="dialog-actions"><button class="secondary" data-action="restart-test">${icon('rotate-ccw')} Restart test</button><button class="secondary" data-action="back-editor">${icon('pencil-ruler')} Back to editor</button></div>`,'test');return;}
  openDialog(`<button class="dialog-close" data-action="resume" aria-label="Resume game">${icon('x')}</button><span class="eyebrow">TAKE YOUR TIME</span><h2>A little breather.</h2><p>${game.level.name} · ${game.level.sections[game.sectionId].name}</p><button class="primary" data-action="resume">Keep going ${icon('play')}</button><div class="dialog-actions"><button class="secondary" data-action="restart">${icon('rotate-ccw')} Start over</button><button class="secondary" data-action="chapters">${icon('layers-2')} Chapters</button></div>${game.level.playground?'<button class="quiet-button" data-action="stations">Choose a shaping station</button>':''}<button class="quiet-button" data-action="home">Return to title</button><div class="dialog-icons">${game.level.playground?'':`<button class="icon-button" data-action="editor" aria-label="Edit this chapter" title="Edit this chapter">${icon('pencil-ruler')}</button>`}<button class="icon-button" data-action="sound" aria-label="Sound ${sound.enabled?'on':'off'}" title="Sound ${sound.enabled?'on':'off'}">${icon(sound.enabled?'volume-2':'volume-x')}</button><button class="icon-button" data-action="fullscreen" data-fullscreen aria-label="${fullscreen.active?'Exit fullscreen':'Fullscreen'}" title="${fullscreen.active?'Exit fullscreen':'Fullscreen'} (F)">${icon(fullscreen.active?'minimize':'expand')}</button></div>`);
}
function chapters(){
  const choices=LEVELS.map((base,i)=>{if(!shown(i))return '';const L=activeLevel(i),edited=drafts.has(i),run=(L.custom?saved.customRuns:saved.runs)[i],r=chapterCollections(L,i,saved);return `<div class="chapter-option"><button class="chapter-choice" data-level="${i}"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${L.short}${edited?L.custom?' · Your edit':' · Original':''}</strong><small>${L.sections.length} passages${run?.version===L.layoutVersion?' · Checkpoint saved':''}</small><span class="chapter-collectibles"><img src="./assets/completion/flower.webp" alt="" class="chapter-flower" width="16" height="16">${r.stamps}/${r.stampTotal}<img src="./assets/completion/bead.webp" alt="" class="chapter-bead" width="16" height="16">${r.coins}/${r.coinTotal}</span></div>${icon('arrow-up-right')}</button>${edited?`<button class="quiet-button chapter-alternate" data-level="${i}" data-source="${L.custom?'original':'edited'}">${icon(L.custom?'refresh-cw':'pencil-ruler')} ${L.custom?'Play updated original':'Play your edit'}</button>`:''}</div>`;}).join('');
  // The lab is not a chapter and keeps no record: it is a bench of ideas that
  // are not in the game yet, so it sits under the five rather than among them —
  // and, like the cast and the chapter still being built, only once someone
  // has typed ß with this list open.
  const lab=saved.labUnlocked?labMarkup():'';
  openDialog(`<button class="dialog-close" data-action="close" aria-label="Close chapters">${icon('x')}</button><span class="eyebrow">${saved.labUnlocked?'FIVE CHAPTERS &amp; A CLAY LAB':'FOUR CHAPTERS'}</span><h2>Choose your path.</h2><div class="chapters-list">${choices}${lab}</div>`);
}
const labMarkup=()=>`<button class="chapter-choice playground-choice" data-action="playground"><span>${icon('pencil-ruler')}</span><div><strong>${clayLab.short}</strong><small>${clayLab.label}</small></div>${icon('arrow-up-right')}</button>`;
function help(){
  openDialog(`<button class="dialog-close" data-action="close" aria-label="Close help">${icon('x')}</button><span class="eyebrow">HOW TO PLAY</span><h2>Controls.</h2><div class="control-list"><div class="control-row">${hintIcon('walk')}<div><strong>A / D or ← / → to move</strong><span>On a phone, drag the joystick — farther to run. A controller's left stick or d-pad steers too.</span></div></div><div class="control-row">${hintIcon('jump')}<div><strong>Space, W or ↑ to jump</strong><span>Hold for a longer leap. Land on claylings to squish them. On a controller, A or Y.</span></div></div><div class="control-row">${hintIcon('drop')}<div><strong>S or ↓ to stomp in the air</strong><span>Breaks sealed caps, drops you through thin ledges, bounces you higher off mushrooms. On a controller, B, X or a trigger.</span></div></div><div class="control-row">${hintIcon('knead')}<div><strong>Violet clay can be shaped</strong><span>Tap or drag it, hold E, or stomp it — violet clay breathes when you are beside it and stretches into ramps, stairs and bridges. R softens it back.</span></div></div><div class="control-row">${hintIcon('menu')}<div><strong>Arrows or W / A / S / D steer the menus</strong><span>Enter or Space chooses, Escape backs out. On a controller: d-pad or stick, A to choose, B to go back.</span></div></div><div class="control-row">${hintIcon('bell')}<div><strong>Ring the bell at the end of each chapter</strong><span>Orange flags save your place. Collect beads and hidden flowers.</span></div></div></div><button class="primary" data-action="${menu?'play':'resume'}">${menu?"Let's leap":'Keep going'} ${icon('arrow-right')}</button>`);
}
function settings(){openDialog(settingsMarkup(sound.enabled,fullscreen.active,{music:saved.music,effects:saved.effects,rumble:saved.rumble,stopMotion:saved.stopMotion,stopMotionTuning:saved.stopMotionTuning,characters:CHARACTERS,character:saved.character,charactersUnlocked:saved.charactersUnlocked}));}
// The cast is not part of the game a first-time player meets, so the picker is
// hidden until someone types ß with the settings panel open. Found once, it
// stays: an unlock you have to rediscover on every visit is a nuisance, not a
// secret. The volume sliders are the panel's landmark, and the picker belongs
// directly beneath them.
// The Clay Lab is hidden the same way: ß with the chapter list open adds it
// under the five, and keeps it there.
window.addEventListener('keydown',e=>{
  if(e.key!=='ß'||$('dialog').classList.contains('hidden'))return;
  const content=$('dialog-content');
  if(!saved.charactersUnlocked){
    const sliders=content.querySelector('.title-levels');
    if(sliders&&content.querySelector('[data-action="settings-rumble"]')){
      saved.charactersUnlocked=true;persist();
      sliders.insertAdjacentHTML('afterend',characterMarkup(CHARACTERS,saved.character));
      icons();toast('Characters unlocked.');return;
    }
  }
  if(!saved.labUnlocked){
    const list=content.querySelector('.chapters-list');
    if(list&&content.querySelector('.chapter-choice[data-level]')){
      saved.labUnlocked=true;persist();
      // The list is drawn again rather than appended to: the unlock also adds
      // the chapter still being built, in its place among the others.
      chapters();toast('Clay Lab and The Soft Dream unlocked.');
    }
  }
});
// The choice is kept even when there is no world yet to show it in: whoever is
// chosen here is who the renderer loads when it starts.
async function chooseCharacter(id){
  if(saved.character===id)return;
  saved.character=id;persist();
  for(const row of $('dialog-content').querySelectorAll('[data-character]')){
    const chosen=row.dataset.character===id;
    row.setAttribute('aria-checked',String(chosen));
    row.querySelector(':scope>svg,:scope>i')?.remove();
    if(chosen)row.insertAdjacentHTML('beforeend',icon('check'));
  }
  icons();
  if(!world)return;
  // Quiet when the model is already in the browser's cache, and explains itself
  // when it is a first download of several megabytes.
  const slow=setTimeout(()=>toast('Shaping a new character\u2026'),400);
  try{await world.setCharacter(id);}
  catch(err){console.error('Character swap failed',err);toast('That character could not load.');}
  finally{clearTimeout(slow);}
}
// Sliders report while they are being dragged, so a player can hear the level
// they are choosing instead of setting it blind and checking afterwards.
$('dialog-content').addEventListener('input',e=>{
  // A stop-motion tuner: a whole number in its own unit, onto the running world at once.
  const tune=e.target.closest('input[type="range"][data-tune]');
  if(tune){
    const key=tune.dataset.tune,unit=tune.dataset.unit||'',t=saved.stopMotionTuning;
    t[key]=Number(tune.value);saved.stopMotionTuning=normalizeTuning(t);
    const value=saved.stopMotionTuning[key],readout=$('dialog-content').querySelector(`[data-readout="tune-${key}"]`);
    if(readout)readout.textContent=`${value}${unit}`;tune.setAttribute('aria-valuetext',`${value}${unit}`);
    if(world)applyStopMotionTuning(world,saved.stopMotionTuning);persist();return;
  }
  const control=e.target.closest('input[type="range"][data-action]');if(!control)return;
  const value=Math.min(1,Math.max(0,Number(control.value)/100));
  const readout=$('dialog-content').querySelector(`[data-readout="${control.dataset.action}"]`);
  if(readout)readout.textContent=`${Math.round(value*100)}%`;
  control.setAttribute('aria-valuetext',`${Math.round(value*100)} per cent`);
  sound.unlock();
  if(control.dataset.action==='settings-music'){saved.music=value;sound.musicLevel=value;}
  else {saved.effects=value;sound.effectsLevel=value;if(value)sound.effect('coin',{});}
  persist();
});
function result(e){
  lastResult=e;document.body.classList.add('is-complete');
  // The chapter's diorama takes the place of the pre-rendered plate. If it
  // cannot be built — no WebGL, or a chapter whose models never arrived — the
  // plate is still in the markup underneath and simply stays visible.
  // Built on the first chapter anyone finishes rather than at startup: it is a
  // whole scene, a sky and a set of material clones, and nothing needs any of
  // it until this screen is on.
  let diorama=false;
  try{
    if(world?.character?.loaded){
      completionScene??=new CompletionScene(world);
      completionScene.build(game.level.biome);completionScene.show();diorama=true;
    }
  }catch(err){console.warn('The completion diorama could not be built; showing the painted plate instead.',err);completionScene?.hide();}
  document.body.classList.toggle('has-completion-diorama',diorama);
  openDialog(completionMarkup(e,game.level,lastShown()+1),'complete');
}
editor=new LevelEditor({world,game,levels:LEVELS,library:drafts,chapterShown:shown,
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
window.addEventListener('pointerdown',()=>{sound.unlock();menuKeys(false);},{passive:true});
window.addEventListener('keydown',e=>{if(!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey)sound.unlock();});
$('play').addEventListener('click',()=>begin(saved.last));$('chapters').addEventListener('click',chapters);$('howto').addEventListener('click',help);$('pause').addEventListener('click',pause);$('menu-sound').addEventListener('click',toggleSound);
$('settings').addEventListener('click',settings);$('error-home').addEventListener('click',home);
$('dismiss-hint').addEventListener('click',()=>{dismissed.add(hintKey);show('hint',false);});
for(const id of ['fullscreen','hud-fullscreen'])$(id).addEventListener('click',()=>{sound.unlock();fullscreenTransition=performance.now()+1000;fullscreen.toggle();});
$('dialog-content').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;sound.unlock();
  if(b.hasAttribute('data-level')){begin(Number(b.dataset.level),false,b.dataset.source);return;}
  const a=b.dataset.action;
  if(a==='resume'||a==='close')closeDialog();if(a==='play')begin(saved.last);if(a==='restart')begin(game.index,true,undefined,game.level.lab?clayLab:null);if(a==='next')begin(game.index+1);if(a==='chapters')chapters();if(a==='home')home();
  if(a==='playground')begin(3,true,'original',clayLab);
  if(a==='stations')stationPicker();
  if(b.dataset.station){visitStation(game,b.dataset.station);closeDialog();show('touch-controls',true);}
  if(a==='editor')openEditor();if(a==='back-editor')editor.returnToEditor();if(a==='restart-test')editor.playtest(false);
  if(a==='fullscreen'){fullscreenTransition=performance.now()+1000;fullscreen.toggle();}
  if(a==='sound'){toggleSound();b.innerHTML=`${icon(sound.enabled?'volume-2':'volume-x')} Sound ${sound.enabled?'on':'off'}`;icons();}
  if(a==='settings-sound'){toggleSound();b.setAttribute('aria-checked',String(sound.enabled));b.innerHTML=`${icon(sound.enabled?'volume-2':'volume-x')}<span>Sound</span><strong>${sound.enabled?'On':'Off'}</strong>`;icons();}
  if(a==='settings-rumble'){
    saved.rumble=!saved.rumble;haptics.enabled=saved.rumble;persist();
    if(saved.rumble)haptics.pulse({type:'land',impact:12});else haptics.silence();
    b.setAttribute('aria-checked',String(saved.rumble));
    b.innerHTML=`${icon('move-vertical')}<span>Rumble</span><strong>${saved.rumble?'On':'Off'}</strong>`;icons();
  }
  if(a==='settings-stopmotion'){
    // Takes effect on the running world at its next frame; the title's hero
    // and the completion stage read the same flag through the world.
    saved.stopMotion=!saved.stopMotion;saved.stopMotionChosen=true;if(world)world.stopMotion=saved.stopMotion;persist();
    b.setAttribute('aria-checked',String(saved.stopMotion));
    b.innerHTML=`${icon('camera')}<span>Stop motion</span><strong>${saved.stopMotion?'On':'Off'}</strong>`;
    // The look's tuning unfolds under the switch while it is on.
    $('dialog-content').querySelector('[data-tuning="stopmotion"]')?.remove();
    if(saved.stopMotion)b.insertAdjacentHTML('afterend',stopMotionTuningMarkup(saved.stopMotionTuning));
    icons();
  }
  if(a==='settings-stopmotion-creatures'){
    const t=saved.stopMotionTuning;
    t.creatures=!t.creatures;if(world)applyStopMotionTuning(world,t);persist();
    b.setAttribute('aria-checked',String(t.creatures));
    b.innerHTML=`${icon('bug')}<span>Creatures too</span><strong>${t.creatures?'On':'Off'}</strong>`;icons();
  }
  if(a==='settings-character')chooseCharacter(b.dataset.character);
  if(a==='help')help();
});
const leftKeys=['ArrowLeft','KeyA'],rightKeys=['ArrowRight','KeyD'],jumpKeys=['Space','ArrowUp','KeyW'],stompKeys=['ArrowDown','KeyS'];
function syncInput(){
  const left=leftKeys.some(k=>pressed.has(k)),right=rightKeys.some(k=>pressed.has(k));
  input.moveAxis=(left||right)?Number(right)-Number(left):(joystick?.axis||padSteer||0);
  input.left=input.moveAxis<0;input.right=input.moveAxis>0;input.jumpHeld=jumpKeys.some(k=>pressed.has(k))||[...touchPointers.values()].includes('jump')||padHeld;
}
window.addEventListener('keydown',e=>{
  if(editor?.active)return;
  if(e.code==='KeyF'){e.preventDefault();if(!e.repeat){sound.unlock();fullscreenTransition=performance.now()+1000;fullscreen.toggle();}return;}
  const root=menuRoot();
  if(e.code==='Tab'&&root===$('dialog')){
    const f=menuFocusables(root);if(!f.length)return;const i=f.indexOf(document.activeElement);menuKeys(true);
    if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1).focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus();}return;
  }
  if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();if(!e.repeat)backOut();return;}
  // A menu takes the arrows (and W/A/S/D) before the game can see them: while
  // one is up the game is paused or not started, and ↑/↓ are also the jump and
  // stomp keys, so this sits ahead of the gameplay gate below. Held keys repeat.
  const direction=root&&menuDirection(e.code,document.activeElement,{modifier:e.metaKey||e.ctrlKey||e.altKey});
  if(direction){e.preventDefault();moveMenuFocus(root,direction);menuKeys(true);return;}
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
window.addEventListener('resize',clearPointerInput);
window.addEventListener('orientationchange',clearPointerInput);
window.addEventListener('pagehide',()=>{sound.setForeground(false);saveJourney();});
window.addEventListener('pageshow',syncAudioFocus);
window.addEventListener('contextmenu',e=>e.preventDefault());
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();game.pause();clearInput();$('error-text').textContent='The graphics connection was interrupted. Reload to continue — your latest checkpoint is saved.';show('error',true);});
function stationPicker(){
  if(!game.level.playground)return;
  openDialog(`<button class="dialog-close" data-action="resume" aria-label="Resume game">${icon('x')}</button><span class="eyebrow">CLAY LAB</span><h2>Jump to an experiment.</h2><p>Each bench works differently: read its prompt. R softens whatever you are standing beside, and sends you back to its start.</p><div class="chapters-list">${game.level.shaping.map((s,i)=>`<button class="chapter-choice" data-station="${s.id}"><span>${String(i+1).padStart(2,'0')}</span><div><strong>${s.name}</strong><small>${s.verb} · ${Math.round(shapedShare(s)*100)}% shaped</small></div>${icon('arrow-up-right')}</button>`).join('')}</div>`);
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
  if(visible&&hintKey!==key){hintKey=key;hintUntil=now+hintDuration(hint.text);$('hint-mark').innerHTML=hintIcon(hint.icon);$('hint-title').textContent=hint.title;const touch=matchMedia('(pointer:coarse), (max-width:850px)').matches;$('hint-text').textContent=touch?(hint.touchText||hint.text.replace('A / D or arrows to move.','Drag the joystick to move.').replace('↓ / S or STOMP','STOMP')):hint.text;}
}
// A hint card stays up long enough to be read: a short chapter prompt for the
// six and a half seconds it always had, a longer lab prompt for about a
// quarter of a second a word, never past sixteen seconds. It can be dismissed
// sooner, and walking away from its stretch dismisses it too.
const hintDuration=text=>Math.min(16000,Math.max(6500,2500+String(text||'').split(/\s+/).filter(Boolean).length*240));
// A controller drives the same axis-and-edges input the touch stick produces.
// Keyboard keeps priority: a stick resting slightly off centre must never fight
// a held key, so the pad only steers while nothing is pressed.
const padMenu=new MenuRepeat({delay:180,interval:90});
function readGamepad(){
  if(editor?.active){if(padSteer||padHeld){padSteer=0;padHeld=false;syncInput();}return;}
  const pad=pads.poll();
  if(!pad.connected){if(padSteer||padHeld){padSteer=0;padHeld=false;syncInput();}return;}
  const root=menuRoot();
  if(root){
    // A menu is up: the d-pad and stick walk its controls, A presses the one
    // under the cursor, B and Start back out the way Escape does. Down on the
    // d-pad is also a stomp button, which is why nothing here reads stomp.
    if(padSteer||padHeld){padSteer=0;padHeld=false;syncInput();}
    const direction=padMenu.step(pad.direction,performance.now());
    if(direction){sound.unlock();moveMenuFocus(root,direction);menuKeys(true);}
    if(pad.jumpPressed){
      sound.unlock();const active=document.activeElement;
      if(active&&active!==root&&root.contains(active)){menuKeys(true);active.click();}
      else if(root===$('menu'))begin(saved.last);        // the title's old shortcut: A with nothing under the cursor plays
      else {moveMenuFocus(root,'down');menuKeys(true);}  // put the cursor down before pressing anything
    }
    if(pad.pausePressed){sound.unlock();if(root===$('menu'))begin(saved.last);else backOut();}
    else if(pad.backPressed&&root===$('dialog')){sound.unlock();backOut();}
    return;
  }
  padMenu.step(null,0);
  if(pad.pausePressed){sound.unlock();pause();return;}
  if(game.status!=='playing'){if(padSteer||padHeld){padSteer=0;padHeld=false;syncInput();}return;}
  if(pad.jumpPressed||pad.stompPressed||pad.axis)sound.unlock();
  if(pad.jumpPressed)input.jumpPressed=true;
  if(pad.stompPressed)input.stompPressed=true;
  if(padSteer!==pad.axis||padHeld!==pad.jumpHeld){padSteer=pad.axis;padHeld=pad.jumpHeld;syncInput();}
}
let prev=performance.now(),accum=0,hudAccum=0;
function frame(now){
  shapingControls?.update();
  const dt=Math.min((now-prev)/1000,.06);prev=now;
  sound.update(dt,game.status==='playing',game.index,game.level.sections[game.sectionId]?.quiet,menu,!!game.flowerCelebration,motherQuiet(game.level.boss),motherCorrupted(game));
  sound.wind(menu?0:windExposure(game.level,game.player));
  readGamepad();
  if(!assetsReady||document.hidden){accum=0;requestAnimationFrame(frame);return;}
  if(menu){accum=0;titleScene?.render(dt);requestAnimationFrame(frame);return;}
  // A finished chapter stops simulating and the diorama takes the canvas. The
  // level stays built behind it, so Play Again needs no reload.
  if(completionScene?.active){accum=0;completionScene.render(dt);requestAnimationFrame(frame);return;}
  const held=hitStop>0;
  if(held){hitStop=Math.max(0,hitStop-dt);accum=0;}else accum+=dt;
  while(accum>=FIXED_DT){game.tick(FIXED_DT,input);input.jumpPressed=false;input.stompPressed=false;accum-=FIXED_DT;if(hitStop>0){accum=0;break;}}
  // What is left in `accum` is how far this frame falls into the next tick, so
  // the world is drawn that far between the last two poses (camera.js
  // `between`), a tick behind and steady. A frame held by a hit-stop — the one
  // that starts it and the one that ends it, when nothing has ticked — and any
  // frame the simulation is not running show the tick as it stands.
  const alpha=held||hitStop>0||game.status!=='playing'?1:accum/FIXED_DT;
  world.render(game,dt,menu,alpha);if(!editor?.active&&!$('hud').classList.contains('hidden'))healthHUD?.draw(game,dt);editor?.draw();hudAccum+=dt;if(hudAccum>.06){updateHUD(now);hudAccum=0;}
  requestAnimationFrame(frame);
}
updatePlayLabel();icons();$('menu-sound').innerHTML=icon(sound.enabled?'volume-2':'volume-x');$('menu-sound').setAttribute('aria-label',sound.enabled?'Mute sound':'Enable sound');$('menu-sound').setAttribute('aria-pressed',String(sound.enabled));icons();
document.body.dataset.biome='desert';fullscreen.sync();
requestAnimationFrame(frame);
ensureWorld(false);
