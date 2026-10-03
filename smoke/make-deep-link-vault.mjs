// A fixture for deep-link-scenario.js and the `clew` command's checks:
// `node smoke/make-deep-link-vault.mjs <dir>` writes <dir>/Vault (Guide/Two.md
// with headings, Plain.md), <dir>/Elsewhere (a vault this device does not
// know) and <dir>/ud/clew-settings.json listing Vault as known.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: make-deep-link-vault.mjs <dir>'); process.exit(1); }
rmSync(dir, { recursive: true, force: true });
const vault = join(dir, 'Vault');
mkdirSync(join(vault, 'Guide'), { recursive: true });
mkdirSync(join(vault, '.clew'), { recursive: true });
const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of the first part.`);
writeFileSync(join(vault, 'Guide', 'Two.md'), `# Two\n\n${lines.join('\n\n')}\n\n## Second heading\n\nBelow the second heading.\n`);
writeFileSync(join(vault, 'Plain.md'), '# Plain\n\nA plain note.\n');
mkdirSync(join(dir, 'Elsewhere', '.clew'), { recursive: true });
writeFileSync(join(dir, 'Elsewhere', 'x.md'), '# x\n');
mkdirSync(join(dir, 'ud'), { recursive: true });
writeFileSync(join(dir, 'ud', 'clew-settings.json'), JSON.stringify({ recentVaults: [vault] }));
