import {readFileSync} from 'node:fs';

// The cave editor removed this optional relay. Keep its original authored
// setup as a fixture so timer, bridge and press behavior remain covered.
export const pressRelayLevel=JSON.parse(readFileSync(new URL('../docs/cave-layout-canon/previous-canonical-v5.json',import.meta.url),'utf8'));
