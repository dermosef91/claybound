// Exercise the real audio controller; emulate only browser audio devices and time.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Sound,HORIZON_TRACK,CHAPTER_TRACKS,SPORE_BALLOON_BURST} from '../dist/audio.js';
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
sound.effect('jump');assert.equal(sound.ctx.oscillators.length,1);assert.equal(sound.ctx.oscillators[0].output.output,sound.master,'effects remain on their own bus');
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
assert.equal(victoryBytes.subarray(0,4).toString(),'RIFF');
assert.equal(sporeBalloonBytes.subarray(0,4).toString(),'RIFF');
const oldFetch=globalThis.fetch;
globalThis.fetch=async url=>{const bytes=url===SPORE_BALLOON_BURST?sporeBalloonBytes:victoryBytes;return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
Context.prototype.decodeAudioData=async bytes=>({duration:1,bytes});
Context.prototype.createBufferSource=function(){const n=new Node();n.start=()=>{n.started=true;};(this.buffers??=[]).push(n);return n;};
const rewardSound=new Sound();rewardSound.unlock();await rewardSound.flowerLoading;
rewardSound.effect('stamp');assert.equal(rewardSound.ctx.buffers.length,1);assert(rewardSound.ctx.buffers[0].started);
assert.equal(rewardSound.ctx.buffers[0].output.output,rewardSound.master);
rewardSound.update(.016,true,0,false,false,true);await settle();assert.equal(rewardSound.trackGain._target,.08);
rewardSound.update(.016,true,0);await settle();assert.equal(rewardSound.trackGain._target,.26);
rewardSound.enabled=false;rewardSound.effect('stamp');assert.equal(rewardSound.ctx.buffers.length,1);
rewardSound.enabled=true;rewardSound.setForeground(false);rewardSound.effect('stamp');assert.equal(rewardSound.ctx.buffers.length,1);
const sporeSound=new Sound();sporeSound.unlock();await sporeSound.sporeBalloonLoading;
sporeSound.effect('break',{spore:true});assert.equal(sporeSound.ctx.buffers.length,1);assert(sporeSound.ctx.buffers[0].started);
assert.equal(sporeSound.ctx.buffers[0].buffer,sporeSound.sporeBalloonBuffer);assert.equal(sporeSound.ctx.buffers[0].output.output,sporeSound.master);
assert.equal(sporeSound.ctx.buffers[0].output.gain.value,.5,'spore balloon recording plays at 50% gain');
assert.equal(sporeSound.ctx.oscillators.length,0,'the supplied recording replaces the synthesized forest burst');
sporeSound.enabled=false;sporeSound.effect('break',{spore:true});assert.equal(sporeSound.ctx.buffers.length,1,'muted spore balloons stay silent');
globalThis.fetch=oldFetch;
console.log('PASS supplied flower and spore-balloon WAV playback, music duck/restore, mute and hidden-page silence');

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
