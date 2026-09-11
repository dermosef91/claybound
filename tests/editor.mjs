import assert from 'node:assert/strict';
import {LEVELS} from '../dist/levels.js';
import {Game,FIXED_DT} from '../dist/simulation.js';
import {DraftLibrary,DraftSession,validateDraft,selectedObject,DRAFT_KEY,KINDS} from '../dist/editor-model.js';
import {jumpGuide} from '../dist/editor.js';
const memory=new Map(),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const base=JSON.stringify(LEVELS),library=new DraftLibrary(LEVELS,storage);
for(let index=0;index<4;index++){
 const normalized=validateDraft(LEVELS[index],LEVELS[index]);
 assert.equal(normalized.platforms.length,LEVELS[index].platforms.length);assert.equal(normalized.winds.filter(w=>w.spores).length,LEVELS[index].winds.filter(w=>w.spores).length);
 assert.deepEqual(normalized.circuits,LEVELS[index].circuits);
 const roundtrip=library.read(library.export(index,normalized),index);assert.deepEqual(roundtrip,normalized);
 const s=new DraftSession(library,index);s.selection={list:'platforms',index:0};
 s.startChange();s.move(2,1,true);s.commit();assert.equal(s.level.spawn.x,LEVELS[index].spawn.x+2);assert.equal(s.level.spawn.y,1);
 assert.equal(s.level.platforms[0].x,LEVELS[index].platforms[0].x+2);assert(s.level.custom);
 const revised=s.level.layoutVersion;s.undo();assert.equal(s.level.spawn.y,0);s.redo();assert.equal(s.level.layoutVersion,revised);
 const reopened=new DraftLibrary(LEVELS,storage);assert.equal(reopened.get(index).spawn.y,1);
 const game=new Game();game.start(index,reopened.get(index));assert.equal(game.player.groundId,'start');assert.equal(game.player.y,1);
 game.tick(FIXED_DT,{jumpPressed:true,jumpHeld:true});assert(game.player.vy>0);assert(game.player.y>1);assert.equal(reopened.get(index).platforms[0].y,1,'runtime never mutates saved draft');
}
console.log('PASS all four drafts: normalization, connections, persistence, carry contents, undo/redo, and real runtime loading');
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
assert.equal(JSON.stringify(LEVELS),base,'All original authored levels stay unchanged');
console.log('PASS physics jump guides, import boundaries, quota fallback, old-layout rejection and original restoration');
