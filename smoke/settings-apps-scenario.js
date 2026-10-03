// Settings → This vault → Apps is a real heading (the refusal an app shows,
// the demo's Flashcards and Guide/Apps in Notes.md all point there). Over
// the demo vault (Apps/Flashcards) or any vault without apps:
//   `apps: subsection=true heading="Apps" after-plugins=true rows=1 none=false`
//   (no apps: `rows=0 none=true`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { registry } = window.__clew;
const log = (s) => console.log('smoke-sa: ' + s);
for (let i = 0; i < 300 && !window.__clew.vaultStore.vault?.sessionId; i++) await sleep(100);
await sleep(1500);
registry.runCommand('app:settings');
let apps = null;
for (let i = 0; i < 50 && !(apps = document.querySelector('[data-settings-subsection="apps"]'))?.querySelector('p'); i++) await sleep(100);
await sleep(500);
const section = apps?.closest('.settings-section');
const children = section ? [...section.querySelectorAll('*')] : [];
const pluginsAt = children.findIndex((el) => /Plugins available here|No plugins found/.test(el.textContent) && el.matches('p'));
log(`apps: subsection=${Boolean(apps)} heading=${JSON.stringify(apps?.querySelector('h3')?.textContent ?? '')} after-plugins=${pluginsAt >= 0 && pluginsAt < children.indexOf(apps)} rows=${apps?.querySelectorAll('[data-app-id]').length ?? 0} none=${/No apps in this vault/.test(apps?.textContent ?? '')}`);
apps?.scrollIntoView({ block: 'center' });
await sleep(400);
