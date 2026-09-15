// Exercise the real audio controller; emulate only browser audio devices and time.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {motherCorrupted,motherQuiet} from '../dist/mother-puff-rules.js';
import {STONE_ORCHARD_TRACK} from '../dist/mother-puff-music.js';
import {Sound,HORIZON_TRACK,CHAPTER_TRACKS,FLOWER_VICTORY,SPORE_BALLOON_BURST,MOTHER_PUFF_GROWL,COIN_PICKUP,CHECKPOINT_FLAG,FINISH_BELL,POROUS_CLAY_STEP,ENEMY_HEAD_IMPACT} from '../dist/audio.js';
const jobs=new Map();let next=0;
globalThis.setTimeout=(fn,ms)=>{jobs.set(++next,{fn,ms});return next;};
globalThis.clearTimeout=id=>jobs.delete(id);
const advance=ms=>{for(const [id,job]of [...jobs])if(job.ms<=ms){jobs.delete(id);job.fn();}};
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
class Param{
  value=1;events=[];
  cancelScheduledValues(){}
  setValueAtTime(value,time){this.value=value;this.events.push({value,time});}
  linearRampToValueAtTime(value,time){this.value=value;this.events.push({value,time});}
  exponentialRampToValueAtTime(value,time){this.value=value;this.events.push({value,time});}
}
class Node{gain=new Param();connect(node){this.output=node;}}
class Context{
  currentTime=0;destination={};oscillators=[];sources=[];
  resume(){return Promise.resolve();}
  createGain(){return new Node();}
  createMediaElementSource(element){assert(!this.sources.some(s=>s.element===element));const node=new Node();node.element=element;this.sources.push(node);return node;}
  createOscillator(){const node=new Node();node.frequency=new Param();node.start=()=>{};node.stop=()=>{};this.oscillators.push(node);return node;}
}
class Media extends EventTarget{
  paused=true;currentTime=0;plays=0;attributes={};
  setAttribute(k,v){this.attributes[k]=v;}
  play(){this.plays++;if(this.failure)return Promise.reject(Object.assign(new Error(),{name:this.failure}));this.paused=false;return this.pending||Promise.resolve();}
  pause(){this.paused=true;}
  load(){this.currentTime=0;this.error=null;}
}
const elements=[];let nextMedia;
globalThis.window={AudioContext:Context};
globalThis.document={createElement:tag=>{assert.equal(tag,'audio');return nextMedia||new Media();},body:{append:el=>elements.push(el)}};
for(const url of CHAPTER_TRACKS){const music=await readFile(new URL(url));assert(music.length>3e6);assert.equal(music.subarray(0,3).toString(),'ID3');}
assert.deepEqual(CHAPTER_TRACKS.map(url=>url.split('/').pop()),['steps-along-the-ridge.mp3','morning-at-the-breathing-tree.mp3','where-crystals-sing.mp3','above-the-clay-horizon.mp3']);

const sound=new Sound();sound.update(.016,false,0,false,true);
assert.equal(sound.ctx,null);assert.equal(elements.length,0,'no music request or autoplay before a gesture');
sound.unlock();await settle();const track=sound.track;
assert.equal(track.src,HORIZON_TRACK);assert(track.loop&&track.hidden);assert.equal(track.preload,'none');assert.equal(track.plays,1);
for(let i=0;i<120;i++)sound.update(.016,false,0,false,true);
assert.equal(track.plays,1,'one streaming element and one play request');assert.equal(sound.ctx.sources.length,1);
assert.equal(sound.trackGain._target,.3);

track.currentTime=42;sound.update(.016,true,3,false,false);await settle();
assert.equal(track.currentTime,42);assert.equal(track.plays,1,'title to Hanging Quarter remains continuous');
assert.equal(sound.trackGain._target,.26);assert.equal(sound.ctx.oscillators.length,0,'the old chapter motif is silent under the supplied music');
sound.effect('jump');assert.equal(sound.ctx.oscillators.length,1);
assert.equal(sound.ctx.oscillators[0].output.output,sound.effectsBus,'effects remain on their own bus');
assert.equal(sound.effectsBus.output,sound.master);assert.equal(sound.musicBus.output,sound.master);
assert.equal(sound.trackGain.output,sound.musicBus,'the streamed soundtrack rides the music bus');
assert.equal(sound.motifGain.output,sound.musicBus,'the synthesized motif is music, not an effect');
// Either bus can be silenced without touching the other, and the levels
// survive a chapter change and a mute/unmute round trip.
sound.musicLevel=0;
assert.equal(sound.musicBus.gain.value,0);assert.equal(sound.effectsBus.gain.value,1,'silencing music leaves effects audible');
sound.effect('jump');assert.equal(sound.ctx.oscillators.at(-1).output.output,sound.effectsBus);
sound.effectsLevel=.4;sound.musicLevel=.8;
assert.equal(sound.effectsBus.gain.value,.4);assert.equal(sound.musicBus.gain.value,.8);
sound.enabled=false;sound.enabled=true;await settle();
assert.equal(sound.musicBus.gain.value,.8,'mute does not reset the chosen levels');
assert.equal(sound.effectsBus.gain.value,.4);
sound.musicLevel=2;assert.equal(sound.musicLevel,1,'levels clamp');
sound.effectsLevel=-1;assert.equal(sound.effectsLevel,0);
sound.effectsLevel=1;sound.musicLevel=Sound.DEFAULT_MUSIC;
sound.update(.016,true,3,true);assert.equal(sound.trackGain._target,.19,'quiet areas reduce the soundtrack');
sound.update(.016,false,3);assert.equal(sound.trackGain._target,0);advance(310);assert(track.paused);assert.equal(track.currentTime,42);
sound.update(.016,true,3);await settle();assert(!track.paused);assert.equal(track.currentTime,42);
sound.update(.016,false,3,false,true);assert(!track.paused);assert.equal(track.currentTime,42);

for(const chapter of [1,0,2,1,3]){
  track.currentTime=57;const before=sound.ctx.oscillators.length;
  sound.update(.016,true,chapter);await settle();
  assert.equal(track.src,CHAPTER_TRACKS[chapter]);assert.equal(track.currentTime,0,'a new chapter starts its own song');
  assert(!track.paused&&track.loop);assert.equal(sound.trackGain._target,.26);
  sound.update(.6,true,chapter);assert.equal(sound.ctx.oscillators.length,before,'supplied music replaces the old motif in each chapter');
  track.currentTime=18;sound.update(.016,false,chapter);advance(310);assert(track.paused);
  sound.update(.016,true,chapter);await settle();assert.equal(track.currentTime,18,'resuming preserves this chapter’s position');
}
assert.equal(sound.ctx.sources.length,1);assert.equal(elements.length,1,'chapter changes reuse one streaming player');
sound.update(.016,false,1,false,true);await settle();assert(!track.paused);
sound.enabled=false;assert(track.paused);assert.equal(sound.master.gain.value,0);const attempts=track.plays;
for(let i=0;i<60;i++)sound.update(.016,false,1,false,true);
sound.unlock();await settle();assert.equal(track.plays,attempts,'muted preferences survive interactions');
sound.enabled=true;await settle();assert(!track.paused);assert.equal(sound.master.gain.value,1);
sound.setForeground(false);assert(track.paused);assert.equal(sound.master.gain.value,0);
sound.update(.6,false,1,false,true);assert(track.paused);
sound.setForeground(true);await settle();assert(!track.paused);
sound.update(.016,false,3);advance(310);sound.setForeground(false);sound.setForeground(true);assert(track.paused,'focusing a paused chapter stays quiet');

nextMedia=new Media();nextMedia.failure='NotAllowedError';const blocked=new Sound();blocked.unlock();await settle();
for(let i=0;i<60;i++)blocked.update(.016,false,0,false,true);
assert.equal(nextMedia.plays,1,'autoplay rejection does not trigger a frame-by-frame retry loop');
nextMedia.failure=null;blocked.unlock();await settle();assert.equal(nextMedia.plays,2);assert(!nextMedia.paused);
blocked.update(.016,true,3);nextMedia.error={code:3};nextMedia.dispatchEvent(new Event('error'));assert(nextMedia.paused);
blocked.update(.6,true,3);assert(blocked.ctx.oscillators.length>0,'a failed MP3 leaves a quiet synthesized chapter fallback');
blocked.update(.016,true,2);await settle();assert.equal(nextMedia.src,CHAPTER_TRACKS[2]);assert(!nextMedia.paused,'one failed track does not silence another chapter');assert(!blocked.trackFailed);

let finish;nextMedia=new Media();nextMedia.pending=new Promise(resolve=>finish=resolve);
const pending=new Sound();pending.unlock();pending.enabled=false;finish();await settle();assert(nextMedia.paused);assert.equal(pending.master.gain.value,0,'late play promises cannot undo mute');
let rejectOld;nextMedia=new Media();nextMedia.pending=new Promise((resolve,reject)=>rejectOld=reject);
const switching=new Sound();switching.unlock();nextMedia.pending=null;
switching.update(.016,true,0);await settle();assert.equal(nextMedia.src,CHAPTER_TRACKS[0]);
rejectOld(Object.assign(new Error(),{name:'NotSupportedError'}));await settle();
assert(!switching.trackFailed&&!nextMedia.paused,'an abandoned title request cannot fail the newer chapter song');
assert.equal(switching.trackGain._target,.26);
nextMedia=null;const savedMute=new Sound();savedMute.enabled=false;savedMute.unlock();assert.equal(savedMute.track,null);
console.log('PASS four supplied chapter songs, continuous title/Hanging Quarter playback, single streaming player, no duplicate motif, independent effects, pause/resume, mute, hidden-page silence, autoplay retry, per-track failure recovery and stale-request isolation');

const pop=new Sound();pop.unlock();await settle();const initial=pop.ctx.oscillators.length;
pop.effect('break',{spore:true});assert.equal(pop.ctx.oscillators.length,initial+2,'spore burst layers a low pop with a rising bloom');
advance(150);assert.equal(pop.ctx.oscillators.length,initial+4,'two quiet sparkle notes follow the burst');
pop.enabled=false;pop.effect('break',{spore:true});advance(150);assert.equal(pop.ctx.oscillators.length,initial+4,'muted bursts stay silent');
console.log('PASS synthesized spore explosion fallback and mute');

const victoryBytes=await readFile(new URL('../dist/assets/flower-victory.wav',import.meta.url));
const sporeBalloonBytes=await readFile(new URL('../dist/assets/spore-balloon-burst.wav',import.meta.url));
const growlBytes=await readFile(new URL(MOTHER_PUFF_GROWL));assert.equal(growlBytes.subarray(0,4).toString(),'RIFF');
const coinBytes=await readFile(new URL('../dist/assets/coin-pickup.wav',import.meta.url));
const checkpointBytes=await readFile(new URL('../dist/assets/checkpoint-flag.wav',import.meta.url));
const completeBytes=await readFile(new URL('../dist/assets/finish-bell.wav',import.meta.url));
const porousStepBytes=await readFile(new URL('../dist/assets/porous-clay-step.wav',import.meta.url));
const enemyHeadImpactBytes=await readFile(new URL(ENEMY_HEAD_IMPACT));
assert.equal(victoryBytes.subarray(0,4).toString(),'RIFF');
assert.equal(sporeBalloonBytes.subarray(0,4).toString(),'RIFF');
for(const bytes of [coinBytes,checkpointBytes,completeBytes,porousStepBytes,enemyHeadImpactBytes])assert.equal(bytes.subarray(0,4).toString(),'RIFF');
const oldFetch=globalThis.fetch;
const suppliedEffects=new Map([[FLOWER_VICTORY,victoryBytes],[SPORE_BALLOON_BURST,sporeBalloonBytes],[MOTHER_PUFF_GROWL,growlBytes],[COIN_PICKUP,coinBytes],[CHECKPOINT_FLAG,checkpointBytes],[FINISH_BELL,completeBytes],[POROUS_CLAY_STEP,porousStepBytes],[ENEMY_HEAD_IMPACT,enemyHeadImpactBytes]]);
globalThis.fetch=async url=>{const bytes=suppliedEffects.get(url);return {ok:!!bytes,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
Context.prototype.decodeAudioData=async bytes=>({duration:1,bytes});
Context.prototype.createBufferSource=function(){const n=new Node();n.playbackRate=new Param();n.start=(...args)=>{n.started=true;n.startArgs=args;};(this.buffers??=[]).push(n);return n;};
const rewardSound=new Sound();rewardSound.unlock();await rewardSound.flowerLoading;
rewardSound.effect('stamp');assert.equal(rewardSound.ctx.buffers.length,1);assert(rewardSound.ctx.buffers[0].started);
assert.equal(rewardSound.ctx.buffers[0].output.output,rewardSound.effectsBus);
assert.equal(rewardSound.ctx.buffers[0].output.gain.value,.5,'flower victory recording plays at 50% gain');
rewardSound.update(.016,true,0,false,false,true);await settle();assert.equal(rewardSound.trackGain._target,.08);
rewardSound.update(.016,true,0);await settle();assert.equal(rewardSound.trackGain._target,.26);
rewardSound.enabled=false;rewardSound.effect('stamp');assert.equal(rewardSound.ctx.buffers.length,1);
rewardSound.enabled=true;rewardSound.setForeground(false);rewardSound.effect('stamp');assert.equal(rewardSound.ctx.buffers.length,1);
const sporeSound=new Sound();sporeSound.unlock();await sporeSound.sporeBalloonLoading;
sporeSound.effect('break',{spore:true});assert.equal(sporeSound.ctx.buffers.length,1);assert(sporeSound.ctx.buffers[0].started);
assert.equal(sporeSound.ctx.buffers[0].buffer,sporeSound.sporeBalloonBuffer);assert.equal(sporeSound.ctx.buffers[0].output.output,sporeSound.effectsBus);
assert.equal(sporeSound.ctx.buffers[0].output.gain.value,.5,'spore balloon recording plays at 50% gain');
assert.equal(sporeSound.ctx.oscillators.length,0,'the supplied recording replaces the synthesized forest burst');
sporeSound.effect('squish',{kind:'spore'});const enemyPuff=sporeSound.ctx.buffers[1];
assert.equal(enemyPuff.buffer,sporeSound.sporeBalloonBuffer);assert.equal(enemyPuff.output.gain.value,.22,'Spore Puff defeat is quieter than the balloon burst');
assert.deepEqual(enemyPuff.startArgs,[0,0,.45],'Spore Puff defeat uses only the short opening of the recording');
sporeSound.effect('squish',{kind:'drifter'});assert.equal(sporeSound.ctx.buffers.length,2,'other level enemies keep their own defeat sound');
sporeSound.enabled=false;sporeSound.effect('break',{spore:true});assert.equal(sporeSound.ctx.buffers.length,2,'muted spore sounds stay silent');
const headImpactSound=new Sound();headImpactSound.unlock();await headImpactSound.enemyHeadImpactLoading;
for(const kind of ['bat','spitter','clayling']){
  const sourceCount=headImpactSound.ctx.buffers?.length||0,oscillatorCount=headImpactSound.ctx.oscillators.length;
  headImpactSound.effect('squish',{kind});const impact=headImpactSound.ctx.buffers[sourceCount];
  assert.equal(impact.buffer,headImpactSound.enemyHeadImpactBuffer);assert.equal(impact.output.gain.value,.36);assert(impact.started);
  assert.equal(headImpactSound.ctx.oscillators.length,oscillatorCount,`${kind} head landing uses the supplied impact instead of the synthesized cue`);
}
headImpactSound.effect('squish',{kind:'drifter'});assert.equal(headImpactSound.ctx.buffers.length,3,'other enemy defeats keep their existing cue');
console.log('PASS supplied bat, spitter and clayling head-impact cue');
const bossSound=new Sound();bossSound.unlock();await Promise.all([bossSound.motherGrowlLoading,bossSound.sporeBalloonLoading]);
bossSound.effect('mother-open');const growl=bossSound.ctx.buffers[0];assert.equal(growl.buffer,bossSound.motherGrowlBuffer);assert.equal(growl.output.gain.value,.2,'opening growl plays at a restrained 20% gain');
for(const event of ['mother-hit','mother-hit','mother-collapse']){bossSound.effect(event);const hit=bossSound.ctx.buffers.at(-1);assert.equal(hit.buffer,bossSound.sporeBalloonBuffer);assert.equal(hit.output.gain.value,.4);assert(hit.started);}
assert.equal(bossSound.ctx.buffers.length,4);assert.equal(bossSound.ctx.oscillators.length,0,'opening and all three head hits use supplied recordings');
bossSound.enabled=false;bossSound.effect('mother-open');bossSound.effect('mother-hit');assert.equal(bossSound.ctx.buffers.length,4);bossSound.enabled=true;bossSound.setForeground(false);bossSound.effect('mother-open');bossSound.effect('mother-collapse');assert.equal(bossSound.ctx.buffers.length,4,'boss cues respect mute and background silence');
console.log('PASS Mother Puff quiet supplied growl, three balloon-pop hit cues, mute and background silence');
const interactionSound=new Sound();interactionSound.unlock();await Promise.all([interactionSound.coinLoading,interactionSound.checkpointLoading,interactionSound.completeLoading]);
const originalRandom=Math.random;Math.random=()=>.25;
for(const [type,buffer,gain]of [['coin',interactionSound.coinBuffer,.0135],['checkpoint',interactionSound.checkpointBuffer,.25],['complete',interactionSound.completeBuffer,.5]]){
  const oscillatorCount=interactionSound.ctx.oscillators.length,sourceCount=interactionSound.ctx.buffers?.length||0;
  interactionSound.effect(type);const source=interactionSound.ctx.buffers[sourceCount];
  assert(source?.started,`${type} starts its supplied recording`);assert.equal(source.buffer,buffer);assert.equal(source.output.output,interactionSound.effectsBus);
  assert.equal(source.output.gain.value,gain,`${type} uses its tuned playback volume`);
  assert.equal(interactionSound.ctx.oscillators.length,oscillatorCount,`${type} recording replaces its synthesized cue`);
}
const firstCoin=interactionSound.ctx.buffers.at(-3);assert.equal(firstCoin.playbackRate.value,.62,'coin pitch is lowered and varied');
Math.random=()=>.75;interactionSound.effect('coin');const variedCoin=interactionSound.ctx.buffers.at(-1);
assert.equal(variedCoin.output.gain.value,.0165);assert.equal(variedCoin.playbackRate.value,.7);assert.notEqual(variedCoin.output.gain.value,firstCoin.output.gain.value,'successive coin pickups vary volume');assert.notEqual(variedCoin.playbackRate.value,firstCoin.playbackRate.value,'successive coin pickups vary pitch');
await interactionSound.porousStepLoading;const stepSources=interactionSound.ctx.buffers.length,stepOscillators=interactionSound.ctx.oscillators.length;
interactionSound.effect('step',{surface:'crumble'});const porousStep=interactionSound.ctx.buffers[stepSources];
assert.equal(porousStep.buffer,interactionSound.porousStepBuffer);assert.equal(porousStep.output.gain.value,.06,'porous step stays quiet');assert(Math.abs(porousStep.playbackRate.value-.955)<1e-9,'porous step pitch is varied and slightly lowered');
assert.deepEqual(porousStep.startArgs,[0,.12,.38],'porous step uses the compact first impact instead of overlapping its two-second tail');assert.equal(interactionSound.ctx.oscillators.length,stepOscillators,'porous clay replaces the generic synthesized step');
interactionSound.effect('step',{surface:'stone'});assert.equal(interactionSound.ctx.buffers.length,stepSources+1,'ordinary surfaces do not use the porous-clay recording');assert.equal(interactionSound.ctx.oscillators.length,stepOscillators+1,'ordinary surfaces retain the generic footstep');
Math.random=originalRandom;
interactionSound.enabled=false;const mutedCount=interactionSound.ctx.buffers.length;interactionSound.effect('coin');interactionSound.effect('checkpoint');interactionSound.effect('complete');assert.equal(interactionSound.ctx.buffers.length,mutedCount,'supplied interaction sounds respect mute');
globalThis.fetch=oldFetch;
console.log('PASS supplied flower, spore-balloon, coin, checkpoint and finish-bell WAV playback, music duck/restore, mute and hidden-page silence');

const motherSound=new Sound();motherSound.unlock();await settle();
motherSound.update(.016,true,1);await settle();motherSound.track.currentTime=35;
motherSound.update(.016,true,1,false,false,false,true);
assert.equal(motherSound.trackGain._target,.008,'collapse and stillness hush the soundtrack');
assert.equal(motherSound.track.currentTime,35,'hushing does not restart the forest music');
motherSound.update(.016,true,1);await settle();assert.equal(motherSound.trackGain._target,.26);
assert.equal(motherSound.track.currentTime,35);
const beforePuff=motherSound.ctx.oscillators.length;motherSound.effect('mother-friendly');assert.equal(motherSound.ctx.oscillators.length,beforePuff+1);
motherSound.enabled=false;motherSound.effect('mother-friendly');assert.equal(motherSound.ctx.oscillators.length,beforePuff+1,'friendly puffs respect mute');
console.log('PASS Mother Puff quiet recovery, uninterrupted music restoration and friendly puff mute');

const orchardBytes=await readFile(new URL(STONE_ORCHARD_TRACK));assert(orchardBytes.length>3e6);
nextMedia=null;const crossing=new Sound();crossing.update(.016,true,1);crossing.unlock();await settle();
crossing.track.currentTime=73;crossing.update(.016,true,1,false,false,false,false,true);await settle();
assert.equal(crossing.orchard.track.src,STONE_ORCHARD_TRACK);assert.equal(crossing.orchard.gain._target,.26);assert.equal(crossing.trackGain._target,0);assert.equal(crossing.track.currentTime,73);
assert.equal(crossing.orchard.gain.gain.events.at(-1).time,2.4,'both music streams crossfade over 2.4 seconds');
const orchard=crossing.orchard.track;orchard.currentTime=14;const plays=orchard.plays;
for(let i=0;i<100;i++)crossing.update(.016,true,1,false,false,false,false,true);
assert.equal(orchard.plays,plays,'continuous combat does not restart the theme');
crossing.update(.016,false,1,false,false,false,false,true);assert(orchard.paused);
crossing.update(.016,true,1,false,false,false,false,true);await settle();assert.equal(orchard.currentTime,14);
const encounter={level:{boss:{state:'veil',hits:3,triggerX:276}},player:{x:295}};
for(const state of ['veil','transform','reveal-form','regard','farewell','bloom']){
 encounter.level.boss.state=state;crossing.update(.016,true,1,false,false,false,motherQuiet(encounter.level.boss),motherCorrupted(encounter));await settle();advance(2500);
 assert.equal(crossing.trackGain._target,0,'forest music stays silent throughout '+state);assert(!orchard.paused);assert.equal(crossing.orchard.gain._target,motherQuiet(encounter.level.boss)?.008:.26);
}
encounter.level.boss.state='defeated';crossing.update(.016,true,1,false,false,false,motherQuiet(encounter.level.boss),motherCorrupted(encounter));assert.equal(crossing.orchard.gain._target,0);assert.equal(crossing.trackGain._target,.26);advance(2500);assert(orchard.paused);assert.equal(crossing.track.currentTime,73,'completed healing returns to the continuing forest theme');
crossing.update(.016,true,1,false,false,false,false,true);await settle();crossing.enabled=false;assert(orchard.paused);crossing.enabled=true;await settle();assert(!orchard.paused);crossing.setForeground(false);assert(orchard.paused);
crossing.setForeground(true);await settle();orchard.error={code:3};orchard.dispatchEvent(new Event('error'));assert.equal(crossing.trackGain._target,.26,'a failed orchard stream restores forest music');
console.log('PASS Stone Orchard crossfade, longer playback, victory return, preserved positions, pause/mute/focus and failed-stream fallback');
