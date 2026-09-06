await new Promise((r) => setTimeout(r, 500));
const boxes = [...document.querySelectorAll('.internal-embed')];
console.log('smoke-embed-frame: embeds=' + boxes.length);
console.log('smoke-embed-frame: has-ORIGINAL=' + /ORIGINAL/.test(document.body.textContent));
console.log('smoke-embed-frame: has-UPDATED=' + /UPDATED/.test(document.body.textContent));
console.log('smoke-embed-frame: text=' + JSON.stringify(
	document.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 160)));
