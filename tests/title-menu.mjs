import assert from 'node:assert/strict';
import {LEVELS} from '../dist/levels.js';
import {chapterCollections,settingsMarkup} from '../dist/title-menu.js';
import {CHARACTERS} from '../dist/characters.js';

const level=LEVELS[0];
const saved={best:{0:{version:level.layoutVersion,stamps:2,coins:6}},runs:{0:{version:level.layoutVersion,stamps:[0,0,999],coins:[0,1,2,3,4,5,6,7]}},customBest:{},customRuns:{}};
assert.deepEqual(chapterCollections(level,0,saved),{stamps:2,coins:8,stampTotal:4,coinTotal:level.coins.length});
saved.best[0].version='older-layout';assert.equal(chapterCollections(level,0,saved).stamps,1);
saved.runs[0].version='older-layout';assert.equal(chapterCollections(level,0,saved).stamps,0);
saved.customBest[0]={version:level.layoutVersion,stamps:3,coins:100000};
const custom={...level,custom:true};assert.equal(chapterCollections(custom,0,saved).stamps,3);assert.equal(chapterCollections(custom,0,saved).coins,level.coins.length);
assert.equal(chapterCollections(level,0,saved).stamps,0,'Edited designs must not change original totals');
console.log('PASS title collectibles: checkpoint IDs, no duplicate finds, best/checkpoint overlap, old-layout exclusion and edited score isolation');

// The character picker is a radio group: exactly one option is checked, every
// option carries the id the click handler reads back, and a lone character
// leaves the panel as it was.
assert(!settingsMarkup(true,false,{characters:CHARACTERS,character:'clay'}).includes('title-characters'),
  'the cast stays out of sight until it is unlocked');
const settings=settingsMarkup(true,false,{characters:CHARACTERS,character:'emberleaf',charactersUnlocked:true});
for(const choice of CHARACTERS){
  assert(settings.includes(`data-character="${choice.id}"`),`${choice.id} is offered`);
  assert(settings.includes(choice.name)&&settings.includes(choice.note));
}
const rows=settings.match(/<button class="title-character"[\s\S]*?<\/button>/g);
assert.equal(rows.length,CHARACTERS.length);
const worn=rows.filter(row=>row.includes('aria-checked="true"'));
assert.equal(worn.length,1,'one character is worn at a time');
assert(worn[0].includes('data-character="emberleaf"'),'the saved character is the checked one');
assert(worn[0].includes('data-lucide="check"'),'and the only one showing a tick');
assert(settings.includes('role="radiogroup"'));
assert(!settingsMarkup(true,false,{characters:[CHARACTERS[0]],character:'clay',charactersUnlocked:true}).includes('title-characters'),
  'a single character offers no choice to make');
assert(!settingsMarkup(true,false).includes('title-characters'));
console.log('PASS settings character picker: hidden until unlocked, every option present, exactly one checked, absent when there is nothing to choose');

// Stop motion is a switch beside Rumble, off unless the player turned it on.
for(const stopMotion of [false,true]){
  const markup=settingsMarkup(true,false,{stopMotion}),row=markup.match(/<button class="title-setting" data-action="settings-stopmotion"[\s\S]*?<\/button>/)?.[0];
  assert(row,'the panel offers stop motion');
  assert(row.includes('role="switch"')&&row.includes(`aria-checked="${stopMotion}"`),'as a switch showing the saved state');
  assert(row.includes(stopMotion?'<strong>On</strong>':'<strong>Off</strong>'));
  assert(row.includes('data-lucide="camera"'),'with a glyph from the committed subset');
}
assert(settingsMarkup(true,false).includes('data-action="settings-stopmotion" role="switch" aria-checked="false"'),'off by default');
console.log('PASS settings stop motion: a switch beside rumble, off until chosen, showing the saved state');
