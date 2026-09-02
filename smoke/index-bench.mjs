// Cold vs warm index build over a vault, measured directly (no Electron).
//   node smoke/index-bench.mjs /path/to/vault
import fs from 'node:fs';
import path from 'node:path';
import { Indexer } from '../src/main/indexer.js';

const vault = process.argv[2];
if (!vault) { console.error('usage: node smoke/index-bench.mjs <vault>'); process.exit(1); }
fs.rmSync(path.join(vault, '.clew', 'cache.json'), { force: true });

let t = performance.now();
const cold = new Indexer();
cold.openVault(vault);
console.log(`cold index: ${Math.round(performance.now() - t)}ms, ${cold.notes.size} notes`);
// Let the debounced cache persist (2s timer), then measure the warm load.
await new Promise((r) => setTimeout(r, 2600));
cold.closeVault();

t = performance.now();
const warm = new Indexer();
warm.openVault(vault);
console.log(`warm index: ${Math.round(performance.now() - t)}ms, ${warm.notes.size} notes`);
warm.closeVault();
process.exit(0);
