// State comes from the browser's fullscreen element, including exits via Escape.
export class Fullscreen {
  constructor({doc=document,screenRef=screen,onChange=()=>{},onUnavailable=()=>{}}={}) {
    this.doc=doc;this.screen=screenRef;this.onChange=onChange;this.onUnavailable=onUnavailable;this.pending=false;
    this.sync=()=>{const active=this.active;try{if(!active)this.screen.orientation?.unlock?.();}catch{}this.onChange(active);};
    doc.addEventListener('fullscreenchange',this.sync);doc.addEventListener('webkitfullscreenchange',this.sync);
  }
  get active(){return !!(this.doc.fullscreenElement||this.doc.webkitFullscreenElement);}
  async enter(){
    if(this.active)return true;if(this.pending)return false;
    const el=this.doc.documentElement,request=el.requestFullscreen||el.webkitRequestFullscreen;
    if(!request){this.onUnavailable();return false;}
    this.pending=true;
    try{
      await request.call(el,{navigationUI:'hide'});
      // Orientation is a convenience; a refused lock never cancels fullscreen.
      if(this.active&&typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches)
        try{await this.screen.orientation?.lock?.('landscape');}catch{}
      this.sync();return this.active;
    }catch{this.onUnavailable();return false;}finally{this.pending=false;}
  }
  async toggle(){
    if(this.pending)return false;
    if(!this.active)return this.enter();
    this.pending=true;
    try{const exit=this.doc.exitFullscreen||this.doc.webkitExitFullscreen;await exit?.call(this.doc);this.sync();return !this.active;}
    catch{this.onUnavailable();return false;}finally{this.pending=false;}
  }
}
