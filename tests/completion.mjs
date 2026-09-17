import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {completionMarkup,completionRecord} from '../dist/completion.js';
import {LEVELS} from '../dist/levels.js';
const run={index:0,coins:24,stamps:2,time:108,deaths:0},L=LEVELS[0];
let r=completionRecord(run,L,null);
assert.equal(r.result.newBest,true);assert.equal(r.result.previousBest,null);
assert.equal(r.best.time,108);
r=completionRecord({...run,time:110,coins:20,stamps:3},L,r.best);
assert.equal(r.result.newBest,false);assert.equal(r.result.coins,20);assert.equal(r.best.coins,24);assert.equal(r.best.stamps,3);assert.equal(r.best.time,108);
assert.equal(completionRecord(run,L,r.best).result.newBest,false,'An equal time is not a new record');
assert.equal(completionRecord({...run,time:107.5},L,r.best).result.newBest,true);
const obsolete={version:2,time:40,coins:1000,stamps:20};
r=completionRecord(run,L,obsolete);assert.equal(r.result.newBest,true);assert.equal(r.best.coins,24);assert.deepEqual(r.previous,obsolete);
for(let i=0;i<LEVELS.length;i++){
 const result=completionRecord({...run,index:i},LEVELS[i],null).result;
 const html=completionMarkup(result,LEVELS[i],LEVELS.length);
 assert.equal((html.match(/<button /g)||[]).length,3);
 assert(html.includes('id="dialog-title"'));assert(html.includes('1:48'));assert(html.includes(` / ${LEVELS[i].coins.length}`));
 assert(html.includes('New best!'));assert(html.includes('Chapters'));
 assert.equal(html.includes('data-action="next"'),i<LEVELS.length-1);
 for(const [,src]of html.matchAll(/src="([^"]+)"/g))await access(new URL('../dist/'+src,import.meta.url));
}
// While the dream is hidden the Hanging Quarter is the last chapter shown, and
// its completion offers no next chapter.
assert(!completionMarkup(completionRecord({...run,index:3},LEVELS[3],null).result,LEVELS[3],4).includes('data-action="next"'));
const old=completionRecord({...run,time:130},L,{version:L.layoutVersion,time:108}).result;
const html=completionMarkup(old,L,LEVELS.length);assert(!html.includes('New best!'));assert(html.includes('Best 1:48'));assert(html.includes('2:10'));
console.log('PASS completion results, record timing, old-layout isolation, all five scenes and chapter actions');
