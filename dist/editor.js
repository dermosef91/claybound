import {DraftSession,KINDS,LISTS,selectedObject,objectLabel,repairDraft} from './editor-model.js';
import {instantiateLevel} from './levels.js';
import {Game,FIXED_DT,RULES} from './simulation.js';
import {BAT,batPatrolBounds} from './enemy-rules.js';
import {DRIFTER} from './drifter-rules.js';
const airborne=p=>['bat','drifter'].includes(p.kind);
const hoverHeight=p=>p.y+(airborne(p)?Math.sin(p.phase||0)*(p.bob??(p.kind==='bat'?BAT:DRIFTER).bob)+(p.kind==='bat'?BAT.modelOffsetY:0):0);

const $=id=>document.getElementById(id),clone=o=>structuredClone(o),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
const button=(action,name,label,cls='')=>`<button class="editor-button ${cls}" data-edit="${action}" aria-label="${label}" title="${label}">${icon(name)}<span>${label}</span></button>`;
const option=(value,label,current)=>`<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`;
const field=(key,label,value,step=.25,min=-100,max=2000)=>`<label class="editor-field"><span>${label}</span><input data-field="${key}" type="number" inputmode="decimal" value="${Number(value??0)}" step="${step}" min="${min}" max="${max}"></label>`;
const checkbox=(key,label,value)=>`<label class="editor-check"><input data-field="${key}" type="checkbox" ${value?'checked':''}><span>${label}</span></label>`;

export function jumpGuide(level,index,platform,direction){
  const g=new Game();g.start(index,level);const x=platform.x+platform.w/2;
  Object.assign(g.player,{x,y:platform.y,groundId:platform.id,vx:direction*RULES.speed,facing:direction});
  const points=[{x,y:platform.y}];let airborne=false;
  for(let i=0;i<190;i++){
    g.tick(FIXED_DT,{moveAxis:direction,jumpPressed:i===0,jumpHeld:true});
    if(i%4===0)points.push({x:g.player.x,y:g.player.y});
    if(!g.player.groundId)airborne=true;
    if(g.respawnTimer||airborne&&g.player.groundId||g.status==='complete')break;
  }
  return points;
}

export class LevelEditor{
  constructor({world,game,levels,library,onEnter,onTest,onExit,onFullscreen=()=>{}}){
    Object.assign(this,{world,game,levels,library,onEnter,onTest,onExit,onFullscreen});
    this.active=false;this.testing=false;this.mode='select';this.snap=.25;this.carry=true;this.guides=true;this.pointers=new Map();this.camera={x:5,y:2,viewH:24};this.collapsed=false;this.request=0;this.trace=[];
    const root=document.createElement('section');root.id='level-editor';root.className='level-editor hidden';root.setAttribute('aria-label','Level editor');
    root.innerHTML=`<canvas id="editor-plane" tabindex="0" aria-label="Level design canvas. Select objects by touch or use Browse objects. Arrow keys nudge a selection; drag empty space to pan."></canvas>
      <header class="editor-top"><div class="editor-identity">${button('exit','chevron-left','Game','editor-icon')}<div><strong>The clay workshop<span>.</span></strong><small>Make the next leap your own.</small></div></div><label class="editor-level-label"><span class="sr-only">Chapter to edit</span><select id="editor-level">${levels.map((L,i)=>option(i,`${String(i+1).padStart(2,'0')} · ${L.short}`,0)).join('')}</select></label><div class="editor-top-actions">${button('more','ellipsis','More','editor-icon')}${button('test','play','Test','editor-primary')}</div></header>
      <nav class="editor-tools" aria-label="Editing tools">${button('select','mouse-pointer-2','Select','editor-tool active')}${button('pan','hand','Pan','editor-tool')}${button('undo','undo-2','Undo','editor-icon')}${button('redo','redo-2','Redo','editor-icon')}${button('add','plus','Add','editor-add')}</nav>
      <div class="editor-zoom">${button('zoom-in','plus','Zoom in','editor-icon')}${button('zoom-out','minus','Zoom out','editor-icon')}${button('focus','scan','Frame selection','editor-icon')}</div>
      <div class="editor-overview"><canvas id="editor-map" aria-label="Chapter overview. Drag to travel through the level."></canvas><label><span class="sr-only">Jump to passage</span><select id="editor-passage"></select></label></div>
      <aside id="editor-inspector" class="editor-inspector" aria-label="Object properties"></aside>
      <div id="editor-message" class="editor-message" role="status" aria-live="polite"></div>
      <div id="editor-popover" class="editor-popover hidden" role="dialog" aria-modal="true" aria-labelledby="editor-popover-title"></div>
      <input id="editor-import" type="file" accept=".json,application/json" class="hidden">
    `;
    $('game-shell').append(root);this.root=root;this.canvas=$('editor-plane');this.ctx=this.canvas.getContext('2d');this.map=$('editor-map');this.mapCtx=this.map.getContext('2d');
    root.addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b){e.preventDefault();this.action(b.dataset.edit,b);}});
    root.addEventListener('change',e=>this.fieldChange(e));
    this.canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    for(const name of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(name,e=>this.pointerUp(e,name==='pointercancel'));
    this.canvas.addEventListener('wheel',e=>{if(!this.active)return;e.preventDefault();this.zoom(Math.exp(clamp(e.deltaY,-100,100)*.0025),this.point(e));},{passive:false});
    const mapMove=e=>{if(e.type!=='pointerdown'&&!this.map.hasPointerCapture(e.pointerId))return;e.preventDefault();if(e.type==='pointerdown')this.map.setPointerCapture(e.pointerId);const r=this.map.getBoundingClientRect(),x=this.mapBounds.min+(e.clientX-r.left)/r.width*(this.mapBounds.max-this.mapBounds.min);const p=this.session.level.platforms.reduce((best,p)=>Math.abs(p.x+p.w/2-x)<Math.abs(best.x+best.w/2-x)?p:best);this.camera.x=x;this.camera.y=p.y+this.camera.viewH*.12;};
    this.map.addEventListener('pointerdown',mapMove);this.map.addEventListener('pointermove',mapMove);
    this.map.addEventListener('pointerup',e=>{if(this.map.hasPointerCapture(e.pointerId))this.map.releasePointerCapture(e.pointerId);});
    window.addEventListener('keydown',e=>this.key(e));window.addEventListener('keyup',e=>{if(e.code==='Space')this.spacePan=false;});
    window.addEventListener('blur',()=>{this.spacePan=false;this.cancelGesture();});
    window.addEventListener('resize',()=>{this.cancelGesture();this.mapDirty=true;});
    $('editor-import').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>1500000)throw new Error('This file is too large.');const level=this.library.read(await file.text(),this.session.index);this.session.change(()=>this.session.level=level);this.session.selection=null;this.changed();this.notice('Backup imported. Your previous design is available with Undo.');}catch(err){this.notice(err.message,true);}});
  }
  icons(){window.lucide?.createIcons({attrs:{'stroke-width':1.8}});}
  async open(index,focus=null){
    const request=++this.request;
    this.notice('Opening the workshop…');
    try{await this.world.prepareLevel(this.library.get(index));}catch{if(this.session)$('editor-level').value=this.session.index;this.notice('This world could not load. Please try again.',true);return;}
    if(request!==this.request)return;
    const same=this.session?.index===index&&this.testing;
    if(!same){this.session=new DraftSession(this.library,index);this.camera={x:focus?.x??this.session.level.spawn.x+3,y:(focus?.y??this.session.level.spawn.y)+2,viewH:innerWidth>innerHeight?17:30};this.collapsed=false;}
    this.active=true;this.testing=false;this.onEnter();this.root.classList.remove('hidden');document.body.classList.add('is-editing');document.body.classList.remove('is-editor-test');document.body.dataset.biome=this.session.level.biome;
    this.game.start(index,this.session.level);this.game.status='editing';this.world.setEditorCamera(this.camera);this.world.build(this.game.level,index,this.camera.x);this.preview(true);
    $('editor-level').value=index;$('editor-passage').innerHTML=this.session.level.sections.map(s=>option(s.id,s.name,0)).join('');this.renderInspector();this.syncTools();this.mapDirty=true;this.closePopover();this.canvas.focus();
    this.notice(this.library.error||'Tap a platform to shape it. Drag empty space to pan. Pinch to zoom.',!!this.library.error);
  }
  preview(rebuild=false){
    this.game.level=instantiateLevel(this.session.index,this.session.level);this.game.status='editing';
    // In design mode the complete collision surfaces are visible. Playtesting
    // starts a fresh simulation with the real switches and timings.
    for(const p of this.game.level.platforms){p.active=true;if(p.channel)this.game.channels[p.channel]=10;}
    const spawn=this.session.level.spawn,ground=this.game.level.platforms.find(p=>spawn.x>=p.x&&spawn.x<=p.x+p.w&&Math.abs(spawn.y-p.y)<.2);
    Object.assign(this.game.player,spawn,{vx:0,vy:0,groundId:ground?.id??null});
    if(rebuild){this.world.refreshEditor(this.game.level,this.camera.x);this.widths=new Map(this.game.level.platforms.map(p=>[p.id,p.w]));}
    else{
      for(const p of this.game.level.platforms){const v=this.world.platforms.get(p.id);if(v)v.root.scale.x=p.w/(this.widths?.get(p.id)||p.w);}
      for(const list of ['coins','stamps'])this.game.level[list].forEach((p,i)=>{const v=(list==='coins'?this.world.coinViews:this.world.stampViews)[i];if(v)v.position.x=p.x;});
      for(const [list,prefix]of [['hazards','h:'],['crushers','r:'],['winds','w:']])this.game.level[list].forEach((p,i)=>{const v=this.world.streamViews.get(prefix+(list==='winds'?p.id:i));if(v)v.root.position.set(p.x,p.y,0);});
    }
    this.mapDirty=true;
  }
  changed(){this.preview(true);this.renderInspector();this.syncTools();this.updateGuide();if(this.library.error)this.notice(this.library.error,true);}
  select(selection){this.session.selection=selection;this.collapsed=false;this.renderInspector();$('editor-inspector').querySelector('.editor-inspector-body').scrollTop=0;this.updateGuide();}
  updateGuide(){const p=selectedObject(this.session.level,this.session.selection);this.trace=this.guides&&this.session.selection?.list==='platforms'&&p?[jumpGuide(this.session.level,this.session.index,p,-1),jumpGuide(this.session.level,this.session.index,p,1)]:[];}
  syncTools(){
    this.root.querySelector('[data-edit="undo"]').disabled=!this.session.undoStack.length;this.root.querySelector('[data-edit="redo"]').disabled=!this.session.redoStack.length;
    for(const mode of ['select','pan']){const b=this.root.querySelector(`[data-edit="${mode}"]`);b.classList.toggle('active',this.mode===mode);b.setAttribute('aria-pressed',String(this.mode===mode));}
    this.canvas.style.cursor=this.mode==='pan'?'grab':'default';this.icons();
  }
  renderInspector(){
    const sel=this.session.selection,p=selectedObject(this.session.level,sel),box=$('editor-inspector'),scroll=box.querySelector('.editor-inspector-body')?.scrollTop||0;box.classList.toggle('collapsed',this.collapsed);
    const save=this.library.error?'Export to keep your changes':this.library.has(this.session.index)?'Saved on this device':'Original chapter · ready to shape';
    let html=`<div class="editor-inspector-head"><div><strong>${p?esc(objectLabel(p,sel.list)):'A little room to create'}</strong><span>${p?esc(p.id||'Selected object'):save}</span></div>${button('collapse',this.collapsed?'chevron-up':'chevron-down',this.collapsed?'Show properties':'Hide properties','editor-icon')}</div><div class="editor-inspector-body">`;
    if(!p){html+=`<p>Select an object in the world or browse the list. Move platforms with their beads, switches and enemies attached.</p>${button('browse','list','Browse objects')}<div class="editor-settings"><label>Snap to <select id="editor-snap">${[0,.25,.5,1].map(v=>option(v,v?`${v} units`:'Free',this.snap)).join('')}</select></label><label class="editor-check"><input id="editor-carry" type="checkbox" ${this.carry?'checked':''}>Move contents</label><label class="editor-check"><input id="editor-guide" type="checkbox" ${this.guides?'checked':''}>Show jump guide</label></div>`;}
    else{
      if(sel.list==='platforms')html+=`<label class="editor-field editor-wide"><span>Platform type</span><select data-field="kind">${Object.entries(KINDS).map(([v,l])=>option(v,l,p.kind)).join('')}</select></label>`;
      if(sel.list==='enemies')html+=`<label class="editor-field editor-wide"><span>Enemy type</span><select data-field="kind">${this.session.level.biome==='cave'||p.kind==='bat'?option('bat','Flying bat',p.kind):''}${this.session.level.biome==='cave'||p.kind==='spitter'?option('spitter','Echo Spitter',p.kind):''}${this.session.level.biome==='desert'||p.kind==='drifter'?option('drifter','Dust Drifter',p.kind):''}${this.session.level.biome==='forest'||p.kind==='spore'?option('spore','Spore Puff',p.kind):''}${option('clayling','Clayling',p.kind||'clayling')}</select></label>`;
      html+=`<div class="editor-fields">${field('x','Position X',p.x)}${field('y','Height Y',p.y,.25,-40,160)}`;
      if(p.w!==undefined)html+=field('w','Width',p.w,.25,p.goal?2.5:.6,80);
      if(p.h!==undefined)html+=field('h','Area height',p.h,.25,.6,80);
      if(p.kind==='gate')html+=field('h','Grate height',p.h||10,.25,2,30);
      if(p.kind==='ferry')html+=field('travel','Rail length',p.travel||24,.5,1,30)+field('speed','Travel speed',p.speed||3.2,.1,.1,8);
      if(p.kind==='lift'||p.kind==='orbit')html+=field('moveX','Horizontal travel',p.moveX,.25,-30,30)+field('moveY','Vertical travel',p.moveY,.25,-30,30)+field('period','Cycle (seconds)',p.period||5,.1,.5,60)+field('phase','Starting phase',p.phase,.1,-20,20);
      if(p.kind==='counter')html+=field('rise','Lift rise',p.rise||3,.25,0,30);
      if(p.kind==='crumble')html+=field('delay','Fall delay (sec)',p.delay||.62,.1,.15,3.5);
      if(p.kind==='pulse')html+=field('period','Cycle (seconds)',p.period||4.8,.1,.5,60)+field('duty','Visible fraction',p.duty||.76,.05,.1,.95)+field('phase','Starting phase',p.phase,.05,-20,20);
      if(p.kind==='switch')html+=field('duration','Active seconds',p.duration||10,.5,1,60);
      if(sel.list==='winds')html+=field('fx','Sideways force',p.fx,.5,-30,30)+field('fy','Upward force',p.fy,.5,-15,25);
      if(sel.list==='enemies'&&p.kind!=='spitter'){const bounds=p.kind==='bat'?batPatrolBounds(p,this.session.level.platforms):p;html+=field('min','Patrol from X',bounds.min,.25,-100,2000)+field('max','Patrol to X',bounds.max,.25,-100,2000)+field('speed','Speed',p.speed,.1,.1,8);}
      if(sel.list==='enemies'&&airborne(p))html+=field('bob','Hover distance',p.bob??(p.kind==='bat'?BAT:DRIFTER).bob,.1,0,4)+field('period','Hover cycle (sec)',p.period??(p.kind==='bat'?BAT:DRIFTER).period,.1,.5,60)+field('phase','Starting phase',p.phase??0,.1,-20,20);
      if(sel.list==='crushers'&&p.floorY!==undefined)html+=field('floorY','Impact floor height',p.floorY,.25,-40,160);
      if(sel.list==='crushers')html+=field('range','Press travel',p.range,.25,.2,25)+field('period','Cycle (seconds)',p.period,.1,.5,60);
      if(p.goal)html+=field('bellX','Bell offset',p.bellX,.25,.4,p.w-.4);
      html+='</div>';
      const channelKey=sel.list==='crushers'?'holdChannel':p.kind==='break'?'releases':'channel';
      if(['switch','timed','balance','counter','break','gate'].includes(p.kind)||['winds','crushers'].includes(sel.list)){
        const channels=[...new Set(this.session.level.platforms.flatMap(p=>[p.channel,p.releases]).filter(Boolean))];
        html+=`<label class="editor-field editor-wide"><span>${channelKey==='releases'?'Releases circuit':channelKey==='holdChannel'?'Hold up with circuit':'Circuit name'}</span><input type="text" data-field="${channelKey}" value="${esc(p[channelKey]||'')}" maxlength="70" list="editor-channels" placeholder="e.g. wind-a" autocapitalize="none" spellcheck="false"><datalist id="editor-channels">${channels.map(c=>option(c,c,'')).join('')}</datalist><small>Matching names connect switches, bridges and winds.</small></label>`;
      }
      if(p.kind==='switch')html+=checkbox('latch','Stay active after pressing',p.latch);
      if(sel.list==='platforms')html+=checkbox('checkpoint','Checkpoint on this platform',p.checkpoint!==undefined);
      if(sel.list==='winds')html+=checkbox('gust','Pulsing gust',p.gust)+checkbox('spores','Show spores',p.spores);
      html+=`<div class="editor-nudge" aria-label="Nudge selected object">${button('left','arrow-left','Nudge left','editor-icon')}${button('up','arrow-up','Nudge up','editor-icon')}${button('down','arrow-down','Nudge down','editor-icon')}${button('right','arrow-right','Nudge right','editor-icon')}</div>`;
      if(sel.list==='platforms')html+=`${button('test-here','play','Test from this platform','editor-full')}<p class="editor-guide-caption">Dashed arcs use the real physics at full running speed with jump held.</p>`;
      html+=`<div class="editor-object-actions">${button('duplicate','copy','Duplicate')}${button('delete','trash-2','Delete')}</div><p class="editor-save-note">${esc(save)}</p>`;
    }
    html+='</div>';box.innerHTML=html;box.querySelector('.editor-inspector-body').scrollTop=scroll;this.icons();
  }
  async fieldChange(e){
    const el=e.target;
    if(el.id==='editor-level'){await this.open(Number(el.value));return;}
    if(el.id==='editor-passage'){const section=this.session.level.sections[Number(el.value)],p=this.session.level.platforms.find(p=>p.x>=section.x)||this.session.level.platforms[0];this.camera.x=p.x+p.w/2;this.camera.y=p.y+2;return;}
    if(el.id==='editor-snap'){this.snap=Number(el.value);return;}
    if(el.id==='editor-carry'){this.carry=el.checked;return;}
    if(el.id==='editor-guide'){this.guides=el.checked;this.updateGuide();return;}
    if(el.id==='editor-browse'){if(!el.value)return;const [list,index]=el.value.split(':');this.select({list,index:Number(index)});this.focus();this.closePopover();return;}
    if(!el.dataset.field)return;
    try{
      if(el.type==='number'&&!el.checkValidity())throw new Error(`Use a value from ${el.min} to ${el.max}.`);
      const key=el.dataset.field,obj=selectedObject(this.session.level,this.session.selection);
      let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value.trim();
      if(key==='checkpoint')value=value?obj.x+obj.w/2:null;
      if(key==='x'||key==='y'){this.session.startChange();this.session.move(key==='x'?value-obj.x:0,key==='y'?value-obj.y:0,this.carry);this.session.commit();}
      else this.session.set(key,value);
      this.changed();
    }catch(err){this.notice(err.message,true);this.renderInspector();}
  }
  async action(action,buttonElement){
    try{
      if(action==='exit'){this.cancelGesture();this.active=false;this.testing=false;this.request++;this.root.classList.add('hidden');this.world.setEditorCamera(null);document.body.classList.remove('is-editing','is-editor-test');this.onExit();return;}
      if(action==='select'||action==='pan'){this.mode=action;this.syncTools();return;}
      if(action==='undo'||action==='redo'){this.session[action]();this.changed();return;}
      if(action==='zoom-in'||action==='zoom-out'){this.zoom(action==='zoom-in'?.8:1.25);return;}
      if(action==='focus'){this.focus(true);return;}
      if(action==='fullscreen'){this.onFullscreen();return;}
      if(action==='collapse'){this.collapsed=!this.collapsed;this.renderInspector();return;}
      if(action==='close'){this.closePopover();return;}
      if(action==='test'||action==='test-here'){this.playtest(action==='test-here');return;}
      if(action==='add'){this.popover('A little something new',`<div class="editor-palette">${Object.entries(KINDS).map(([type,label])=>`<button data-edit="place" data-type="${type}">${icon(type==='lift'?'move-vertical':type==='spring'?'arrow-up-from-line':type==='switch'?'power':'square')}<span>${label}</span></button>`).join('')}${Object.entries({coins:'Clay bead',stamps:'Secret flower',enemies:'Clayling',...(this.session.level.biome==='cave'?{bat:'Flying bat',spitter:'Echo Spitter'}:{}),...(this.session.level.biome==='desert'?{drifter:'Dust Drifter'}:{}),...(this.session.level.biome==='forest'?{spore:'Spore Puff'}:{}),hazards:'Spikes',winds:'Wind area',crushers:'Press'}).map(([type,label])=>`<button data-edit="place" data-type="${type}">${icon({coins:'circle-dot',stamps:'flower-2',enemies:'bug',bat:'bird',spitter:'circle-dot',drifter:'wind',spore:'sprout',hazards:'triangle-alert',winds:'wind',crushers:'arrow-down-to-line'}[type])}<span>${label}</span></button>`).join('')}</div><p>New objects appear at the center of your view. Drag to place them.</p>`);return;}
      if(action==='place'){this.session.add(buttonElement.dataset.type,this.round(this.camera.x),this.round(this.camera.y));this.closePopover();this.changed();return;}
      if(action==='duplicate'||action==='delete'){if(action==='delete')this.session.remove();else this.session.duplicate();this.changed();return;}
      if(['left','right','up','down'].includes(action)){this.nudge(action);return;}
      if(action==='browse'){this.popover('Find an object',`<label class="editor-field editor-wide"><span>Choose to select and frame</span><select id="editor-browse"><option value="">Choose an object…</option>${[{list:'spawn',index:0,p:this.session.level.spawn},...LISTS.flatMap(list=>this.session.level[list].map((p,index)=>({list,index,p})))].map(({list,index,p})=>option(`${list}:${index}`,`${objectLabel(p,list)} · ${p.id||index+1} · X ${p.x.toFixed(1)}`,'' )).join('')}</select></label>`);return;}
      if(action==='more'){this.popover('Your workshop',`<div class="editor-more">${button('browse','list','Browse objects')}${button('export','download','Export level backup')}${button('import','upload','Import level backup')}${button('restore','rotate-ccw','Restore original chapter')}${button('fullscreen','expand','Fullscreen')}${button('help','circle-help','Editor controls')}</div><div class="editor-settings"><label>Snap to <select id="editor-snap">${[0,.25,.5,1].map(v=>option(v,v?`${v} units`:'Free',this.snap)).join('')}</select></label><label class="editor-check"><input id="editor-carry" type="checkbox" ${this.carry?'checked':''}>Move contents with platforms</label><label class="editor-check"><input id="editor-guide" type="checkbox" ${this.guides?'checked':''}>Show jump guide</label></div><p>Edits save automatically on this device and are used when you play. Export a backup to move them to another device.</p>`);return;}
      if(action==='export'){
        const blob=new Blob([this.library.export(this.session.index,this.session.level)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`claybound-chapter-${this.session.index+1}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);this.notice('Level backup exported.');return;
      }
      if(action==='import'){$('editor-import').click();this.closePopover();return;}
      if(action==='restore'){this.popover('Restore the original?',`<p>This replaces your saved design for this chapter. Export a backup first if you want to keep it.</p><div class="editor-more">${button('export','download','Export a backup')}${button('confirm-restore','rotate-ccw','Restore original','editor-danger')}${button('close','x','Keep editing')}</div>`);return;}
      if(action==='confirm-restore'){this.library.reset(this.session.index);this.session=new DraftSession(this.library,this.session.index);this.closePopover();this.changed();this.notice('Original chapter restored.');return;}
      if(action==='help'){this.popover('Make room for a better leap',`<div class="editor-help"><p><strong>Touch:</strong> tap to select, then drag. Grab either round handle to resize a platform. Drag empty space to pan; use two fingers to pan and pinch.</p><p><strong>Precision:</strong> use the property fields or four nudge buttons. Choose a snap distance in More. Drag the chapter overview or choose a passage to travel.</p><p><strong>Keyboard:</strong> arrows nudge, Shift gives a larger step. Space + drag pans. Ctrl / ⌘ Z undoes; Shift Z redoes. Delete removes, Ctrl / ⌘ D duplicates.</p><p><strong>Test:</strong> the top Test button starts at the chapter’s player start. A selected platform has its own Test from here button. Return to editor preserves your design and view.</p><p><strong>Connected systems:</strong> matching circuit names connect switches to bridges, windwells and counter lifts. Your edits do not change the original chapter’s records.</p></div>`);}
    }catch(err){this.notice(err.message,true);}
  }
  playtest(here=false){
    this.cancelGesture();const obj=selectedObject(this.session.level,this.session.selection);const spawn=here&&this.session.selection?.list==='platforms'?{x:obj.x+obj.w/2,y:obj.y,groundId:obj.id}:null;
    this.testing=true;this.active=false;this.root.classList.add('hidden');this.world.setEditorCamera(null);document.body.classList.remove('is-editing');document.body.classList.add('is-editor-test');this.onTest(this.session.index,clone(this.session.level),spawn);
  }
  returnToEditor(){return this.open(this.session.index);}
  popover(title,html){const p=$('editor-popover');if(p.classList.contains('hidden'))this.popoverFocus=document.activeElement;p.innerHTML=`<div class="editor-popover-card"><header><h2 id="editor-popover-title">${title}</h2>${button('close','x','Close','editor-icon')}</header>${html}</div>`;p.classList.remove('hidden');this.canvas.inert=true;this.root.querySelectorAll('.editor-top,.editor-tools,.editor-zoom,.editor-overview,.editor-inspector').forEach(e=>e.inert=true);this.icons();p.querySelector('button,select,input')?.focus();}
  closePopover(){$('editor-popover').classList.add('hidden');this.canvas.inert=false;this.root.querySelectorAll('.editor-top,.editor-tools,.editor-zoom,.editor-overview,.editor-inspector').forEach(e=>e.inert=false);if(this.active)(this.popoverFocus?.isConnected?this.popoverFocus:this.canvas).focus({preventScroll:true});}
  notice(text,error=false){const el=$('editor-message');if(!el)return;el.textContent=text;el.classList.add('visible');el.classList.toggle('editor-error',error);clearTimeout(this.messageTimer);this.messageTimer=setTimeout(()=>el.classList.remove('visible'),error?8000:4500);}
  point(e){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  dimensions(){const r=this.canvas.getBoundingClientRect();return {w:Math.max(1,r.width),h:Math.max(1,r.height)};}
  toWorld(point){const {w,h}=this.dimensions(),unit=this.camera.viewH/h;return {x:this.camera.x+(point.x-w/2)*unit,y:this.camera.y-(point.y-h/2)*unit};}
  toScreen(x,y){const {w,h}=this.size||this.dimensions(),unit=h/this.camera.viewH;return {x:w/2+(x-this.camera.x)*unit,y:h/2-(y-this.camera.y)*unit};}
  round(n){return this.snap?Math.round(n/this.snap)*this.snap:Math.round(n*100)/100;}
  zoom(factor,point){const {w,h}=this.dimensions();point??={x:w/2,y:h/2};const before=this.toWorld(point);this.camera.viewH=clamp(this.camera.viewH*factor,7,65);const after=this.toWorld(point);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;}
  focus(fit=false){const p=selectedObject(this.session.level,this.session.selection)||this.session.level.spawn,{w,h}=this.dimensions();if(fit)this.camera.viewH=clamp(((p.w||4)+7)*h/w,12,55);this.camera.x=p.x+(p.w||0)/2;this.camera.y=p.y+1;}
  nudge(dir,large=false){if(!this.session.selection)return;const d=large?1:this.snap||.1;this.session.startChange();this.session.move(dir==='left'?-d:dir==='right'?d:0,dir==='down'?-d:dir==='up'?d:0,this.carry);this.session.commit();this.changed();}
  key(e){
    if(!this.active)return;
    const pop=$('editor-popover');
    if(!pop.classList.contains('hidden')){if(e.code==='Escape'){e.preventDefault();this.closePopover();this.canvas.focus();}if(e.code==='Tab'){const f=[...pop.querySelectorAll('button,input,select')],i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f.at(-1)?.focus();}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0]?.focus();}}return;}
    if(e.target.matches?.('input,select,textarea'))return;
    const mod=e.ctrlKey||e.metaKey;
    try{
      if(mod&&e.code==='KeyZ'){e.preventDefault();this.session[e.shiftKey?'redo':'undo']();this.changed();}
      else if(mod&&e.code==='KeyY'){e.preventDefault();this.session.redo();this.changed();}
      else if(mod&&e.code==='KeyD'){e.preventDefault();this.session.duplicate();this.changed();}
      else if(e.code==='Delete'||e.code==='Backspace'){e.preventDefault();this.session.remove();this.changed();}
      else if(e.code==='Space'){e.preventDefault();this.spacePan=true;}
      else if(e.code.startsWith('Arrow')){e.preventDefault();if(this.session.selection)this.nudge(e.code.slice(5).toLowerCase(),e.shiftKey);else{const d=this.camera.viewH*.08;this.camera.x+=(e.code==='ArrowRight'?d:e.code==='ArrowLeft'?-d:0);this.camera.y+=(e.code==='ArrowUp'?d:e.code==='ArrowDown'?-d:0);}}
      else if(e.code==='Escape'){this.select(null);this.canvas.focus();}
    }catch(err){this.notice(err.message,true);}
  }
  hit(point){
    const L=this.session.level,candidates=[];
    for(const list of [...LISTS,'spawn'])for(const [index,p]of (list==='spawn'?[L.spawn]:L[list]).entries()){
      const a=this.toScreen(p.x,hoverHeight(p)),width=(p.w||0)*this.dimensions().h/this.camera.viewH;
      let distance;
      if(list==='platforms'||list==='hazards')distance=Math.hypot(Math.max(a.x-point.x,0,point.x-a.x-width),Math.abs(point.y-a.y));
      else if(list==='winds'){const b=this.toScreen(p.x+p.w,p.y+p.h);distance=Math.min(Math.hypot(Math.max(a.x-point.x,0,point.x-b.x),Math.abs(point.y-a.y)),Math.hypot(Math.abs(point.x-a.x),Math.max(b.y-point.y,0,point.y-a.y)));}
      else distance=Math.hypot(point.x-a.x,point.y-(a.y-(list==='enemies'&&!airborne(p)?16:0)));
      if(distance<24)candidates.push({list,index,distance:distance+(list==='platforms'?3:0)});
    }
    candidates.sort((a,b)=>a.distance-b.distance);return candidates[0]?{list:candidates[0].list,index:candidates[0].index}:null;
  }
  pointerDown(e){
    if(!this.active||e.button>0)return;e.preventDefault();this.canvas.setPointerCapture(e.pointerId);const point=this.point(e);this.pointers.set(e.pointerId,point);this.canvas.focus({preventScroll:true});
    if(this.pointers.size===2){this.session.cancel();this.preview(true);const [a,b]=[...this.pointers.values()];this.gesture={type:'pinch',distance:Math.hypot(a.x-b.x,a.y-b.y),viewH:this.camera.viewH,anchor:this.toWorld({x:(a.x+b.x)/2,y:(a.y+b.y)/2})};return;}
    if(this.pointers.size>2)return;
    const p=selectedObject(this.session.level,this.session.selection);
    let handle=null;
    if(this.mode==='select'&&!this.spacePan&&p?.w&&this.session.selection.list!=='crushers')for(const side of ['left','right']){const h=this.toScreen(p.x+(side==='right'?p.w:0),p.y);if(Math.hypot(point.x-h.x,point.y-h.y)<23)handle=side;}
    const hit=this.mode==='select'&&!this.spacePan?this.hit(point):null;
    if(handle||hit){if(!handle)this.select(hit);this.session.startChange();this.gesture={type:handle?'resize':'move',handle,start:point,world:this.toWorld(point)};}
    else this.gesture={type:'pan',start:point,camera:{...this.camera}};
  }
  pointerMove(e){
    if(!this.pointers.has(e.pointerId))return;e.preventDefault();const point=this.point(e);this.pointers.set(e.pointerId,point);const g=this.gesture;if(!g)return;
    if(g.type==='pinch'){
      if(this.pointers.size<2)return;const [a,b]=[...this.pointers.values()],{w,h}=this.dimensions(),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};this.camera.viewH=clamp(g.viewH*g.distance/Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),7,65);const u=this.camera.viewH/h;this.camera.x=g.anchor.x-(mid.x-w/2)*u;this.camera.y=g.anchor.y+(mid.y-h/2)*u;return;
    }
    if(g.type==='pan'){const u=this.camera.viewH/this.dimensions().h;this.camera.x=clamp(g.camera.x-(point.x-g.start.x)*u,-80,2030);this.camera.y=clamp(g.camera.y+(point.y-g.start.y)*u,-35,170);return;}
    if(!g.moved&&Math.hypot(point.x-g.start.x,point.y-g.start.y)<4)return;g.moved=true;
    const at=this.toWorld(point),before=selectedObject(this.session.pending.level,this.session.selection),dx=this.round(before.x+at.x-g.world.x)-before.x,dy=this.round(before.y+at.y-g.world.y)-before.y;
    if(g.type==='move')this.session.move(dx,dy,this.carry);
    else{this.session.level=clone(this.session.pending.level);const obj=selectedObject(this.session.level,this.session.selection),min=obj.goal?2.5:.6;if(g.handle==='right')obj.w=clamp(this.round(before.w+at.x-g.world.x),min,80);else{obj.w=clamp(this.round(before.w-dx),min,80);obj.x=before.x+before.w-obj.w;}repairDraft(this.session.level);}
    this.preview();
  }
  pointerUp(e,cancel=false){
    if(!this.pointers.has(e.pointerId))return;this.pointers.delete(e.pointerId);
    if(this.session.pending){try{if(cancel)this.session.cancel();else this.session.commit();}catch(err){this.notice(err.message,true);}this.changed();}
    this.gesture=null;
  }
  cancelGesture(){if(!this.session)return;if(this.session.pending){this.session.cancel();if(this.active)this.preview(true);}this.pointers.clear();this.gesture=null;}
  draw(){
    if(!this.active)return;const {w,h}=this.dimensions(),dpr=Math.min(devicePixelRatio||1,1.5);this.size={w,h};
    if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.mapDirty=true;}
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const units=h/this.camera.viewH,left=this.camera.x-w/units/2,right=this.camera.x+w/units/2,bottom=this.camera.y-this.camera.viewH/2,top=this.camera.y+this.camera.viewH/2,grid=units>28?1:2;
    ctx.lineWidth=1;ctx.strokeStyle='#fff5d713';ctx.beginPath();for(let x=Math.ceil(left/grid)*grid;x<=right;x+=grid){const a=this.toScreen(x,0);ctx.moveTo(a.x,0);ctx.lineTo(a.x,h);}for(let y=Math.ceil(bottom/grid)*grid;y<=top;y+=grid){const a=this.toScreen(0,y);ctx.moveTo(0,a.y);ctx.lineTo(w,a.y);}ctx.stroke();
    const L=this.session.level;
    for(const list of LISTS)for(const [index,p]of L[list].entries()){
      const a=this.toScreen(p.x,hoverHeight(p));if(a.x+(p.w||1)*units<0||a.x>w||a.y<-150||a.y>h+150)continue;
      const selected=this.session.selection?.list===list&&this.session.selection.index===index;ctx.strokeStyle=selected?'#ffe9a6':list==='hazards'||list==='crushers'?'#fa957c99':list==='winds'?'#a0ede887':'#fff7df5a';ctx.lineWidth=selected?2.5:1;
      if(p.w&&list!=='crushers'){
        const height=list==='winds'?p.h*units:list==='hazards'?-.8*units:.3*units,ay=list==='winds'?a.y-height:a.y;ctx.strokeRect(a.x,ay,p.w*units,Math.abs(height));
        if(selected){ctx.fillStyle='#ffe9a613';ctx.fillRect(a.x,ay,p.w*units,Math.abs(height));for(const x of [a.x,a.x+p.w*units]){ctx.beginPath();ctx.arc(x,a.y,8,0,Math.PI*2);ctx.fillStyle='#fff0be';ctx.fill();ctx.strokeStyle='#3e4c4e';ctx.stroke();}}
      }else{ctx.beginPath();ctx.arc(a.x,a.y-(list==='enemies'&&!airborne(p)?16:0),selected?15:9,0,Math.PI*2);ctx.stroke();}
    }
    const spawn=this.toScreen(L.spawn.x,L.spawn.y);ctx.strokeStyle='#a1efe8';ctx.lineWidth=2;ctx.strokeRect(spawn.x-10,spawn.y-38,20,38);ctx.fillStyle='#b8f6ed';ctx.font='bold 11px Arial';ctx.fillText('START',spawn.x-17,spawn.y-45);
    const selected=selectedObject(L,this.session.selection);
    if(selected){
      const a=this.toScreen(selected.x+(selected.w||0)/2,selected.y);ctx.font='bold 12px Arial';const text=`${objectLabel(selected,this.session.selection.list)} · ${selected.x.toFixed(2)}, ${selected.y.toFixed(2)}`,tw=ctx.measureText(text).width;ctx.fillStyle='#193c47ed';ctx.fillRect(a.x-tw/2-9,a.y-42,tw+18,24);ctx.fillStyle='#fff2d7';ctx.fillText(text,a.x-tw/2,a.y-26);
      if(selected.kind==='drifter'){const a=this.toScreen(selected.min-DRIFTER.radius,selected.y+DRIFTER.halfHeight+(selected.bob??DRIFTER.bob)),b=this.toScreen(selected.max+DRIFTER.radius,selected.y-DRIFTER.halfHeight-(selected.bob??DRIFTER.bob));ctx.setLineDash([6,6]);ctx.strokeStyle='#ffdb83';ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.setLineDash([]);}
      if(selected.kind==='bat'){const bounds=batPatrolBounds(selected,L.platforms),a=this.toScreen(bounds.min-BAT.bodyRadius,selected.y+BAT.modelOffsetY+(selected.bob??BAT.bob)),b=this.toScreen(bounds.max+BAT.bodyRadius,selected.y+BAT.modelOffsetY-(selected.bob??BAT.bob));ctx.setLineDash([6,6]);ctx.strokeStyle='#ffdb83';ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.setLineDash([]);}
      if(selected.kind==='lift'){ctx.setLineDash([6,6]);ctx.strokeStyle='#ffdb83';ctx.beginPath();for(const sign of [-1,1]){const p=this.toScreen(selected.x+selected.w/2+sign*(selected.moveX||0),selected.y+sign*(selected.moveY||0));if(sign===-1)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.setLineDash([]);}
      if(selected.min!==undefined){ctx.strokeStyle='#ffdb83';ctx.beginPath();const l=this.toScreen(selected.min,selected.y+.8),r=this.toScreen(selected.max,selected.y+.8);ctx.moveTo(l.x,l.y);ctx.lineTo(r.x,r.y);ctx.stroke();}
    }
    if(!this.gesture||this.gesture.type==='pan')for(const path of this.trace){ctx.setLineDash([4,5]);ctx.strokeStyle='#abf4e7';ctx.lineWidth=2;ctx.beginPath();path.forEach((p,i)=>{const a=this.toScreen(p.x,p.y+.06);if(i)ctx.lineTo(a.x,a.y);else ctx.moveTo(a.x,a.y);});ctx.stroke();ctx.setLineDash([]);}
    this.drawMap();
  }
  drawMap(){
    const r=this.map.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(devicePixelRatio||1,1.5);if(this.map.width!==Math.round(r.width*dpr)||this.map.height!==Math.round(r.height*dpr)){this.map.width=Math.round(r.width*dpr);this.map.height=Math.round(r.height*dpr);}
    const c=this.mapCtx;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,r.width,r.height);const L=this.session.level,min=Math.min(-8,...L.platforms.map(p=>p.x)),max=Math.max(L.end+8,...L.platforms.map(p=>p.x+p.w)),lo=Math.min(-2,...L.platforms.map(p=>p.y)),hi=Math.max(6,...L.platforms.map(p=>p.y+2));this.mapBounds={min,max};const x=n=>(n-min)/(max-min)*r.width,y=n=>r.height-5-(n-lo)/(hi-lo)*(r.height-10);
    c.strokeStyle='#efd6a7b3';c.lineWidth=2;for(const p of L.platforms){c.beginPath();c.moveTo(x(p.x),y(p.y));c.lineTo(x(p.x+p.w),y(p.y));c.stroke();}const span=this.camera.viewH*this.size.w/this.size.h;c.fillStyle='#a9efe724';c.fillRect(x(this.camera.x-span/2),0,span/(max-min)*r.width,r.height);c.strokeStyle='#b7f6e6';c.strokeRect(x(this.camera.x-span/2),1,span/(max-min)*r.width,r.height-2);
  }
}
