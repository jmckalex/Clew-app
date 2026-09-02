// Re-assert after a beat: morphdom wipes attributes the rendered HTML lacks,
// so read the async one and re-check the script actually ran.
await new Promise((r) => setTimeout(r, 1500));
const fence = document.querySelector('.hello-global-fence');
console.log('smoke-gp-frame: engine-fence=' + (fence ? JSON.stringify(fence.textContent) : 'MISSING'));
console.log('smoke-gp-frame: preview-script-tag='
	+ !!document.querySelector('script[src*="__clew_plugin_file__"]'));
console.log('smoke-gp-frame: sibling-fetch=' + document.body.getAttribute('data-hello-global-sibling'));
