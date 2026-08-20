const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('S3 Follow mode consumes flock visual state', () => {
	const controller = read('usermods/Tubes/controller.h');
	const stateHandler = controller.match(/case COMMAND_STATE: \{([\s\S]*?)\n\s*return true;\n\s*\}/);
	assert.ok(stateHandler, 'could not isolate COMMAND_STATE handler');
	assert.doesNotMatch(stateHandler[1], /TUBES_S3_FIELD_OS[\s\S]*return true/);
	assert.match(stateHandler[1], /load_pattern\(state\)/);
	assert.match(stateHandler[1], /load_palette\(state\)/);
	assert.match(stateHandler[1], /load_effect\(state\)/);
});

test('S3 pattern controls are denied below master authority', () => {
	const tubes = read('usermods/Tubes/Tubes.h');
	assert.match(tubes, /bool s3ForceNext\(\) \{\s*if \(!controller\.isMasterRole\(\)\) return false;/);
	assert.match(tubes, /bool s3ForcePrevious\(\) \{\s*if \(!controller\.isMasterRole\(\)\) return false;/);
});

test('Conductor fully redraws when Master Follow mode changes', () => {
	const source = read('usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp');
	assert.match(source, /renderedMaster = status\.isMaster;\s*renderedMasterValid = true;/);
	assert.match(source, /if \(!renderedMasterValid \|\| renderedMaster != status\.isMaster\) \{\s*drawConductor\(\);/);
	assert.match(source, /else if \(screen == FieldScreen::Conductor\) drawConductor\(\);/);
	assert.match(source, /if \(!btnStatus\.isMaster\)[\s\S]*return;/);
});

test('Conductor telemetry stays inside its own card', () => {
	const source = read('usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp');
	const telemetry = source.match(/void drawConductorTelemetry[\s\S]*?\n  \}/);
	assert.ok(telemetry, 'could not isolate Conductor telemetry renderer');
	assert.match(telemetry[0], /fillRect\(32, 96, 190, 68, COLOR_SURFACE\)/);
	assert.doesNotMatch(telemetry[0], /S3 Remote ID|Packets heard; no fresh sync state/);
});
