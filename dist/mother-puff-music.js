export const STONE_ORCHARD_TRACK=new URL('./assets/the-stone-orchard.mp3',import.meta.url).href;

// An optional second stream permits a real crossfade while the forest song
// continues in place. It is created only when the corrupted area is entered.
export class OrchardMusic {
  constructor(sound){
    this.sound=sound;this.failed=false;this.blocked=false;this.pending=false;this.active=false;this.serial=0;
    const track=this.track=document.createElement('audio');track.id='stone-orchard-soundtrack';track.hidden=true;track.preload='none';track.loop=true;track.src=STONE_ORCHARD_TRACK;track.setAttribute('playsinline','');track.setAttribute('aria-hidden','true');document.body.append(track);
    this.gain=sound.ctx.createGain();this.gain.gain.value=0;this.gain.connect(sound.master);
    this.source=sound.ctx.createMediaElementSource(track);this.source.connect(this.gain);
    track.addEventListener('error',()=>{this.failed=true;this.stop();sound.syncTrack();});
  }
  stop(){
    clearTimeout(this.pauseTimer);this.pauseTimer=null;this.serial++;this.pending=false;
    this.sound.fade(this.gain,0,0);this.track.pause();
  }
  update(active,volume,seconds){
    const sound=this.sound;this.active=active&&!this.failed;
    if(!sound.enabled||!sound.foreground||!sound.playing||sound.title||sound.chapter!==1){this.stop();return;}
    if(this.active){
      clearTimeout(this.pauseTimer);this.pauseTimer=null;
      if(this.track.paused&&!this.pending&&!this.blocked){
        const serial=++this.serial;this.pending=true;
        Promise.resolve(this.track.play()).then(()=>{
          if(serial!==this.serial)return;this.pending=false;
          if(!this.active||!sound.enabled||!sound.foreground||!sound.playing){this.stop();return;}
          sound.fade(this.gain,sound.musicVolume(),seconds);
        }).catch(error=>{
          if(serial!==this.serial)return;this.pending=false;
          if(error.name==='NotSupportedError')this.failed=true;
          else if(error.name!=='AbortError')this.blocked=true;
          sound.syncTrack();
        });
      }else if(!this.track.paused)sound.fade(this.gain,volume,seconds);
    }else{
      sound.fade(this.gain,0,seconds);
      if(!this.track.paused&&!this.pauseTimer)this.pauseTimer=setTimeout(()=>{this.pauseTimer=null;if(!this.active)this.stop();},seconds*1000+30);
    }
  }
}
