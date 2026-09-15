import {OrchardMusic} from './mother-puff-music.js';
// Quiet, distinct motifs leave footsteps and timing cues in the foreground.
const THEMES=[
  {root:220,beat:.45,type:'sine',scale:[0,2,4,7,9,12],patterns:[[0,-1,2,-1,3,2,-1,1],[0,2,4,-1,3,-1,1,-1],[2,-1,3,4,2,-1,0,-1],[3,2,-1,1,0,-1,-1,-1]]},
  {root:293.66,beat:.34,type:'triangle',scale:[0,2,4,7,9,12],patterns:[[0,2,-1,3,4,-1,2,-1],[2,3,4,-1,5,4,-1,2],[0,-1,1,2,3,-1,2,1],[4,3,-1,2,0,-1,-1,-1]]},
  {root:146.83,beat:.62,type:'sine',scale:[0,2,3,7,10,12],patterns:[[0,-1,-1,3,-1,-1,2,-1],[0,-1,4,-1,-1,3,-1,-1],[2,-1,-1,1,-1,3,-1,-1],[0,-1,-1,-1,3,-1,-1,-1]]},
  {root:261.63,beat:.43,type:'sine',scale:[0,2,4,7,9,12],patterns:[[0,-1,2,3,4,-1,3,-1],[2,3,5,-1,4,-1,2,-1],[3,-1,4,5,3,2,-1,1],[0,2,3,-1,2,-1,0,-1]]}
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
export class Sound {
  // Music and effects sit on their own buses so either can be silenced without
  // the other. Music defaults below effects: it is background, they are not.
  static DEFAULT_MUSIC=.55;
  static DEFAULT_EFFECTS=1;
  constructor(){
    this.ctx=null;this._enabled=true;this.foreground=true;this.title=true;this.playing=false;this.chapter=0;this.quiet=false;
    this._musicLevel=Sound.DEFAULT_MUSIC;this._effectsLevel=Sound.DEFAULT_EFFECTS;
    this.lastCoin=0;this.coinRun=0;this.musicTimer=0;this.note=0;this.theme=-1;
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
  set enabled(value){this._enabled=!!value;this.setMaster();if(!this._enabled)this.stopTrack();else this.syncTrack();}
  setForeground(value){this.foreground=!!value;this.setMaster();if(!this.foreground)this.stopTrack();else this.syncTrack();}
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
  tone(freq,duration=.12,type='sine',volume=.04,slide=1,music=false){if(!this.enabled||!this.foreground||!this.ctx)return;const now=this.ctx.currentTime;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),now+duration);g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume,now+.012);g.gain.exponentialRampToValueAtTime(.001,now+duration);o.connect(g);g.connect(music?this.motifGain:this.effectsBus);o.start(now);o.stop(now+duration+.02);}
  bufferEffect(buffer,volume=.5,duration,playbackRate=1,offset=0){
    if(!buffer)return false;
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(this.effectsBus);
    source.playbackRate.value=playbackRate;
    if(duration)source.start(0,offset,duration);else source.start();return true;
  }
  effect(type,event={}){if(!this.enabled||!this.foreground)return;
    if(type==='stamp'&&this.bufferEffect(this.flowerBuffer))return;
    if(type==='coin'&&this.bufferEffect(this.coinBuffer,.012+Math.random()*.006,undefined,.58+Math.random()*.16))return;
    if(type==='checkpoint'&&this.bufferEffect(this.checkpointBuffer,.25))return;
    if(type==='complete'&&this.bufferEffect(this.completeBuffer))return;
    if(type==='step'&&event.surface==='crumble'&&this.bufferEffect(this.porousStepBuffer,.06,.38,.88+Math.random()*.1,.12))return;
    if(type==='mother-open'){
      if(!this.bufferEffect(this.motherGrowlBuffer,.2))this.tone(90,1.5,'sine',.04,.65);
      return;
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
    if(type==='squish'&&['bat','spitter','clayling'].includes(event.kind)&&this.bufferEffect(this.enemyHeadImpactBuffer,.36))return;
    if(type==='jump')this.tone(230,.18,'sine',.06,1.8);
    if(type==='coin'){const now=performance.now();this.coinRun=now-this.lastCoin<600?(this.coinRun+1)%5:0;this.lastCoin=now;this.tone([659,784,880,988,1175][this.coinRun],.23,'sine',.04,1.1);}
    if(type==='land')this.tone(110,.07,'sine',.03,.7);
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
    this.corrupted=corrupted;this.motherQuiet=motherQuiet;this.celebrating=celebrating;this.playing=playing;this.chapter=chapter;this.quiet=quiet;this.title=title;this.syncTrack();
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
