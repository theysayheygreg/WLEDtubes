const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');

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

test('firmware matrix flags are isolated and release names are distinct', () => {
	const ini = fs.readFileSync(path.join(root, 'platformio_tubes.ini'), 'utf8');
	const expected = {
		esp32_quinled_dig2go_tubes_hello: ['TUBES_ENABLE_HELLO_VFX'],
		esp32_quinled_dig2go_tubes_purple_ota: ['TUBES_ENABLE_HTTP_OTA_VFX'],
		esp32_quinled_dig2go_tubes_spatial: ['TUBES_ENABLE_SPATIAL_PATTERNS'],
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
	assert.equal(releaseNames.size, 4);
	const base = ini.match(/\[env:esp32_quinled_dig2go_tubes\]([\s\S]*?)(?=\n\[|$)/)[1];
	assert.doesNotMatch(base, /TUBES_ENABLE_(?:HELLO_VFX|HTTP_OTA_VFX|SPATIAL_PATTERNS)/);
});

test('wire contract and feature boundaries remain intact', () => {
	const node = fs.readFileSync(path.join(root, 'usermods/Tubes/node.h'), 'utf8');
	assert.match(node, /#define CURRENT_NODE_VERSION 2/);
	assert.match(node, /#define MESSAGE_DATA_SIZE 64/);
	const experiment = fs.readFileSync(path.join(root, 'usermods/Tubes/experiment_overlay.h'), 'utf8');
	assert.doesNotMatch(experiment, /\b(?:audio|microphone|micInput)\b/i);
	const ota = fs.readFileSync(path.join(root, 'wled00/ota_update.cpp'), 'utf8');
	assert.doesNotMatch(ota, /TUBES|tubesHttpOta|extern\s+"C"/);
	assert.match(ota, /context->resourcesReleased = true;\s*doReboot = true;/);
	assert.ok(ota.indexOf('context->resourcesReleased = true;\n        doReboot = true;') < ota.indexOf('finalizeOTAFailure(context);\n    delete context;'));
	const controller = fs.readFileSync(path.join(root, 'usermods/Tubes/controller.h'), 'utf8');
	assert.ok(controller.indexOf('do_pattern_changes();') < controller.indexOf('drawExperimentOverlay();'));
	assert.doesNotMatch(controller, /SPATIAL_(?:LATENCY_FLOOR|BPM_DRIFT)_ID|selectSpatialExperiment|isLeading\(\).*spatial|spatial.*isLeading\(\)/);
	assert.doesNotMatch(node, /SpatialMode|spatialMode|SPATIAL_/);
});

test('Tubes owns OTA suspension through the generic usermod callback', () => {
	const tubesCpp = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.cpp'), 'utf8');
	const tubesHeader = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.h'), 'utf8');
	assert.doesNotMatch(tubesCpp, /extern\s+"C"|tubesHttpOta/);
	assert.match(tubesHeader, /bool otaSuspended = false/);
	assert.match(tubesHeader, /void onUpdateBegin\(bool init\) override/);
	assert.match(tubesHeader, /if \(otaSuspended\) return;/);
});
