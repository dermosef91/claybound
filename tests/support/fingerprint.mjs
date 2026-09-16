// What a recorded playthrough actually depends on: the simulation, the chapter
// layouts, and every module those two reach. The graph is walked rather than
// listed by hand, because the failure mode of a hand-kept list is a recording
// that looks current after the one file nobody remembered to add has changed.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

// dist/ is authored as plain ES modules: every specifier is static, relative
// and spelled out, with no dynamic import anywhere. That is what makes reading
// them off with a pattern safe here rather than merely convenient.
const SPECIFIER=/(?:^|[\s;])(?:import|export)\b[^'"]*?from\s*['"](\.[^'"]+)['"]|(?:^|[\s;])import\s*['"](\.[^'"]+)['"]/gm;

// `least` is a tripwire, not a tuning knob. A broken scan reaches only the
// entry files, and this fails there instead of quietly hashing one file and
// pronouncing every stale recording valid.
export async function graph(entries,{least=5}={}){
  const seen=new Map(),queue=[...entries];
  while(queue.length){
    const url=queue.shift();
    if(seen.has(url.href))continue;
    const source=await readFile(url,'utf8');
    seen.set(url.href,source);
    for(const m of source.matchAll(SPECIFIER))queue.push(new URL(m[1]||m[2],url));
  }
  if(seen.size<least)throw new Error(`fingerprint reached only ${seen.size} modules from ${entries.length} entries, so the import scan is not seeing the whole program`);
  return seen;
}

// Paths go into the hash relative to dist/, so the same checkout copied to
// another directory keeps its recordings.
export async function fingerprint(entries,options){
  const modules=await graph(entries,options),hash=createHash('sha256');
  for(const href of [...modules.keys()].sort())
    hash.update(href.split('/dist/').at(-1)).update('\0').update(modules.get(href)).update('\0');
  return hash.digest('hex').slice(0,32);
}
