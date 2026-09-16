import {defineConfig} from 'vite';
import {cp,readdir,readFile} from 'node:fs/promises';
import {statSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve,relative} from 'node:path';

const root=dirname(fileURLToPath(import.meta.url));
const BRAND_FILES=/^(manifest\.webmanifest|og-card\.jpg|icon-\d+\.png)$/;

// dist/ stays the authored, directly-servable source — `npm run dev` serves the
// same files a browser would get from a plain static host, which is what makes
// the game editable without a build step. `npm run build` is additive: it emits
// a bundled, minified copy into build/ for production, where 93 separate module
// requests and 2 MB of unminified three.js are worth removing.
//
// Most of dist/assets is fetched by name at runtime rather than imported, so
// Rollup never sees it and it has to be copied across by hand. The exception is
// anything reached through a static `new URL('./assets/…', import.meta.url)` —
// the music and effect cues, the logo — which Rollup does resolve and emit into
// the bundle under a hashed name. Copying those a second time would ship about
// 20 MB twice, so each file Rollup already emitted is skipped here.
const copyRuntimeAssets=()=>{
  const emitted=new Set();
  return {
    name:'claybound-copy-assets',
    apply:'build',
    generateBundle(options,bundle){
      for(const output of Object.values(bundle)){
        const source=output.originalFileName||output.originalFileNames?.[0];
        if(source)emitted.add(resolve(root,'dist',source));
      }
    },
    async closeBundle(){
      const out=join(root,'build'),from=join(root,'dist/assets');
      // Rollup rewrites `new URL('./assets/…', import.meta.url)` to a hashed
      // name, but it cannot rewrite a path that is just text inside a markup
      // template — the bead and flower in the chapter list, say. So any
      // ./assets/… still spelled out in the built output is a live runtime
      // reference, and that file has to be there under its own name.
      const referenced=new Set();
      const scan=async dir=>{
        for(const entry of await readdir(dir,{withFileTypes:true})){
          const full=join(dir,entry.name);
          if(entry.isDirectory()){if(entry.name!=='assets')await scan(full);continue;}
          if(!/\.(js|css|html)$/.test(entry.name))continue;
          for(const m of (await readFile(full,'utf8')).matchAll(/assets\/([A-Za-z0-9_.\/-]+)/g))
            referenced.add(m[1]);
        }
      };
      await scan(out);
      await cp(from,join(out,'assets'),{
        recursive:true,
        filter(src){
          if(statSync(src).isDirectory())return true;
          // Copy anything Rollup did not take, and anything it took that the
          // output still asks for by name. Skipping the rest is what keeps the
          // music and effect cues from shipping twice.
          return !emitted.has(resolve(src))||referenced.has(relative(from,src));
        }
      });
      const missing=[...referenced].filter(rel=>!existsSync(join(out,'assets',rel)));
      if(missing.length)throw new Error(
        `Built output references assets that were not copied: ${missing.join(', ')}`);

      // The web app manifest lists icons Rollup never sees, because nothing
      // parses a manifest's contents. Copy anything it names that is not
      // already beside index.html, then prove the installed app can find it.
      const manifestPath=join(out,'manifest.webmanifest');
      if(existsSync(manifestPath)){
        const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
        const listed=[...(manifest.icons||[]),...(manifest.screenshots||[])].map(entry=>entry.src);
        for(const src of new Set(listed)){
          const name=src.replace(/^\.\//,'');
          if(existsSync(join(out,name)))continue;
          if(!existsSync(join(root,'dist',name)))
            throw new Error(`The manifest lists ${src}, which is not in dist/.`);
          await cp(join(root,'dist',name),join(out,name));
        }
      }
    }
  };
};

export default defineConfig({
  root:'dist',
  // Relative URLs so the build works from a subdirectory, not just a domain root.
  base:'./',
  server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
  optimizeDeps:{noDiscovery:true},
  plugins:[copyRuntimeAssets()],
  build:{
    outDir:join(root,'build'),
    emptyOutDir:true,
    target:'es2022',
    assetsDir:'bundle',
    // The game is one screen: a single chunk beats a waterfall of small ones.
    modulePreload:{polyfill:false},
    reportCompressedSize:true,
    rollupOptions:{
      // The animation lab is a second page, not a route inside the game, so the
      // bundler has to be told it exists or it never reaches the build.
      input:{index:join(root,'dist/index.html'),animation:join(root,'dist/animation-playground.html')},
      output:{
      manualChunks:undefined,
      // Five files must keep their exact names beside index.html. The web app
      // manifest resolves its own icon list and its start_url/scope against its
      // own URL, so hashing it into bundle/ would point the installed app at
      // bundle/ and at icons that are not there. The share card keeps a stable
      // name for the opposite reason: crawlers cache og:image by URL, and a new
      // hash every build throws that cache away.
      assetFileNames(info){
        const name=(info.names?.[0]||info.name||'').split('/').pop();
        return BRAND_FILES.test(name)?'[name][extname]':'bundle/[name]-[hash][extname]';
      }
    }}
  }
});
