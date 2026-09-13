import assert from 'node:assert/strict';
import {LEVELS} from '../dist/levels.js';
import {chapterCollections,collectiblesMarkup} from '../dist/title-menu.js';

const level=LEVELS[0];
const saved={best:{0:{version:level.layoutVersion,stamps:2,coins:6}},runs:{0:{version:level.layoutVersion,stamps:[0,0,999],coins:[0,1,2,3,4,5,6,7]}},customBest:{},customRuns:{}};
assert.deepEqual(chapterCollections(level,0,saved),{stamps:2,coins:8,stampTotal:3,coinTotal:level.coins.length});
saved.best[0].version='older-layout';assert.equal(chapterCollections(level,0,saved).stamps,1);
saved.runs[0].version='older-layout';assert.equal(chapterCollections(level,0,saved).stamps,0);
saved.customBest[0]={version:level.layoutVersion,stamps:3,coins:100000};
const custom={...level,custom:true};assert.equal(chapterCollections(custom,0,saved).stamps,3);assert.equal(chapterCollections(custom,0,saved).coins,level.coins.length);
assert.equal(chapterCollections(level,0,saved).stamps,0,'Edited designs must not change original totals');
assert(collectiblesMarkup(LEVELS,{}).includes('0 / 13 secret flowers'));
assert.equal((collectiblesMarkup(LEVELS,{}).match(/class="collection-chapter"/g)||[]).length,4);
console.log('PASS title collectibles: checkpoint IDs, no duplicate finds, best/checkpoint overlap, old-layout exclusion and edited score isolation');
