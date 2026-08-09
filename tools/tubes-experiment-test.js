const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const fixtures = path.join(root, 'tools/fixtures');

function readGoldenHeaderArray(name) {
	const header = fs.readFileSync(path.join(fixtures, 'tubes_golden_packets.h'), 'utf8');
	const match = header.match(new RegExp(`\\b${name}\\[(\\d+)\\]\\s*=\\s*\\{([^}]*)\\}`));
	assert.ok(match, `missing ${name} in C++ fixture header`);
	const bytes = Buffer.from([...match[2].matchAll(/0x([0-9a-f]{2})/gi)].map(value => parseInt(value[1], 16)));
	assert.equal(bytes.length, Number(match[1]), `${name} initializer length`);
	return bytes;
}

test('Tubes experiment overlay behavior is host-testable', () => {
	const output = path.join(process.env.TMPDIR || '/tmp', `tubes-experiment-${process.pid}`);
	try {
		const result = spawnSync('c++', ['-std=c++11', '-Wall', '-Wextra', '-Werror', '-DTUBES_ENABLE_HELLO_VFX', '-I.',
			'tools/tubes_experiment_test.cpp', '-o', output], {cwd: root, encoding: 'utf8'});
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const run = spawnSync(output, [], {encoding: 'utf8'});
		assert.equal(run.status, 0, run.stderr || run.stdout);
	} finally {
		fs.rmSync(output, {force: true});
	}
});

test('production NodeMessage raw bytes match the deployed golden fixture', (t) => {
	const output = path.join(process.env.TMPDIR || '/tmp', `tubes-node-message-${process.pid}`);
	try {
		const result = spawnSync('c++', ['-std=c++11', '-Wall', '-Wextra', '-Werror', '-I.',
			'tools/tubes_node_message_wire_test.cpp', '-o', output], {cwd: root, encoding: 'utf8'});
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const run = spawnSync(output, [], {encoding: 'utf8'});
		if (run.status === 77) t.skip('raw NodeMessage fixture is defined only for little-endian targets');
		else assert.equal(run.status, 0, run.stderr || run.stdout);
	} finally {
		fs.rmSync(output, {force: true});
	}
});

test('mobile conductor route selection is host-testable', () => {
	const output = path.join(process.env.TMPDIR || '/tmp', `tubes-mobile-conductor-${process.pid}`);
	try {
		const result = spawnSync('c++', ['-std=c++11', '-Wall', '-Wextra', '-Werror', '-I.',
			'tools/tubes_mobile_conductor_test.cpp', '-o', output], {cwd: root, encoding: 'utf8'});
		assert.equal(result.status, 0, result.stderr || result.stdout);
		const run = spawnSync(output, [], {encoding: 'utf8'});
		assert.equal(run.status, 0, run.stderr || run.stdout);
	} finally {
		fs.rmSync(output, {force: true});
	}
});

test('firmware matrix flags are isolated and release names are distinct', () => {
	const ini = fs.readFileSync(path.join(root, 'platformio_tubes.ini'), 'utf8');
	const expected = {
		esp32_quinled_dig2go_tubes_hello: ['TUBES_ENABLE_HELLO_VFX'],
		esp32_quinled_dig2go_tubes_purple_ota: ['TUBES_ENABLE_HTTP_OTA_VFX'],
		esp32_quinled_dig2go_tubes_spatial: ['TUBES_ENABLE_SPATIAL_PATTERNS'],
		esp32_quinled_dig2go_tubes_mobile_conductor: ['TUBES_ENABLE_MOBILE_CONDUCTOR', 'TUBES_ENABLE_SPATIAL_PATTERNS'],
		esp32_quinled_dig2go_tubes_combined: ['TUBES_ENABLE_HELLO_VFX', 'TUBES_ENABLE_HTTP_OTA_VFX', 'TUBES_ENABLE_SPATIAL_PATTERNS'],
	};
	const releaseNames = new Set();
	for (const [environment, flags] of Object.entries(expected)) {
		const match = ini.match(new RegExp(`\\[env:${environment}\\]([\\s\\S]*?)(?=\\n\\[|$)`));
		assert.ok(match, `missing ${environment}`);
		for (const flag of flags) assert.match(match[1], new RegExp(`-D ${flag}(?:\\s|$)`));
		for (const other of Object.values(expected).flat()) {
			if (!flags.includes(other)) assert.doesNotMatch(match[1], new RegExp(`-D ${other}(?:\\s|$)`));
		}
		const releases = [...match[1].matchAll(/WLED_RELEASE_NAME=\\?"?([A-Z0-9_]+)\\?"?/g)];
		assert.ok(releases.length, `missing release name for ${environment}`);
		releaseNames.add(releases.at(-1)[1]);
	}
	assert.equal(releaseNames.size, 5);
	const base = ini.match(/\[env:esp32_quinled_dig2go_tubes\]([\s\S]*?)(?=\n\[|$)/)[1];
	assert.doesNotMatch(base, /TUBES_ENABLE_(?:HELLO_VFX|HTTP_OTA_VFX|SPATIAL_PATTERNS|MOBILE_CONDUCTOR)/);
});

test('wire contract and feature boundaries remain intact', () => {
	const node = fs.readFileSync(path.join(root, 'usermods/Tubes/node.h'), 'utf8');
	const nodeMessage = fs.readFileSync(path.join(root, 'usermods/Tubes/node_message.h'), 'utf8');
	assert.match(nodeMessage, /#define CURRENT_NODE_VERSION 2/);
	assert.match(nodeMessage, /#define MESSAGE_DATA_SIZE 64/);
	assert.match(nodeMessage, /static_assert\(sizeof\(NodeMessage\) == 84/);
	const route = fs.readFileSync(path.join(root, 'usermods/Tubes/mobile_conductor_route.h'), 'utf8');
	assert.match(route, /MOBILE_ROUTE_MAGIC/);
	assert.match(route, /MOBILE_ROUTE_VERSION/);
	assert.match(route, /MOBILE_ROUTE_SIZE = 24/);
	assert.match(route, /static_assert\(sizeof\(MobileRouteAdvertisement\) == MOBILE_ROUTE_SIZE/);
	assert.match(route, /static_assert\(sizeof\(MobileRouteAdvertisement\) != 84/);
	assert.doesNotMatch(route, /\b(?:beat|bpm|epoch)\w*\b/i);
	assert.doesNotMatch(node, /mobileRoute(?:Beat|Bpm|Epoch)/i);
	assert.match(route, /bool observe\(const MobileRouteAdvertisement &advertisement, int8_t rssi, uint32_t now\)/);
	assert.match(node, /#ifdef TUBES_ENABLE_SPATIAL_PATTERNS[\s\S]*isMobileRouteAdvertisement/);
	assert.match(node, /#ifdef TUBES_ENABLE_MOBILE_CONDUCTOR[\s\S]*broadcastMobileRoute/);
	const callback = node.indexOf('static void onEspNowMessage');
	const filter = node.indexOf('static bool onEspNowFilter');
	assert.ok(node.indexOf('len == sizeof(NodeMessage)', callback) < node.indexOf('(const NodeMessage*)msg', callback));
	assert.ok(node.indexOf('len == sizeof(NodeMessage)', filter) < node.indexOf('(const NodeMessage*)msg', filter));
	const experiment = fs.readFileSync(path.join(root, 'usermods/Tubes/experiment_overlay.h'), 'utf8');
	assert.doesNotMatch(experiment, /\b(?:audio|microphone|micInput)\b/i);
	const ota = fs.readFileSync(path.join(root, 'wled00/ota_update.cpp'), 'utf8');
	assert.doesNotMatch(ota, /TUBES|tubesHttpOta|extern\s+"C"/);
	assert.match(ota, /context->resourcesReleased = true;\s*doReboot = true;/);
	assert.ok(ota.indexOf('context->resourcesReleased = true;\n        doReboot = true;') < ota.indexOf('finalizeOTAFailure(context);\n    delete context;'));
	const controller = fs.readFileSync(path.join(root, 'usermods/Tubes/controller.h'), 'utf8');
	assert.doesNotMatch(controller, /setMobileRoute(?:Beat|Bpm|Epoch)/i);
	assert.ok(controller.indexOf('do_pattern_changes();') < controller.indexOf('drawExperimentOverlay();'));
	assert.doesNotMatch(controller, /SPATIAL_(?:LATENCY_FLOOR|BPM_DRIFT)_ID|selectSpatialExperiment|isLeading\(\).*spatial|spatial.*isLeading\(\)/);
	assert.doesNotMatch(node, /SpatialMode|spatialMode/);
});

test('M0 compatibility contract records the conductor boundary', () => {
	const contract = fs.readFileSync(path.join(root, 'usermods/Tubes/docs/S3_CONDUCTOR_CONTRACT.md'), 'utf8');
	for (const statement of [
		'exactly 84 bytes', 'exactly 24 bytes', '`MasterRole = 200`', 'IDs `0..23`', 'IDs `24+`',
		'logical Tubes node', 'no physical LED output', 'current and next', 'same WLED 16.0.1',
		'Arduino-ESP32 2.0.18', 'mixed-firmware', 'hardware write gate'
	]) assert.match(contract, new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('binary fixtures exactly match the generated C++ fixture header', () => {
	assert.deepEqual(readGoldenHeaderArray('TUBES_GOLDEN_NODE_V2_STATE'),
		fs.readFileSync(path.join(fixtures, 'tubes-v2-state.bin')));
	assert.deepEqual(readGoldenHeaderArray('TUBES_GOLDEN_ROUTE_V1'),
		fs.readFileSync(path.join(fixtures, 'mobile-route-v1.bin')));
});

test('Tubes owns OTA suspension through the generic usermod callback', () => {
	const tubesCpp = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.cpp'), 'utf8');
	const tubesHeader = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.h'), 'utf8');
	assert.doesNotMatch(tubesCpp, /extern\s+"C"|tubesHttpOta/);
	assert.match(tubesHeader, /bool otaSuspended = false/);
	assert.match(tubesHeader, /void onUpdateBegin\(bool init\) override/);
	assert.match(tubesHeader, /if \(otaSuspended\) return;/);
});
