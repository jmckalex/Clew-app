import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refusedAddress, vetAddresses } from '../src/main/remote-guard.js';

class RemoteError extends Error {
	constructor(code, message) { super(message); this.code = code; }
}

const REFUSED_V4 = [
	'0.0.0.0', '0.1.2.3',                                  // this network
	'10.0.0.1', '10.255.255.255',                          // private
	'100.64.0.1', '100.127.255.255',                       // CGNAT
	'127.0.0.1', '127.255.255.254',                        // loopback
	'169.254.0.1', '169.254.169.254',                      // link-local, cloud metadata
	'172.16.0.1', '172.31.255.255',                        // private
	'192.0.0.8', '192.0.2.1', '192.88.99.1',               // IETF, TEST-NET-1, 6to4 relay
	'192.168.0.1', '192.168.255.255',                      // private
	'198.18.0.1', '198.19.255.255',                        // benchmarking
	'198.51.100.7', '203.0.113.9',                         // TEST-NET-2, -3
	'224.0.0.1', '239.255.255.255',                        // multicast
	'240.0.0.1', '255.255.255.255',                        // reserved, broadcast
];

const ALLOWED_V4 = [
	'8.8.8.8', '1.1.1.1', '93.184.216.34',
	'172.32.0.1', '172.15.255.255',    // just outside 172.16/12
	'100.128.0.1', '100.63.255.255',   // just outside 100.64/10
	'169.253.255.255', '169.255.0.1',  // just outside 169.254/16
	'11.0.0.1', '192.169.0.1', '223.255.255.255',
];

const REFUSED_V6 = [
	'::', '::1',
	'fe80::1', 'fe80::1%en0', 'febf::1',                   // link-local (with a zone)
	'fc00::1', 'fd12:3456:789a::1',                        // unique local
	'fec0::1',                                             // site-local
	'ff02::1', 'ff0e::1',                                  // multicast
	'100::1',                                              // discard-only
	'2001:db8::1', '2001:db8:ffff::1',                     // documentation
	'::ffff:127.0.0.1', '::ffff:7f00:1',                   // mapped loopback, both spellings
	'::ffff:169.254.169.254', '::ffff:10.1.2.3',           // mapped metadata, private
	'::127.0.0.1', '::10.0.0.1',                           // IPv4-compatible
	'64:ff9b::a9fe:a9fe', '64:ff9b::7f00:1',               // NAT64 of metadata, loopback
	'64:ff9b::192.168.1.1',                                // NAT64, dotted tail
	'64:ff9b:1::a00:1',                                    // local-use NAT64 of 10.0.0.1
	'2002:7f00:1::1', '2002:c0a8:101::1',                  // 6to4 of 127.0.0.1, 192.168.1.1
	'2001:0:4136:e378:8000:63bf:3fff:fdd2',                // Teredo
];

const ALLOWED_V6 = [
	'2606:4700:4700::1111', '2001:4860:4860::8888',
	'::ffff:8.8.8.8', '::ffff:808:808',                    // mapped public
	'64:ff9b::808:808',                                    // NAT64 of 8.8.8.8
	'2002:808:808::1',                                     // 6to4 of 8.8.8.8
	'2a00:1450:4009:81f::200e',
];

test('every refused IPv4 range is refused', () => {
	for (const address of REFUSED_V4) assert.ok(refusedAddress(address), `${address} must be refused`);
});

test('public IPv4 addresses, including the edges of refused ranges, pass', () => {
	for (const address of ALLOWED_V4) assert.equal(refusedAddress(address), null, `${address} must pass`);
});

test('every refused IPv6 range is refused, and every form carrying a refused IPv4', () => {
	for (const address of REFUSED_V6) assert.ok(refusedAddress(address), `${address} must be refused`);
	assert.match(refusedAddress('::ffff:169.254.169.254'), /carries 169\.254\.169\.254/);
	assert.match(refusedAddress('64:ff9b::a9fe:a9fe'), /carries 169\.254\.169\.254/);
	assert.match(refusedAddress('2002:7f00:1::1'), /carries 127\.0\.0\.1/);
});

test('public IPv6 addresses pass, including forms carrying a public IPv4', () => {
	for (const address of ALLOWED_V6) assert.equal(refusedAddress(address), null, `${address} must pass`);
});

test('a name is not an address', () => {
	assert.match(refusedAddress('example.com'), /not an IP address/);
	assert.match(refusedAddress(''), /not an IP address/);
});

test('vetAddresses: every answer must pass, or the host is refused whole', () => {
	const pub = { address: '93.184.216.34', family: 4 };
	assert.deepEqual(vetAddresses('ok.example', [pub, { address: '2606:4700::1', family: 6 }], RemoteError), pub);
	// A name that answers public AND private is one an attacker controls.
	for (const bad of ['10.0.0.1', '127.0.0.1', '::1', '::ffff:192.168.0.1', '169.254.169.254']) {
		assert.throws(() => vetAddresses('mixed.example', [pub, { address: bad, family: bad.includes(':') ? 6 : 4 }], RemoteError),
			(err) => err.code === 'refused-address' && err.message.includes('mixed.example'), bad);
	}
	assert.throws(() => vetAddresses('nothing.example', [], RemoteError), (err) => err.code === 'dns');
});
