// Choice D (frame-bridge.md §6): what WebRTC can do from inside an app
// frame — no CSP governs ICE. A peer connection with a STUN server at a
// RESERVED name (RFC 2606: it resolves nowhere, so nothing leaves), a data
// channel, an offer, and the candidates gathered in 3 s, by type and
// protocol. Run with and without CLEW_SMOKE_WEBRTC_POLICY.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (location.protocol === 'clew-frame:') {
	let line;
	if (typeof RTCPeerConnection !== 'function') {
		line = 'exists=false';
	} else {
		const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:clew-csp-probe.invalid:3478' }] });
		const seen = [];
		pc.onicecandidate = (e) => { if (e.candidate) seen.push(`${e.candidate.type}/${e.candidate.protocol}`); };
		pc.createDataChannel('probe');
		try {
			await pc.setLocalDescription(await pc.createOffer());
			await sleep(3000);
			line = `exists=true candidates=${seen.length} kinds=${[...new Set(seen)].sort().join(',') || '-'} gathering=${pc.iceGatheringState}`;
		} catch (err) {
			line = `exists=true error=${err.name}`;
		}
		pc.close();
	}
	console.log(`smoke-webrtc: ${line}`);
}
