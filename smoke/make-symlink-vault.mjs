// A vault with links OUT of it (the symlink check, 2026-10-03; engine/
// vault-bounds.js), for symlink-scenario.js:
//
//   node smoke/make-symlink-vault.mjs <dir>
//
// <dir>/vault/Out → <dir>/outside (a folder link), <dir>/vault/leak.md →
// <dir>/outside/secret.md (a file link), and Note.md embedding both and an
// image through the folder link. The outside files carry OUTSIDE-SECRET.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node smoke/make-symlink-vault.mjs <dir>');
fs.rmSync(dir, { recursive: true, force: true });
const vault = path.join(dir, 'vault');
const outside = path.join(dir, 'outside');
fs.mkdirSync(vault, { recursive: true });
fs.mkdirSync(outside, { recursive: true });
fs.writeFileSync(path.join(outside, 'secret.md'), '# Secret\n\nOUTSIDE-SECRET in a note outside the vault.\n');
// A 1×1 PNG.
fs.writeFileSync(path.join(outside, 'pic.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
fs.symlinkSync(outside, path.join(vault, 'Out'));
fs.symlinkSync(path.join(outside, 'secret.md'), path.join(vault, 'leak.md'));
fs.writeFileSync(path.join(vault, 'Note.md'), '# Note\n\nINSIDE-TEXT.\n\n![[Out/secret]]\n\n![[leak]]\n\n![[Out/pic.png]]\n');
console.log(vault);
