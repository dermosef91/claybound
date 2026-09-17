#!/usr/bin/env node
// Run the checks across the machine's cores instead of one after another.
//
// The files are found by looking in tests/ rather than read from a list. The
// list this replaces was a single 44-command shell line in package.json, and
// it had already drifted: three test files existed that it never ran, while
// other branches had quietly added their own entries to their own copies.
// Anything dropped into tests/ now runs, and the only names written down here
// are the handful that are not checks at all or that need a node flag.
//
//   node scripts/check.mjs              every check, recorded routes replayed
//   node scripts/check.mjs --fast       skips the slowest few
//   node scripts/check.mjs --full       searches routes from scratch
//   node scripts/check.mjs camera clay  only files whose name contains these
//
// JOBS caps the workers. It is worth setting when several checkouts are being
// checked at once, since each run otherwise sizes itself to the whole machine
// and they end up fighting over it.
import {spawn} from 'node:child_process';
import {readdir, stat} from 'node:fs/promises';
import {availableParallelism} from 'node:os';

const TESTS=new URL('../tests/',import.meta.url);
// Shared rigs and fixtures that tests import; they are not checks themselves.
const SUPPORT=[/^load-/,/-pilot\.mjs$/,/-fixture\.mjs$/,/^gamepad-imports\.mjs$/];
// Reports rather than asserts, and has its own entry point, `npm run perf`.
// perf-squash.mjs is not here: it reports timings too, but its mesh and
// triangle counts are asserted gates, so it belongs in the checks.
const ELSEWHERE=new Set(['perf.mjs']);
const FLAGS={'editor-ui.mjs':['--experimental-vm-modules'],'perf-squash.mjs':['--expose-gc']};
// Left out of --fast. These are the ones worth the wait before a merge but not
// after every edit: the scene files, which each parse every supplied model,
// and the two that sweep the real physics. Keeping the rule here, next to the
// runner, means the tiering is one line to revisit rather than three
// package.json entries.
const slow=n=>n.startsWith('scene')||n==='characters.mjs'||n==='clay-sections.mjs';

const argv=process.argv.slice(2);
const fast=argv.includes('--fast'),full=argv.includes('--full');
const filters=argv.filter(a=>!a.startsWith('--'));

const names=(await readdir(TESTS)).filter(n=>n.endsWith('.mjs')
  &&!SUPPORT.some(p=>p.test(n))&&!ELSEWHERE.has(n)
  &&!(fast&&slow(n))
  &&(!filters.length||filters.some(f=>n.includes(f))));
if(!names.length){console.error('no checks matched');process.exit(1);}

// Wall time is held up by whichever file is still going when the rest have
// finished, so the long ones start first. Size stands in for cost among the
// others; it is a guess, but a wrong guess only costs a little scheduling.
const sized=await Promise.all(names.map(async n=>({n,bytes:(await stat(new URL(n,TESTS))).size})));
sized.sort((a,b)=>(slow(b.n)-slow(a.n))||b.bytes-a.bytes);

// Two cores short of the machine rather than all of it. The run finishes when
// its slowest worker does, and the last couple of workers land on whatever is
// left over — slow cores on a big-little machine, or a core the editor and
// another agent's run are already on — so a check that would take eight
// seconds takes thirty and holds up the rest. Measured here, eight workers
// finish a whole run in 23s where ten take 28s.
const jobs=Math.max(1,Math.min(+process.env.JOBS||availableParallelism()-2,sized.length));
const env={...process.env,...(full?{SEARCH:'1'}:{})};
const results=[],started=Date.now();
let next=0,failed=0;

const run=name=>new Promise(resolve=>{
  const began=Date.now();
  const child=spawn(process.execPath,[...(FLAGS[name]||[]),new URL(name,TESTS).pathname],{env,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',d=>output+=d);
  child.stderr.on('data',d=>output+=d);
  child.on('close',code=>{
    const seconds=(Date.now()-began)/1000;
    results.push({name,seconds,code});
    if(code){
      failed++;
      process.stdout.write(`\nFAIL  ${seconds.toFixed(1)}s  tests/${name}\n${output.trimEnd()}\n\n`);
    }else process.stdout.write(`  ok  ${seconds.toFixed(1).padStart(5)}s  tests/${name}\n`);
    resolve();
  });
});

const worker=async()=>{while(next<sized.length)await run(sized[next++].n);};
await Promise.all(Array.from({length:jobs},worker));

const wall=(Date.now()-started)/1000,work=results.reduce((a,r)=>a+r.seconds,0);
results.sort((a,b)=>b.seconds-a.seconds);
process.stdout.write(`\nslowest: ${results.slice(0,5).map(r=>`${r.name} ${r.seconds.toFixed(1)}s`).join(', ')}\n`);
process.stdout.write(`${results.length} checks, ${failed} failed, ${wall.toFixed(1)}s on ${jobs} workers (${work.toFixed(0)}s of work)\n`);
process.exit(failed?1:0);
