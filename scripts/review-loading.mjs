// Render the production loading markup/CSS without waiting on network timing.
// Run with Node, then open /loading-review.html on the static preview server.
import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const review=source.replace('<script type="module" src="./app.js"></script>',`<style>
  #game-shell > :not(#loading) {display:none!important}
  #loading {display:flex!important;opacity:1!important}
</style><script type="module">
  import {applyUIPalette} from './palette.js';
  applyUIPalette(document.documentElement);
  const chapter=new URLSearchParams(location.search).get('chapter');
  if(chapter){
    document.getElementById('loading-progress').classList.add('determinate');
    document.getElementById('loading-fill').style.width='64%';
    document.getElementById('loading-status').textContent='Loading the '+chapter+' · 64%';
  }
</script>`);
await writeFile(new URL('../dist/loading-review.html',import.meta.url),review);
console.log('Loading review ready at /loading-review.html (optional ?chapter=glowing%20caverns)');
