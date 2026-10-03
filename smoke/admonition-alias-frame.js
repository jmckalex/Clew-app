// Reading view's half of admonition-alias-scenario.js.
[...document.querySelectorAll('.callout')].forEach((c, n) => {
	const title = c.querySelector('.callout-title-inner')?.textContent.trim();
	console.log(`smoke-adm: ${n} type=${c.dataset.callout} title=${JSON.stringify(title)}`
		+ ` custom=${c.classList.contains('callout-custom')} color=${c.style.getPropertyValue('--clew-callout-color') || 'none'}`);
});
