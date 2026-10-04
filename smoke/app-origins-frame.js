// app-origins-scenario.js's app side: the Probe's history, load by load.
if (location.protocol === 'clew-frame:') console.log(`smoke-ao-app: history=${document.body.dataset.history ?? localStorage.getItem('history')}`);
