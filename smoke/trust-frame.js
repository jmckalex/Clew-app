// Inside Scripts.md's preview (make-trust-vault.mjs), for the trust
// scenarios: what of the vault's code ran HERE, by the marks each leaves.
//   smoke-trust-frame: restricted=<attr> inline=<ran|-> handler=<ran|->
//     vault-script=<ran|-> vault-plugin=<ran|-> page=<ran|-> dvjs=<ran|refused|->
//     refused=<the client's in-place marks> api=<ok|refused> net=<blocked|allowed> self=<ok|…>
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const html = document.documentElement.dataset;
const page = document.getElementById('page')?.contentDocument?.body?.dataset?.page ?? '-';
// The refusal shows the block's source, so look for the refusal first.
const dvjs = document.querySelector('[data-jmd-refused="dataviewjs"]') ? 'refused'
	: document.body.textContent.includes('DVJS-RAN') ? 'ran' : '-';
const marks = [...document.querySelectorAll('[data-clew-refused-script]')].map((el) => el.dataset.jmdRefused).join('|') || '-';
let api;
try {
	await Promise.race([window.clew.kv.set('trust-probe', 1), sleep(4000).then(() => { throw new Error('timeout'); })]);
	api = 'ok';
} catch (err) {
	api = `refused(${String(err.message).slice(0, 40)})`;
}
// The network CSP, against a reserved name (RFC 2606): blocked by the CSP
// before any lookup when the network is off; with it on, the fetch fails
// on the name instead. Same-origin reads must always work.
let violated = false;
document.addEventListener('securitypolicyviolation', (e) => { if (String(e.blockedURI).includes('clew-csp-probe')) violated = true; });
try { await fetch('https://clew-csp-probe.invalid/'); } catch { /* blocked, or no such host */ }
await sleep(300);
const net = violated ? 'blocked' : 'not-blocked';
let self;
try { self = (await fetch('Scripts.md')).ok ? 'ok' : 'status'; } catch (err) { self = `error ${err.message}`; }
console.log(`smoke-trust-frame: restricted=${html.clewRestricted ?? '-'} inline=${html.inline ?? '-'} handler=${html.handler ?? '-'} vault-script=${html.vaultScript ?? '-'} vault-plugin=${html.vaultPlugin ?? '-'} page=${page} dvjs=${dvjs} refused=${marks} api=${api} net=${net} self=${self}`);
