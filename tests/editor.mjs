import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEVELS} from '../dist/levels.js';
import {Game,FIXED_DT} from '../dist/simulation.js';
import {DraftLibrary,DraftSession,validateDraft,selectedObject,DRAFT_KEY,KINDS,LISTS,BACKDROP} from '../dist/editor-model.js';
import {DECOR_KINDS,DECOR_LIMIT,decorPalette,BACKDROP_BOUNDS,BACKDROP_LIMIT,BACKDROP_DEFAULT,backdropWorldX,LANDMARKS,landmarkAuthority,landmarkChoices,landmarkLabel,CAVE_STORY_ROLES} from '../dist/decor-kinds.js';
import {jumpGuide} from '../dist/editor.js';
const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const base=JSON.stringify(LEVELS),library=new DraftLibrary(LEVELS,storage);
// The incognito export is the source of truth, including deliberate deletions.
{
 const canonical=validateDraft(LEVELS[0],LEVELS[0]);
 assert.equal(LEVELS[0].layoutVersion,11);assert(!LEVELS[0].custom);
 assert.equal(canonical.layoutVersion,'editor-11-15255ug','canonical canyon matches the approved editor export');
 // The pocket's formable mass survives the round trip as data: its rule, its
 // clump and its solution, bounded, and no other rule is ever let in.
 const pocket=canonical.shaping.find(s=>s.id==='canyon-pocket'),authored=LEVELS[0].shaping.find(s=>s.id==='canyon-pocket');
 for(const key of ['rule','free','relax','shaped','cueX','gesture','clump','solution'])assert.deepEqual(pocket[key],authored[key],`the canonical canyon keeps its formable mass's ${key}`);
 for(const bad of [{rule:'sag'},{gesture:'sideways'},{clump:[[2,0]]},{clump:[]},{solution:[{x:130,lift:0,dx:0,dy:0,t:0}]},{shaped:0},{solution:Array.from({length:41},()=>({x:130,lift:0,dx:1,dy:1,t:1}))}]){
  const draft=structuredClone(LEVELS[0]);Object.assign(draft.shaping.find(s=>s.id==='canyon-pocket'),bad);
  assert.throws(()=>validateDraft(draft,LEVELS[0]),`a station with ${JSON.stringify(bad)} is refused`);
 }
}
{
 const exported=JSON.parse(readFileSync(new URL('../docs/forest-canopy-canon/editor-backup.json',import.meta.url),'utf8'));
 const beforeBoss=structuredClone(LEVELS[1]);delete beforeBoss.boss;
 beforeBoss.platforms=beforeBoss.platforms.filter(p=>!['mother-arena','mother-bell'].includes(p.id));
 const oldBell=beforeBoss.platforms.find(p=>p.id==='heart-bell');delete oldBell.checkpoint;Object.assign(oldBell,{goal:true,bellX:6.5,landmark:'bellgate'});
 const canonical=validateDraft(beforeBoss,LEVELS[1]),draft=validateDraft(exported.level,LEVELS[1]);
 assert.equal(LEVELS[1].layoutVersion,10);assert(!LEVELS[1].custom);assert(!draft.boss,'old forest imports keep their original finish');
 for(const key of ['spawn',...LISTS])assert.deepEqual(canonical[key],draft[key],`canonical forest ${key} matches the approved export`);
}
{
 const exported=JSON.parse(readFileSync(new URL('../docs/cave-layout-canon/editor-backup.json',import.meta.url),'utf8'));
 const canonical=validateDraft(LEVELS[2],LEVELS[2]),draft=validateDraft(exported.level,LEVELS[2]);
 assert.equal(LEVELS[2].layoutVersion,10);assert(!LEVELS[2].custom);
 for(const key of ['spawn',...LISTS])assert.deepEqual(canonical[key],draft[key],`canonical cave ${key} matches the recovered export`);
}
{
 const exported=JSON.parse(readFileSync(new URL('../docs/city-layout-canon/editor-backup.json',import.meta.url),'utf8'));
 const canonical=validateDraft(LEVELS[3],LEVELS[3]),draft=validateDraft(exported.level,LEVELS[3]);
 assert.equal(LEVELS[3].layoutVersion,6);assert(!LEVELS[3].custom);
 for(const key of ['spawn',...LISTS])assert.deepEqual(canonical[key],draft[key],`canonical city ${key} matches the approved export`);
}
for(let index=0;index<LEVELS.length;index++){
 const normalized=validateDraft(LEVELS[index],LEVELS[index]);
 assert.equal(normalized.platforms.length,LEVELS[index].platforms.length);assert.equal(normalized.winds.filter(w=>w.spores).length,LEVELS[index].winds.filter(w=>w.spores).length);
 assert.deepEqual(normalized.circuits,LEVELS[index].circuits);
 const roundtrip=library.read(library.export(index,normalized),index);assert.deepEqual(roundtrip,normalized);
 const s=new DraftSession(library,index);s.selection={list:'platforms',index:0};
 // A chapter may start on a plateau rather than at ground level, so every
 // height here is read against the deck the draft actually opens on.
 const base=LEVELS[index].platforms[0].y,lifted=base+1;
 s.startChange();s.move(2,1,true);s.commit();assert.equal(s.level.spawn.x,LEVELS[index].spawn.x+2);assert.equal(s.level.spawn.y,lifted);
 assert.equal(s.level.platforms[0].x,LEVELS[index].platforms[0].x+2);assert(s.level.custom);
 const revised=s.level.layoutVersion;s.undo();assert.equal(s.level.spawn.y,base);s.redo();assert.equal(s.level.layoutVersion,revised);
 const reopened=new DraftLibrary(LEVELS,storage);assert.equal(reopened.get(index).spawn.y,lifted);
 const game=new Game();game.start(index,reopened.get(index));assert.equal(game.player.groundId,'start');assert.equal(game.player.y,lifted);
 game.tick(FIXED_DT,{jumpPressed:true,jumpHeld:true});assert(game.player.vy>0);assert(game.player.y>lifted);assert.equal(reopened.get(index).platforms[0].y,lifted,'runtime never mutates saved draft');
}
console.log('PASS a draft of every chapter: normalization, connections, persistence, carry contents, undo/redo, and real runtime loading');
{
 const s=new DraftSession(library,0),index=s.level.platforms.findIndex(p=>p.goal),oldEnd=s.level.end;s.selection={list:'platforms',index};s.startChange();s.move(3,2);s.commit();assert.equal(s.level.end,oldEnd+3);
 assert.throws(()=>s.remove(),/finish/);s.set('w',8);assert(s.level.end<s.level.platforms[index].x+8);s.undo();
 s.selection={list:'platforms',index:0};assert.throws(()=>s.remove(),/starting/);
 const original=structuredClone(s.level);s.startChange();s.move(5,3);s.cancel();assert.deepEqual(s.level,original);
 assert.throws(()=>s.set('w',NaN),/width|w/);assert.deepEqual(s.level,original);
}
console.log('PASS finish follows its platform, protected anchors, cancel and invalid-field rollback');
{
 const s=new DraftSession(library,2);
 s.add('switch',12,0);s.set('channel','workshop');const switchId=selectedObject(s.level,s.selection).id;
 s.add('timed',18,1);s.set('channel','workshop');const target=selectedObject(s.level,s.selection).id;
 assert(s.level.circuits.some(c=>c.source===switchId&&c.channel==='workshop'&&c.targets.includes(target)));
 const game=new Game();game.start(2,s.level);const sw=game.level.platforms.find(p=>p.id===switchId);Object.assign(game.player,{x:sw.x+.9,y:sw.y,groundId:sw.id});game.tick(FIXED_DT,{});game.tick(FIXED_DT,{});
 assert(game.channels.workshop>0);assert.equal(game.level.platforms.find(p=>p.id===target).active,true);
 s.selection={list:'platforms',index:s.level.platforms.findIndex(p=>p.id===switchId)};s.remove();assert(!s.level.circuits.some(c=>c.source===switchId));
 s.selection={list:'platforms',index:s.level.platforms.findIndex(p=>p.id===target)};s.duplicate();const duplicate=selectedObject(s.level,s.selection);assert.notEqual(duplicate.id,target);s.remove();
 for(const kind of Object.keys(KINDS)){s.add(kind,30,4);const g=new Game();g.start(2,s.level);for(let n=0;n<3;n++)g.tick(FIXED_DT,{});assert(Number.isFinite(g.player.x));}
 for(const type of ['coins','stamps','hazards','enemies','winds','crushers']){s.add(type,20,4);assert(selectedObject(s.level,s.selection));s.remove();}
}
console.log('PASS new mechanics, circuit wiring, deletion repair, unique duplicates, and all palette types');
{
 const source=structuredClone(library.get(0)),snapshot=JSON.stringify(source),p=source.platforms[0];
 const right=jumpGuide(source,0,p,1),left=jumpGuide(source,0,p,-1);assert(right.length>5);assert(left.length>5);assert(Math.max(...right.map(p=>p.y))>p.y+2);assert(right.at(-1).x>right[0].x);assert.equal(JSON.stringify(source),snapshot);
 assert.throws(()=>library.read(library.export(0),1),/matching chapter/);
 assert.throws(()=>library.read('{"format":"wrong"}',0),/matching/);
 const bad=JSON.parse(library.export(0));bad.level.platforms[0].w=-1;assert.throws(()=>library.read(JSON.stringify(bad),0),/between/);
 bad.level.platforms[0].w=10;bad.level.platforms[1].id='start';assert.throws(()=>library.read(JSON.stringify(bad),0),/Duplicate/);
 const restricted=new DraftLibrary(LEVELS,{getItem:()=>null,setItem(){throw new Error('Quota');}});restricted.save(0,source);assert(restricted.error.includes('Export'));assert(restricted.has(0));assert(restricted.export(0).includes('claybound-level'));
 const oldStorage={getItem:()=>JSON.stringify({0:{baseVersion:1,level:source}})};assert(!new DraftLibrary(LEVELS,oldStorage).has(0));
 library.reset(0);assert(!library.has(0));assert.equal(library.get(0).layoutVersion,LEVELS[0].layoutVersion);assert(JSON.parse(memory.get(DRAFT_KEY)));
}
console.log('PASS physics jump guides, import boundaries, quota fallback, old-layout rejection and original restoration');
// Decoration is edited like everything else and played like nothing at all.
{
 const canonical=validateDraft(LEVELS[0],LEVELS[0]).layoutVersion,s=new DraftSession(library,0),start=LEVELS[0].platforms[0];
 assert.deepEqual(s.level.decor,[],'a chapter with no decoration starts with an empty list, not a missing one');
 for(const kind of Object.keys(DECOR_KINDS)){
  s.add(`decor:${kind}`,60,9);const prop=selectedObject(s.level,s.selection);
  assert.equal(prop.kind,kind);assert.equal(prop.size,DECOR_KINDS[kind].size);assert.equal(prop.z,DECOR_KINDS[kind].z);
  s.remove();
 }
 assert.equal(s.level.layoutVersion,canonical,'placing and clearing decoration leaves the layout version alone');
 assert.throws(()=>s.add('decor:a-shape-the-game-cannot-build',5,0),/palette/);
 for(const biome of ['desert','forest','cave','citadel'])assert(decorPalette(biome).length>=12,`${biome} offers a palette`);
 // A prop standing on a platform travels with it, like a bead or a switch.
 s.add('decor:boulder',start.x+2,start.y);const at=s.level.decor.length-1;
 s.selection={list:'platforms',index:0};s.startChange();s.move(4,2,true);s.commit();
 assert.equal(s.level.decor[at].x,start.x+6);assert.equal(s.level.decor[at].y,start.y+2);
 assert.notEqual(s.level.layoutVersion,canonical,'moved decoration revises the layout version');
 // Nothing about it reaches the simulation: no collider, no collectible, no id.
 const game=new Game();game.start(0,library.get(0));
 assert.equal(game.level.decor.length,1);
 assert.deepEqual(game.level.platforms.map(p=>p.id),LEVELS[0].platforms.map(p=>p.id));
 assert.equal(game.level.coins.length,LEVELS[0].coins.length);assert.equal(game.level.hazards.length,LEVELS[0].hazards.length);
 for(let n=0;n<40;n++)game.tick(FIXED_DT,{moveAxis:1});
 assert(Number.isFinite(game.player.x));assert(!game.respawnTimer,'walking through a prop is walking through nothing');
 assert.deepEqual(library.read(library.export(0,s.level),0).decor,s.level.decor);
 s.undo();assert.equal(s.level.decor[at].x,start.x+2);s.redo();assert.equal(s.level.decor[at].x,start.x+6);
 const legacy=JSON.parse(library.export(0,s.level));delete legacy.level.decor;
 assert.deepEqual(library.read(JSON.stringify(legacy),0).decor,[],'a backup written before this list existed still imports');
 for(const bad of [{kind:'unknown-prop'},{kind:'boulder',size:900},{kind:'boulder',z:40},{kind:'boulder',turn:900},{kind:'boulder',lean:400},{size:2}]){
  const file=JSON.parse(library.export(0,s.level));file.level.decor=[{x:10,y:2,...bad}];
  assert.throws(()=>library.read(JSON.stringify(file),0),/decor|Decoration/);
 }
 const over=JSON.parse(library.export(0,s.level));over.level.decor=Array.from({length:DECOR_LIMIT+1},()=>({kind:'boulder',x:5,y:1}));
 assert.throws(()=>library.read(JSON.stringify(over),0),/maximum/);
 library.reset(0);
}
// The horizon is the same bargain as decoration, one number further out.
{
 const canonical=validateDraft(LEVELS[0],LEVELS[0]).layoutVersion,s=new DraftSession(library,0);
 assert.deepEqual(s.level[BACKDROP],[],'a chapter with no authored horizon gets an empty list, not a missing one');
 s.add('backdrop:canyon-arch',180,-4);
 const piece=selectedObject(s.level,s.selection);
 assert.equal(s.selection.list,BACKDROP,"the palette's horizon half adds to the horizon");
 assert.equal(piece.kind,'canyon-arch');assert.equal(piece.z,BACKDROP_DEFAULT.z);assert.equal(piece.factor,BACKDROP_DEFAULT.factor);
 assert.equal(piece.size,DECOR_KINDS['canyon-arch'].size);
 assert.notEqual(s.level.layoutVersion,canonical,'an authored horizon is part of the chapter, so it revises the version');
 // Distance belongs to the layer, so swapping the shape keeps it.
 s.startChange();s.set('factor',.18);s.commit();
 s.startChange();s.set('kind','summit');s.commit();
 assert.equal(s.level[BACKDROP][0].factor,.18,'a distance the author set survives a change of shape');
 assert.equal(s.level[BACKDROP][0].size,DECOR_KINDS.summit.size,'but an untouched width follows the new shape');
 // Where the editor will draw it, and where the frame will put it, agree.
 assert.equal(backdropWorldX(s.level[BACKDROP][0],s.level[BACKDROP][0].x),s.level[BACKDROP][0].x);
 // It carries nothing into the simulation, and is not a platform's to carry.
 const game=new Game();game.start(0,library.get(0));
 assert.equal(game.level[BACKDROP].length,1);
 assert.deepEqual(game.level.platforms.map(p=>p.id),LEVELS[0].platforms.map(p=>p.id));
 assert.deepEqual(library.read(library.export(0,s.level),0)[BACKDROP],s.level[BACKDROP],'the horizon round-trips through a backup');
 // A backup written before this list existed still imports.
 const legacy=JSON.parse(library.export(0,s.level));delete legacy.level[BACKDROP];
 assert.deepEqual(library.read(JSON.stringify(legacy),0)[BACKDROP],LEVELS[0][BACKDROP]??[],"an older backup keeps the chapter's own horizon");
 for(const bad of [{kind:'unknown-shape'},{kind:'summit',factor:0},{kind:'summit',factor:2},{kind:'summit',z:-90},{kind:'summit',z:4},{kind:'summit',size:900},{size:2}]){
  const file=JSON.parse(library.export(0,s.level));file.level[BACKDROP]=[{x:10,y:2,...bad}];
  assert.throws(()=>library.read(JSON.stringify(file),0),/backdrop|Backdrop/,JSON.stringify(bad));
 }
 const over=JSON.parse(library.export(0,s.level));over.level[BACKDROP]=Array.from({length:BACKDROP_LIMIT+1},()=>({kind:'summit',x:5,y:1}));
 assert.throws(()=>library.read(JSON.stringify(over),0),/maximum/);
 s.remove();assert.equal(s.level[BACKDROP].length,0);
 assert.equal(s.level.layoutVersion,canonical,'placing and clearing a horizon piece leaves the layout version alone');
 library.reset(0);
 console.log('PASS the authored horizon: defaults, distance kept across a shape change, revision, round trip, older backups and refused placements');
}
// The scenery a platform already carries. A landmark is a name on a deck, and
// the workshop must only offer to choose it where the chapter honours the name.
{
 const biomes=['desert','forest','cave','citadel'];
 // Every authored landmark is a shape the catalogue knows, so none of them
 // shows up in the workshop as a bare identifier.
 for(const L of LEVELS)for(const p of L.platforms)if(p.landmark)
  assert(LANDMARKS[p.landmark],`${L.short}: ${p.id} carries ${p.landmark}, which the catalogue names`);
 // Authority mirrors the guards in landmark(): the deck decides in Ember
 // Caverns and at the city laundry, a finish deck builds its own bell instead,
 // and everywhere else the name decides.
 const cave=LEVELS[2],city=LEVELS[3];
 for(const id of Object.keys(CAVE_STORY_ROLES)){
  const p=cave.platforms.find(p=>p.id===id);
  if(p)assert.equal(landmarkAuthority('cave',p),'platform',`${id} is dressed by the deck, not by a name`);
 }
 assert.equal(landmarkAuthority('citadel',city.platforms.find(p=>p.id==='laundry-entry')),'platform');
 for(const id of ['exchange-entry','bell-court'])assert.equal(landmarkAuthority('citadel',city.platforms.find(p=>p.id===id)),'none');
 for(const L of LEVELS)for(const p of L.platforms)if(p.goal&&p.landmark==='bellgate')
  assert.equal(landmarkAuthority(L.biome,p),'none','a finish deck builds its own bell');
 assert.equal(landmarkAuthority('desert',LEVELS[0].platforms[0]),'name');
 // A cottage is only offered where the chapter builds houses, and never on a
 // deck that is already one, because `w.house` would return nothing.
 for(const biome of biomes){
  const choices=landmarkChoices(biome,{}).map(([name])=>name);
  assert(choices.includes('windmill')&&!choices.includes('oasis'),`${biome} offers one name per prop`);
  assert.equal(choices.includes('birdhouse'),['cave','citadel'].includes(biome),`${biome} offers a cottage only if it builds one`);
  assert(!landmarkChoices(biome,{house:true}).some(([name])=>name==='birdhouse'),'never on a deck that is already a house');
 }
 // The same name is labelled as the chapter actually builds it.
 assert.equal(landmarkLabel('arch','desert'),'Camp tent');assert.equal(landmarkLabel('arch','cave'),'Stone arch');
 assert.equal(landmarkLabel('sandwheel','desert'),'Dry sandstone basin');assert.equal(landmarkLabel('rootarch','forest'),'Tree crown');
 // Setting, changing and clearing one is an ordinary edit: it persists, round
 // trips, revises the layout version and undoes.
 const s=new DraftSession(library,0),canonical=validateDraft(LEVELS[0],LEVELS[0]).layoutVersion;
 s.selection={list:'platforms',index:0};
 s.set('landmark','windmill');assert.equal(s.level.platforms[0].landmark,'windmill');
 assert.notEqual(s.level.layoutVersion,canonical,'a landmark is part of the chapter, so it revises the version');
 for(const flag of ['house','arch','entrance','rest'])s.set(flag,true);
 const saved=library.read(library.export(0,s.level),0);
 assert.equal(saved.platforms[0].landmark,'windmill');
 for(const flag of ['house','arch','entrance','rest'])assert.equal(saved.platforms[0][flag],true,`${flag} survives a backup`);
 s.set('landmark',null);assert.equal(s.level.platforms[0].landmark,undefined,'clearing it takes the prop away');
 s.undo();assert.equal(s.level.platforms[0].landmark,'windmill');
 // A name the catalogue does not know is still refused if it is not an id.
 const bad=JSON.parse(library.export(0,s.level));bad.level.platforms[0].landmark='not a name';
 assert.throws(()=>library.read(JSON.stringify(bad),0),/landmark/);
 library.reset(0);
}
assert.equal(JSON.stringify(LEVELS),base,'All original authored levels stay unchanged');
console.log('PASS decoration: every catalogue shape and its defaults, per-biome palettes, carry with platforms, inert in the simulation, round trips, undo/redo, pre-decoration backups and refused placements');
console.log('PASS landmarks: every authored name is catalogued, authority matches the chapters that key scenery off the deck, per-biome labels and cottage limits, and setting/clearing one persists, backs up and undoes');
