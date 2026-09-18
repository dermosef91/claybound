import {OrchardMusic} from './mother-puff-music.js';
// Quiet, distinct motifs leave footsteps and timing cues in the foreground.
const THEMES=[
  {root:220,beat:.45,type:'sine',scale:[0,2,4,7,9,12],patterns:[[0,-1,2,-1,3,2,-1,1],[0,2,4,-1,3,-1,1,-1],[2,-1,3,4,2,-1,0,-1],[3,2,-1,1,0,-1,-1,-1]]},
  {root:293.66,beat:.34,type:'triangle',scale:[0,2,4,7,9,12],patterns:[[0,2,-1,3,4,-1,2,-1],[2,3,4,-1,5,4,-1,2],[0,-1,1,2,3,-1,2,1],[4,3,-1,2,0,-1,-1,-1]]},
  {root:146.83,beat:.62,type:'sine',scale:[0,2,3,7,10,12],patterns:[[0,-1,-1,3,-1,-1,2,-1],[0,-1,4,-1,-1,3,-1,-1],[2,-1,-1,1,-1,3,-1,-1],[0,-1,-1,-1,3,-1,-1,-1]]},
  {root:261.63,beat:.43,type:'sine',scale:[0,2,4,7,9,12],patterns:[[0,-1,2,3,4,-1,3,-1],[2,3,5,-1,4,-1,2,-1],[3,-1,4,5,3,2,-1,1],[0,2,3,-1,2,-1,0,-1]]},
  // The Soft Dream has no recording yet: a slow, low pad on a minor scale with
  // long rests, so the chapter has its own placeholder rather than the canyon's.
  {root:174.61,beat:.9,type:'sine',scale:[0,3,5,7,10,12],patterns:[[0,-1,-1,2,-1,-1,-1,-1],[3,-1,-1,-1,1,-1,-1,-1],[-1,-1,2,-1,-1,4,-1,-1],[0,-1,-1,-1,-1,-1,-1,-1]]}
];
export const HORIZON_TRACK=new URL('./assets/above-the-clay-horizon.mp3',import.meta.url).href;
export const CHAPTER_TRACKS=[
  new URL('./assets/steps-along-the-ridge.mp3',import.meta.url).href,
  new URL('./assets/morning-at-the-breathing-tree.mp3',import.meta.url).href,
  new URL('./assets/where-crystals-sing.mp3',import.meta.url).href,
  HORIZON_TRACK
];
export const FLOWER_VICTORY=new URL('./assets/flower-victory.wav',import.meta.url).href;
export const SPORE_BALLOON_BURST=new URL('./assets/spore-balloon-burst.wav',import.meta.url).href;
export const MOTHER_PUFF_GROWL=new URL('./assets/mother-puff-growl.wav',import.meta.url).href;
export const COIN_PICKUP=new URL('./assets/coin-pickup.wav',import.meta.url).href;
export const CHECKPOINT_FLAG=new URL('./assets/checkpoint-flag.wav',import.meta.url).href;
export const FINISH_BELL=new URL('./assets/finish-bell.wav',import.meta.url).href;
export const POROUS_CLAY_STEP=new URL('./assets/porous-clay-step.wav',import.meta.url).href;
export const ENEMY_HEAD_IMPACT=new URL('./assets/enemy-head-impact.wav',import.meta.url).href;
export const LEDGE_COLLAPSE=new URL('./assets/ledge-collapse.wav',import.meta.url).href;
export const CANYON_WIND=new URL('./assets/canyon-wind.wav',import.meta.url).href;
// Three takes of violet clay being kneaded. Every piece of violet clay in the
// game is heard being worked with one of them, whatever works it.
export const CLAY_KNEAD=[
  new URL('./assets/clay-knead-1.wav',import.meta.url).href,
  new URL('./assets/clay-knead-2.wav',import.meta.url).href,
  new URL('./assets/clay-knead-3.wav',import.meta.url).href
];
// One boot leaving the ground and arriving back on it: the same supplied thud
// serves both, pitched apart so a hop is not one sound played twice.
export const JUMP=new URL('./assets/jump.wav',import.meta.url).href;
// Three takes of a boot on clay ground, and three of a boot on a plank deck,
// cut out of two supplied runs by scripts/prepare-boot-cues.py.
export const CLAY_STEP=[
  new URL('./assets/clay-step-1.wav',import.meta.url).href,
  new URL('./assets/clay-step-2.wav',import.meta.url).href,
  new URL('./assets/clay-step-3.wav',import.meta.url).href
];
export const WOOD_STEP=[
  new URL('./assets/wood-step-1.wav',import.meta.url).href,
  new URL('./assets/wood-step-2.wav',import.meta.url).href,
  new URL('./assets/wood-step-3.wav',import.meta.url).href
];
// The decks a player walks on that are built out of timber: the rope bridge's
// plank deck, and the beam the rope lift and the citadel's counterweight lift
// both hang under (dist/moving-platform.js). The switched bridge is named for
// what it does rather than what it is made of — its deck is the biome's own
// clay slab — so it steps like the ground, which is what it looks like.
export const TIMBER=new Set(['bridge','lift','counter']);
// World units over which a wind well fades up, so the canyon is heard breathing
// before the player steps into the column rather than switching on at its edge.
const WIND_REACH=9;
// Two voices of the same short recording at unrelated rates and offsets. Their
// gusts drift in and out of step, so a two-second loop stops sounding like one;
// uncorrelated, they sum to about the bed gain at these weights.
const WIND_VOICES=[[1,0,.72],[1.29,.5,.72]];
// The bed itself never repeats identically, but a fixed loop still breathes at
// a fixed rate. This ebbs its level between quiet and full over an irregular
// few seconds at a time, so a gust settling in reads as weather, not a switch.
const WIND_SWELL=[.4,1];
const WIND_SWELL_SECONDS=[2.5,6.5];
// How loudly the canyon wind is heard, from nowhere near a well to standing in
// one. `wind.active` is maintained by the simulation, so a windwell waiting on
// its switch is as silent as it is still.
export function windExposure(level,player){
  if(!level||level.biome!=='desert'||!player)return 0;
  let loudest=0;
  for(const wind of level.winds||[]){
    if(wind.active===false)continue;
    const dx=Math.max(wind.x-player.x,0,player.x-(wind.x+wind.w)),dy=Math.max(wind.y-player.y,0,player.y-(wind.y+wind.h));
    loudest=Math.max(loudest,1-Math.min(1,Math.hypot(dx,dy)/WIND_REACH));
  }
  return loudest;
}
export class Sound {
  // Music and effects sit on their own buses so either can be silenced without
  // the other. Music defaults below effects: it is background, they are not.
  static DEFAULT_MUSIC=.55;
  static DEFAULT_EFFECTS=1;
  // Full exposure to a wind well, at the swell's loudest moment. A bed, not a
  // cue: it sits under the chapter soundtrack rather than beside the footsteps.
  static WIND_BED=.07;
  constructor(){
    this.ctx=null;this._enabled=true;this.foreground=true;this.title=true;this.playing=false;this.chapter=0;this.quiet=false;
    this._musicLevel=Sound.DEFAULT_MUSIC;this._effectsLevel=Sound.DEFAULT_EFFECTS;
    this.lastCoin=0;this.coinRun=0;this.musicTimer=0;this.note=0;this.theme=-1;
    this.windTarget=0;this.windVoices=[];this.windGain=null;this.windSwellGain=null;this.windTimer=null;this.windSwellTimer=null;
    this.track=null;this.trackGain=null;this.playPending=false;this.trackBlocked=false;this.failedTracks=new Set();this.trackURL=null;this.trackGeneration=0;this.pauseTimer=null;
  }
  get musicLevel(){return this._musicLevel;}
  set musicLevel(value){this._musicLevel=Math.min(1,Math.max(0,Number(value)||0));this.setBuses();this.syncTrack();}
  get effectsLevel(){return this._effectsLevel;}
  set effectsLevel(value){this._effectsLevel=Math.min(1,Math.max(0,Number(value)||0));this.setBuses();}
  setBuses(){
    if(!this.ctx)return;
    for(const [bus,level] of [[this.musicBus,this._musicLevel],[this.effectsBus,this._effectsLevel]]){
      bus.gain.cancelScheduledValues(this.ctx.currentTime);bus.gain.setValueAtTime(level,this.ctx.currentTime);
    }
  }
  get enabled(){return this._enabled;}
  set enabled(value){this._enabled=!!value;this.setMaster();if(!this._enabled)this.stopTrack();else this.syncTrack();this.syncWind();}
  setForeground(value){this.foreground=!!value;this.setMaster();if(!this.foreground)this.stopTrack();else this.syncTrack();this.syncWind();}
  setMaster(){if(this.master){this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setValueAtTime(this.enabled&&this.foreground?1:0,this.ctx.currentTime);}}
  unlock(){
    if(!this.ctx){
      const A=window.AudioContext||window.webkitAudioContext;if(!A)return;
      this.ctx=new A();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);
      this.musicBus=this.ctx.createGain();this.musicBus.connect(this.master);
      this.effectsBus=this.ctx.createGain();this.effectsBus.connect(this.master);
      this.motifGain=this.ctx.createGain();this.motifGain.connect(this.musicBus);
      this.setBuses();this.setMaster();
    }
    this.ctx.resume().catch(()=>{});this.trackBlocked=false;if(this.orchard)this.orchard.blocked=false;this.syncTrack();
    if(!this.flowerLoading&&this.ctx.decodeAudioData){
      this.flowerLoading=fetch(FLOWER_VICTORY).then(r=>{if(!r.ok)throw new Error('Flower sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.flowerBuffer=buffer;}).catch(()=>{});
    }
    if(!this.sporeBalloonLoading&&this.ctx.decodeAudioData){
      this.sporeBalloonLoading=fetch(SPORE_BALLOON_BURST).then(r=>{if(!r.ok)throw new Error('Spore balloon sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.sporeBalloonBuffer=buffer;}).catch(()=>{});
    }
    if(!this.motherGrowlLoading&&this.ctx.decodeAudioData){
      this.motherGrowlLoading=fetch(MOTHER_PUFF_GROWL).then(r=>{if(!r.ok)throw new Error('Mother Puff growl unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.motherGrowlBuffer=buffer;}).catch(()=>{});
    }
    if(!this.coinLoading&&this.ctx.decodeAudioData){
      this.coinLoading=fetch(COIN_PICKUP).then(r=>{if(!r.ok)throw new Error('Coin sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.coinBuffer=buffer;}).catch(()=>{});
    }
    if(!this.checkpointLoading&&this.ctx.decodeAudioData){
      this.checkpointLoading=fetch(CHECKPOINT_FLAG).then(r=>{if(!r.ok)throw new Error('Checkpoint sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.checkpointBuffer=buffer;}).catch(()=>{});
    }
    if(!this.completeLoading&&this.ctx.decodeAudioData){
      this.completeLoading=fetch(FINISH_BELL).then(r=>{if(!r.ok)throw new Error('Finish bell sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.completeBuffer=buffer;}).catch(()=>{});
    }
    if(!this.porousStepLoading&&this.ctx.decodeAudioData){
      this.porousStepLoading=fetch(POROUS_CLAY_STEP).then(r=>{if(!r.ok)throw new Error('Porous clay step sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.porousStepBuffer=buffer;}).catch(()=>{});
    }
    if(!this.enemyHeadImpactLoading&&this.ctx.decodeAudioData){
      this.enemyHeadImpactLoading=fetch(ENEMY_HEAD_IMPACT).then(r=>{if(!r.ok)throw new Error('Enemy head impact sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.enemyHeadImpactBuffer=buffer;}).catch(()=>{});
    }
    if(!this.ledgeCollapseLoading&&this.ctx.decodeAudioData){
      this.ledgeCollapseLoading=fetch(LEDGE_COLLAPSE).then(r=>{if(!r.ok)throw new Error('Ledge collapse sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.ledgeCollapseBuffer=buffer;}).catch(()=>{});
    }
    if(!this.kneadLoading&&this.ctx.decodeAudioData){
      this.kneadBuffers=[];
      this.kneadLoading=Promise.all(CLAY_KNEAD.map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error('Kneading sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.kneadBuffers.push(buffer);}).catch(()=>{})));
    }
    if(!this.jumpLoading&&this.ctx.decodeAudioData){
      this.jumpLoading=fetch(JUMP).then(r=>{if(!r.ok)throw new Error('Jump sound unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.jumpBuffer=buffer;}).catch(()=>{});
    }
    if(!this.clayStepLoading&&this.ctx.decodeAudioData){
      this.clayStepBuffers=[];
      this.clayStepLoading=Promise.all(CLAY_STEP.map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error('Clay footstep unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.clayStepBuffers.push(buffer);}).catch(()=>{})));
    }
    if(!this.woodStepLoading&&this.ctx.decodeAudioData){
      this.woodStepBuffers=[];
      this.woodStepLoading=Promise.all(WOOD_STEP.map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error('Timber footstep unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.woodStepBuffers.push(buffer);}).catch(()=>{})));
    }
    if(!this.canyonWindLoading&&this.ctx.decodeAudioData){
      // The bed can arrive with the player already inside a well, so the loop
      // starts itself rather than waiting for the next change in exposure.
      this.canyonWindLoading=fetch(CANYON_WIND).then(r=>{if(!r.ok)throw new Error('Canyon wind unavailable');return r.arrayBuffer();}).then(bytes=>this.ctx.decodeAudioData(bytes)).then(buffer=>{this.canyonWindBuffer=buffer;this.syncWind();}).catch(()=>{});
    }
  }
  musicVolume(){return this.title?.3:this.motherQuiet?.008:this.celebrating?.08:this.quiet?.19:.26;}
  orchardActive(){return !!(this.corrupted&&this.chapter===1&&!this.title&&!this.orchard?.failed&&!this.orchard?.blocked);}
  mainMusicVolume(){return this.orchardActive()?0:this.musicVolume();}
  selectedTrack(){return this.title?HORIZON_TRACK:CHAPTER_TRACKS[this.chapter];}
  get trackFailed(){return this.failedTracks.has(this.selectedTrack());}
  wantsTrack(){return this.enabled&&this.foreground&&(this.title||this.playing)&&!!this.selectedTrack()&&!this.trackFailed;}
  createTrack(){
    // Reuse one streaming element; only the selected song is requested.
    const track=document.createElement('audio');track.id='chapter-soundtrack';track.hidden=true;track.preload='none';track.loop=true;track.setAttribute('playsinline','');track.setAttribute('aria-hidden','true');
    this.track=track;document.body.append(track);
    this.trackGain=this.ctx.createGain();this.trackGain.gain.value=0;this.trackGain.connect(this.musicBus);
    this.trackSource=this.ctx.createMediaElementSource(track);this.trackSource.connect(this.trackGain);
    track.addEventListener('error',()=>{if(track.error){this.failedTracks.add(this.trackURL);this.theme=-1;this.stopTrack();}});
  }
  selectTrack(url){
    if(url===this.trackURL)return;
    this.stopTrack();this.trackGeneration++;this.playPending=false;this.trackBlocked=false;
    this.trackURL=url;this.track.src=url;this.track.load();
  }
  fade(node,target,seconds){
    if(!node||node._target===target)return;node._target=target;
    const gain=node.gain,now=this.ctx.currentTime;gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(target,now+seconds);
  }
  stopTrack(){
    clearTimeout(this.pauseTimer);this.pauseTimer=null;
    if(this.trackGain){this.trackGain._target=0;this.trackGain.gain.cancelScheduledValues(this.ctx.currentTime);this.trackGain.gain.setValueAtTime(0,this.ctx.currentTime);}
    this.track?.pause();this.orchard?.stop();
  }
  syncTrack(){
    if(!this.ctx)return;
    const wanted=this.wantsTrack();
    const musicFade=this.motherQuiet?.65:this.corrupted||this.orchard?.active?2.4:this.celebrating?.12:.65;
    this.fade(this.motifGain,!this.title&&this.playing&&!this.orchardActive()&&(!this.selectedTrack()||this.trackFailed)?1:0,.25);
    if(wanted){
      if(!this.track)this.createTrack();
      this.selectTrack(this.selectedTrack());
      clearTimeout(this.pauseTimer);this.pauseTimer=null;
      if(this.track.paused&&!this.playPending&&!this.trackBlocked){
        this.playPending=true;const generation=this.trackGeneration,url=this.trackURL;
        // play() stays inside the gesture call stack on the first interaction.
        Promise.resolve(this.track.play()).then(()=>{
          if(generation!==this.trackGeneration)return;
          this.playPending=false;if(!this.wantsTrack()){this.stopTrack();return;}
          this.fade(this.trackGain,this.mainMusicVolume(),musicFade);
        }).catch(error=>{
          if(generation!==this.trackGeneration)return;
          this.playPending=false;
          if(error.name==='NotSupportedError'){this.failedTracks.add(url);this.theme=-1;this.stopTrack();}
          else if(error.name!=='AbortError')this.trackBlocked=true;
        });
      }else if(!this.track.paused)this.fade(this.trackGain,this.mainMusicVolume(),musicFade);
    }else if(this.track&&!this.track.paused&&!this.pauseTimer){
      this.fade(this.trackGain,0,.3);
      this.pauseTimer=setTimeout(()=>{this.pauseTimer=null;if(!this.wantsTrack())this.stopTrack();},310);
    }
    if(this.orchardActive()&&!this.orchard&&this.enabled&&this.foreground&&this.playing)this.orchard=new OrchardMusic(this);
    this.orchard?.update(this.orchardActive(),this.musicVolume(),musicFade);
  }
  // Exposure to the canyon wind, 0 to 1. Quantized, because it is recomputed
  // every frame and an unchanged target must not re-ramp the gain.
  wind(exposure){
    const target=Math.round(Math.min(1,Math.max(0,Number(exposure)||0))*64)/64;
    if(target===this.windTarget)return;
    this.windTarget=target;this.syncWind();
  }
  wantsWind(){return this.enabled&&this.foreground&&this.playing&&!this.title&&this.windTarget>0;}
  syncWind(){
    if(!this.ctx||!this.canyonWindBuffer)return;
    const wanted=this.wantsWind();
    if(wanted&&!this.windVoices.length){
      // Exposure (windGain) and the gust swell (windSwellGain) fade
      // independently in series, so approaching a well and a lull passing
      // through it never fight the same AudioParam.
      this.windGain=this.ctx.createGain();this.windGain.gain.value=0;this.windGain.connect(this.effectsBus);
      this.windSwellGain=this.ctx.createGain();this.windSwellGain.gain.value=WIND_SWELL[1];this.windSwellGain.connect(this.windGain);
      for(const [rate,offset,weight] of WIND_VOICES){
        const voice=this.ctx.createBufferSource(),gain=this.ctx.createGain();
        voice.buffer=this.canyonWindBuffer;voice.loop=true;voice.playbackRate.value=rate;gain.gain.value=weight;
        voice.connect(gain);gain.connect(this.windSwellGain);voice.start(0,this.canyonWindBuffer.duration*offset);
        this.windVoices.push(voice);
      }
      this.scheduleWindSwell();
    }
    if(!this.windVoices.length)return;
    this.fade(this.windGain,wanted?Sound.WIND_BED*this.windTarget:0,wanted?.6:.4);
    clearTimeout(this.windTimer);this.windTimer=null;
    if(!wanted)this.windTimer=setTimeout(()=>{this.windTimer=null;if(!this.wantsWind())this.stopWind();},430);
  }
  // Ramps the swell gain to a new random level over a new random duration,
  // then reschedules itself — an endless, irregular sequence of fades while
  // the bed keeps playing, independent of whether exposure itself changes.
  scheduleWindSwell(){
    if(!this.windSwellGain)return;
    const [lowLevel,highLevel]=WIND_SWELL,[lowSeconds,highSeconds]=WIND_SWELL_SECONDS;
    const level=lowLevel+Math.random()*(highLevel-lowLevel),seconds=lowSeconds+Math.random()*(highSeconds-lowSeconds);
    const gain=this.windSwellGain.gain,now=this.ctx.currentTime;
    gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(level,now+seconds);
    clearTimeout(this.windSwellTimer);this.windSwellTimer=setTimeout(()=>this.scheduleWindSwell(),seconds*1000);
  }
  stopWind(){
    clearTimeout(this.windTimer);this.windTimer=null;
    clearTimeout(this.windSwellTimer);this.windSwellTimer=null;
    for(const voice of this.windVoices)voice.stop();
    this.windVoices=[];this.windGain=null;this.windSwellGain=null;
  }
  tone(freq,duration=.12,type='sine',volume=.04,slide=1,music=false){if(!this.enabled||!this.foreground||!this.ctx)return;const now=this.ctx.currentTime;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),now+duration);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.012);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(music?this.motifGain:this.effectsBus);o.start(now);o.stop(now+duration+.02);}
  bufferEffect(buffer,volume=.5,duration,playbackRate=1,offset=0){
    if(!buffer)return false;
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(this.effectsBus);
    source.playbackRate.value=playbackRate;
    if(duration)source.start(0,offset,duration);else source.start();return true;
  }
  // One take of a set at random, never the same one twice running, pitched a
  // little differently each time — what keeps a sound that fires every stride
  // from wearing through. Each set remembers its own last pick, so footsteps
  // and kneading cannot push each other into a repeat.
  take(name,takes,volume){
    if(!takes?.length)return false;
    const last=this.lastTake??={};
    let pick=Math.floor(Math.random()*takes.length);
    if(takes.length>1&&pick===last[name])pick=(pick+1)%takes.length;
    last[name]=pick;
    return this.bufferEffect(takes[pick],volume,undefined,.94+Math.random()*.12);
  }
  effect(type,event={}){if(!this.enabled||!this.foreground)return;
    if(type==='stamp'&&this.bufferEffect(this.flowerBuffer))return;
    // Half again as loud as it shipped: a coin run was sitting under the
    // footsteps. Still the quietest recording in the game, and still varied in
    // level and pitch per pickup so a row of them does not turn into one tone.
    if(type==='coin'&&this.bufferEffect(this.coinBuffer,.018+Math.random()*.009,undefined,.58+Math.random()*.16))return;
    if(type==='checkpoint'&&this.bufferEffect(this.checkpointBuffer,.25))return;
    if(type==='complete'&&this.bufferEffect(this.completeBuffer))return;
    if(type==='step'&&event.surface==='crumble'&&this.bufferEffect(this.porousStepBuffer,.06,.38,.88+Math.random()*.1,.12))return;
    // Every other step is a recorded boot: on a plank deck where the deck is
    // timber, on clay ground everywhere else. Both sets are levelled to the
    // same loudness, a few decibels under the tick they replace — this is the
    // sound a chapter plays most, and the one that can least afford to be loud.
    if(type==='step'){
      const timber=TIMBER.has(event.surface);
      if(this.take(timber?'wood':'clay',timber?this.woodStepBuffers:this.clayStepBuffers,timber?.028:.038))return;
    }
    // Unlike the footstep, this one plays to its end: the rubble settles over
    // about the second the fragments take to fall. A deck regrows and can break
    // again every few seconds, so the pitch moves a little on each collapse.
    if(type==='crumble-collapse'&&this.bufferEffect(this.ledgeCollapseBuffer,.13,undefined,.94+Math.random()*.12))return;
    if(type==='mother-open'){
      if(!this.bufferEffect(this.motherGrowlBuffer,.2))this.tone(90,1.5,'sine',.04,.65);
      return;
    }
    // A spore of hers reaching the ground bursts with the same balloon
    // recording the player hears popping one, at a fraction of that gain and
    // only its opening: a spree is ten landings, and the one the player makes
    // themselves has to stay the louder of the two. The pitch moves a little,
    // so ten of them in a row are ten bursts rather than one with an echo.
    if(type==='mother-puff'&&this.bufferEffect(this.sporeBalloonBuffer,.1,.45,.92+Math.random()*.16))return;
    // Violet clay being kneaded, however it is worked — dragged, held under E,
    // tapped, stood on, stomped — and wherever it is, lab or chapter: one of
    // the three takes. The simulation spaces the events, so a long knead is a
    // run of takes rather than a pile of them.
    if(type==='knead'){
      if(this.take('knead',this.kneadBuffers,.3))return;
      this.tone(170*(.95+Math.random()*.1),.16,'triangle',.02,.6);return;
    }
    if(type==='break'&&event.spore||type==='mother-hit'||type==='mother-collapse'){
      if(this.bufferEffect(this.sporeBalloonBuffer,type==='break'?.5:.4))return;
      this.tone(115,.14,'sine',.075,.35);
      this.tone(360,.27,'triangle',.045,2.3);
      setTimeout(()=>this.tone(880,.38,'sine',.026,1.18),65);
      setTimeout(()=>this.tone(1320,.42,'sine',.018,1.08),135);
      return;
    }
    if(type==='squish'&&event.kind==='spore'&&this.bufferEffect(this.sporeBalloonBuffer,.22,.45))return;
    // One cue for a head landing on anything with a head: the bat, the
    // spitter, the clayling and the Dust Drifter are all defeated the same way
    // and now sound the same way. Only the spore balloon keeps its own.
    // The recording is a block of clay breaking — the material the enemy and
    // everything around it is made of, where the thud it replaces could have
    // been anything. It runs a little longer than that thud did, so it is
    // pitched either way per kill, the way the footsteps and the kneading are:
    // a chapter is a few dozen stomps, and one crack heard identically that
    // often stops sounding like clay and starts sounding like a sample.
    if(type==='squish'&&['bat','spitter','clayling','drifter'].includes(event.kind)&&this.bufferEffect(this.enemyHeadImpactBuffer,.46,undefined,.94+Math.random()*.12))return;
    // Jump and land are the two sounds a player hears most — a few hundred
    // times a chapter each. Both are the supplied boot thud, and the two are
    // pitched apart so a hop is not one sound played twice within half a
    // second: the push-off plays tight and a little above the recording, the
    // arrival below it. A little jitter on each stops them wearing through.
    if(type==='jump'&&this.bufferEffect(this.jumpBuffer,.055+Math.random()*.012,undefined,1.14+Math.random()*.09))return;
    if(type==='jump')this.tone(230*(.95+Math.random()*.1),.17+Math.random()*.025,'sine',.055+Math.random()*.011,1.8);
    if(type==='coin'){const now=performance.now();this.coinRun=now-this.lastCoin<600?(this.coinRun+1)%5:0;this.lastCoin=now;this.tone([659,784,880,988,1175][this.coinRun],.23,'sine',.04,1.1);}
    if(type==='land'){
      // Arrival speed picks the pitch, the weight and the length, the way the
      // squash and the camera already read it: the thud plays slower and
      // louder the harder the player comes down, a quarter below its recorded
      // pitch at the heaviest. Heavy landings keep the low body underneath;
      // a short hop stays the quiet tick it was.
      const weight=Math.min(1,Math.max(0,((event.impact??7)-3)/17)),jitter=.94+Math.random()*.12;
      if(!this.bufferEffect(this.jumpBuffer,.032+weight*.04,undefined,(1.02-weight*.24)*jitter))
        this.tone((126-weight*36)*jitter,.06+weight*.05,'sine',.024+weight*.03,.7);
      if(weight>.5)this.tone(58*jitter,.13+weight*.06,'triangle',.016+weight*.022,.5);
    }
    if(type==='crumble')this.tone(180,.13,'triangle',.024,.55);
    if(type==='crumble-collapse'){this.tone(95,.28,'triangle',.045,.4);this.tone(260,.13,'triangle',.018,.4);}
    if(type==='press-impact'){this.tone(75,.26,'triangle',.05,.42);this.tone(150,.09,'sine',.025,.5);}
    if(type==='step')this.tone(145+Math.random()*35,.04,'sine',.012,.7);
    if(type==='skid')this.tone(210,.12,'triangle',.022,.5);
    if(type==='spring'){this.tone(140,.4,'triangle',.055,4);}
    if(type==='mother-release')this.tone(160,.8,'triangle',.065,.4);
    if(type==='mother-puff')this.tone(120,.22,'sine',.04,.6);
    if(type==='mother-bounce')this.tone(130,.5,'triangle',.055,4);
    if(type==='mother-friendly')this.tone(285,.4,'sine',.03,1.5);
    if(type==='mother-bloom')[330,440,554].forEach((f,i)=>setTimeout(()=>this.tone(f,1.2,'sine',.025),i*210));
    if(type==='drifter-bump'){this.tone(220,.13,'sine',.028,1.35);}
    if(type==='stomp')this.tone(260,.22,'triangle',.04,.25);
    if(type==='spitter-charge')this.tone(220,.7,'sine',.023,1.9);
    if(type==='spitter-fire')this.tone(330,.13,'triangle',.035,.45);
    if(type==='shot-pop')this.tone(160,.06,'sine',.018,.6);
    if(type==='spore-wiggle')this.tone(390,.18,'sine',.018,1.2);
    if(type==='spore-puff')this.tone(270,.28,'triangle',.025,.65);
    if(type==='spore-leap')this.tone(410,.13,'sine',.025,2);
    if(type==='bat-charge')this.tone(440,.5,'sine',.03,1.7);
    if(type==='bat-dive')this.tone(780,.16,'triangle',.025,.25);
    if(type==='squish'||type==='break'){this.tone(145,.22,'triangle',.06,.4);}
    if(type==='hurt')this.tone(160,.24,'triangle',.07,.5);
    if(type==='switch')this.tone(440,.3,'sine',.05,1.5);
    if(type==='activate'){this.tone(330,.45,'triangle',.04,2);setTimeout(()=>this.tone(660,.5,'sine',.04,1.5),130);}
    if(type==='stamp'||type==='checkpoint'||type==='complete') [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,.6,'sine',.047),i*95));
  }
  update(dt,playing,chapter=0,quiet=false,title=false,celebrating=false,motherQuiet=false,corrupted=false){
    this.corrupted=corrupted;this.motherQuiet=motherQuiet;this.celebrating=celebrating;this.playing=playing;this.chapter=chapter;this.quiet=quiet;this.title=title;this.syncTrack();this.syncWind();
    if(motherQuiet||title||!playing||!this.enabled||!this.foreground||!this.ctx||this.selectedTrack()&&!this.trackFailed)return;
    if(this.theme!==chapter){this.theme=chapter;this.note=0;this.musicTimer=.3;}
    this.musicTimer-=dt;if(this.musicTimer>0)return;
    const t=THEMES[chapter]||THEMES[0],beat=this.note++,pattern=t.patterns[Math.floor(beat/8)%t.patterns.length],degree=pattern[beat%8];
    this.musicTimer=t.beat*(quiet?1.25:1);
    if(degree>=0&&(!quiet||beat%2===0)){
      const frequency=t.root*2**(t.scale[degree]/12);this.tone(frequency,chapter===1?.4:1.2,t.type,quiet?.005:.008,1,true);
      if(chapter===3&&beat%4===0)this.tone(frequency*2,.9,'sine',.003,1,true);
    }
    if(beat%8===0)this.tone(t.root*.5,2.3,'sine',quiet?.005:.008,1,true);
  }
}
