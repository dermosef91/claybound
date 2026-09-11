import {defineConfig} from 'vite';

// Local visual iteration serves the same authored static files as production.
export default defineConfig({
  root:'dist',
  server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
  optimizeDeps:{noDiscovery:true}
});
