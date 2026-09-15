import {defineConfig} from 'vite';
import {cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=dirname(fileURLToPath(import.meta.url));

// dist/ stays the authored, directly-servable source — `npm run dev` serves the
// same files a browser would get from a plain static host, which is what makes
// the game editable without a build step. `npm run build` is additive: it emits
// a bundled, minified copy into build/ for production, where 93 separate module
// requests and 2 MB of unminified three.js are worth removing.
//
// The models, audio and textures under dist/assets are fetched by name at
// runtime rather than imported, so Rollup never sees them; they are copied
// across verbatim after the bundle is written.
const copyRuntimeAssets=()=>({
  name:'claybound-copy-assets',
  apply:'build',
  async closeBundle(){
    await cp(join(root,'dist/assets'),join(root,'build/assets'),{recursive:true});
  }
});

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
    rollupOptions:{output:{manualChunks:undefined}}
  }
});
