const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync, spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const {parsePartitions, validatePartitions, validateBinarySize} = require('./s3-partition-contract');

const validCsv = `# Name, Type, SubType, Offset, Size, Flags\r\nnvs,data,nvs,0x9000,20K,\r\notadata,data,ota,,8K, # placed at 0xe000\r\nota_0,app,ota_0,,6M,\r\nota_1,app,ota_1,,0x600000,\r\nspiffs,data,spiffs,,4063232,\r\ncoredump,data,coredump,,64K,\r\n`;

function validation(csv = validCsv) {
	try { return validatePartitions(parsePartitions(csv)); }
	catch (error) { return [error.message]; }
}

function replaceRow(csv, name, row) {
	return csv.replace(new RegExp(`^${name},.*$`, 'm'), row);
}

test('partition parser supports comments, CRLF, decimal, hex, and integer K/M suffixes with aligned blank-offset placement', () => {
	const partitions = parsePartitions(validCsv);
	assert.deepEqual(partitions.map(({name, offset, size}) => ({name, offset, size})), [
		{name: 'nvs', offset: 0x9000, size: 20 * 1024},
		{name: 'otadata', offset: 0xe000, size: 8 * 1024},
		{name: 'ota_0', offset: 0x10000, size: 6 * 1024 * 1024},
		{name: 'ota_1', offset: 0x610000, size: 0x600000},
		{name: 'spiffs', offset: 0xc10000, size: 4063232},
		{name: 'coredump', offset: 0xff0000, size: 64 * 1024}
	]);
	assert.deepEqual(validatePartitions(partitions), []);
});

test('partition parser rejects missing first offset and malformed rows or numbers', () => {
	for (const csv of [
		validCsv.replace('0x9000', ''),
		validCsv.replace('20K', ''),
		validCsv.replace('20K', 'wat'),
		validCsv.replace('nvs,data,nvs,0x9000,20K,', 'nvs,data,nvs,0x9000'),
		validCsv.replace('nvs,data,nvs,0x9000,20K,', ',data,nvs,0x9000,20K,')
	]) assert.match(validation(csv).join('\n'), /invalid|missing|malformed/i);
});

test('partition validation rejects duplicate names and wrong required type/subtype pairs', () => {
	assert.match(validation(validCsv + 'nvs,data,nvs,0x200000,4K,\n').join('\n'), /duplicate partition name: nvs/);
	const pairs = {nvs: ['app','nvs'], otadata: ['data','nvs'], ota_0: ['data','ota_0'], ota_1: ['app','ota_0'], spiffs: ['data','coredump'], coredump: ['app','coredump']};
	for (const [name, [type, subtype]] of Object.entries(pairs)) {
		const csv = validCsv.replace(new RegExp(`^${name},[^,]+,[^,]+`, 'm'), `${name},${type},${subtype}`);
		assert.match(validation(csv).join('\n'), new RegExp(`${name}.*type.*subtype`, 'i'));
	}
});

test('partition validation rejects misaligned explicit app and data offsets', () => {
	assert.match(validation(replaceRow(validCsv, 'ota_0', 'ota_0,app,ota_0,0x11000,6M,')).join('\n'), /ota_0.*0x10000 aligned/i);
	assert.match(validation(replaceRow(validCsv, 'nvs', 'nvs,data,nvs,0x9001,20K,')).join('\n'), /nvs.*0x1000 aligned/i);
});

test('partition contract retains missing, overlap, end, equal OTA, and headroom checks', () => {
	assert.match(validation(validCsv.replace(/^otadata.*\r?\n/m, '')).join('\n'), /missing required partition: otadata/);
	assert.match(validation(replaceRow(validCsv, 'ota_1', 'ota_1,app,ota_1,0x600000,6M,')).join('\n'), /overlap/);
	assert.match(validation(replaceRow(validCsv, 'coredump', 'coredump,data,coredump,0xff0000,128K,')).join('\n'), /16MB flash/);
	assert.match(validation(replaceRow(validCsv, 'ota_1', 'ota_1,app,ota_1,,5M,')).join('\n'), /equal size/);
	assert.deepEqual(validateBinarySize(0x519999, 0x600000), []);
	assert.match(validateBinarySize(0x51999a, 0x600000).join('\n'), /15% headroom/);
});

test('partition CLI checks the actual firmware binary file size', () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's3-contract-'));
	const csv = path.join(dir, 'partitions.csv');
	const firmware = path.join(dir, 'firmware.bin');
	fs.writeFileSync(csv, validCsv);
	fs.writeFileSync(firmware, Buffer.alloc(0x51999a));
	const result = spawnSync(process.execPath, [path.join(__dirname, 's3-partition-contract.js'), csv, firmware], {encoding: 'utf8'});
	assert.equal(result.status, 1);
	assert.match(result.stderr, /15% headroom/);
});

test('Waveshare effective environment has unique artifact identity, one enabled USB CDC definition, and immutable pins', () => {
	const output = execFileSync('pio', ['project', 'config', '--json-output'], {
		cwd: root, encoding: 'utf8', env: {...process.env, PLATFORMIO_PROJECT_CONFIG: 'platformio_tubes.ini'}
	});
	const sections = new Map(JSON.parse(output).map(([name, options]) => [name, Object.fromEntries(options)]));
	const env = sections.get('env:waveshare_s3_tubes_remote');
	assert.ok(env, 'missing effective waveshare_s3_tubes_remote environment');
	let flags = [].concat(env.build_flags).join(' ');
	const unflags = [].concat(env.build_unflags).join(' ');
	for (const unflag of unflags.split(/\s+(?=-D)/).map(value => value.trim()).filter(Boolean))
		flags = flags.split(unflag).join('');
	assert.match(flags, /WLED_RELEASE_NAME=\\\"WAVESHARE_S3_TUBES_REMOTE\\\"/);
	assert.doesNotMatch(flags, /WLED_RELEASE_NAME=\\\"ESP32-S3_16MB_opi\\\"/);
	assert.equal((flags.match(/ARDUINO_USB_CDC_ON_BOOT=1/g) || []).length, 1);
	assert.doesNotMatch(flags, /ARDUINO_USB_CDC_ON_BOOT=0/);
	assert.match(flags, /TUBES_S3_FIELD_OS/);
	const dependencies = [].concat(env.lib_deps).join('\n');
	for (const sha of ['3cc08c4e9ab6d85807e49b657d73fae10871616e', 'eb462146d537a8103c0f680d2b4d78cde4fc8529', 'f142ed8356333357fa9cb0873392112907e8a578']) assert.match(dependencies, new RegExp(sha));
	for (const library of ['Arduino_GFX', 'SensorLib', 'XPowersLib'])
		assert.doesNotMatch(dependencies, new RegExp(`${library}\\.git#v\\d`));
});

// AI: below section was generated by an AI
test('peripheral smoke environment is offline and documentation retains the first-write gate', () => {
	const output = execFileSync('pio', ['project', 'config', '--json-output'], {
		cwd: root, encoding: 'utf8', env: {...process.env, PLATFORMIO_PROJECT_CONFIG: 'platformio_tubes.ini'}
	});
	const sections = new Map(JSON.parse(output).map(([name, options]) => [name, Object.fromEntries(options)]));
	const env = sections.get('env:esp32-s3-waveshare-tubes-remote');
	assert.ok(env, 'missing offline S3 peripheral smoke environment');
	assert.equal([].concat(env.custom_usermods).join(' ').trim(), 'WaveshareS3CompileCanary');
	assert.doesNotMatch([].concat(env.custom_usermods).join(' '), /\bTubes\b/);
	assert.match([].concat(env.build_unflags).join(' '), /TUBES_S3_FIELD_OS/);

	const readme = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/README.md'), 'utf8');
	const source = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	assert.match(source, /constexpr int16_t DISPLAY_WIDTH = 480;/);
	assert.match(source, /constexpr int16_t DISPLAY_HEIGHT = 480;/);
	assert.match(readme, /CO5300 480 x 480 AMOLED/i);
	assert.match(readme, /CST9217 480 x 480 touch/i);
	assert.match(readme, /initializes those four peripherals/i);
	assert.match(readme, /cannot join or relay the mesh/i);
	assert.match(readme, /must not be flashed before factory preservation/i);
	assert.match(readme, /Greg's explicit approval/i);
});

test('S3 anchor is explicit, authority-gated, and reports only route observations', () => {
	const api = fs.readFileSync(path.join(root, 'usermods/Tubes/s3_field_api.h'), 'utf8');
	const tubes = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.h'), 'utf8');
	const fieldOs = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	const contract = fs.readFileSync(path.join(root, 'usermods/Tubes/docs/S3_FIELD_OS.md'), 'utf8');

	assert.match(api, /struct TubesS3RouteStatus/);
	assert.match(api, /bool tubesS3SetAnchorAuthority\(bool enabled\)/);
	assert.match(tubes, /bool s3AnchorAuthority = false;/);
	assert.match(tubes, /if \(enabled && !controller\.isMasterRole\(\)\) return false;/);
	assert.match(tubes, /controller\.node\.setMobileConductorAuthority\(enabled\)/);
	assert.match(fieldOs, /F\("Enable anchor"\)/);
	assert.match(fieldOs, /F\("Disable anchor"\)/);
	assert.match(fieldOs, /route\.shell/);
	assert.doesNotMatch(fieldOs, /anchor.*(?:distance|coordinate|meter)/i);
	assert.match(contract, /defaults off after every boot/i);
	assert.match(contract, /does not infer\s+distance or coordinates/i);
});

test('S3 local instrument observes COMMAND_STATE without mutating its virtual strip', () => {
	const controller = fs.readFileSync(path.join(root, 'usermods/Tubes/controller.h'), 'utf8');
	const stateCase = controller.match(/case COMMAND_STATE:\s*\{[\s\S]*?\n      case COMMAND_UPGRADE:/);
	assert.ok(stateCase, 'missing COMMAND_STATE handler');
	assert.match(stateCase[0], /#ifdef TUBES_S3_FIELD_OS[\s\S]*?return true;[\s\S]*?#endif/);
	assert.doesNotMatch(stateCase[0].split('#endif', 1)[0], /load_pattern\(/);
});

test('S3 master/follower controls do not reboot and redraw is bounded', () => {
	const fieldOs = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	assert.doesNotMatch(fieldOs.match(/void onTouch[\s\S]*?\n  \}\n\npublic:/)[0], /ESP\.restart|restart\(/);
	assert.match(fieldOs, /tubesS3SetMasterAuthority\(x >= 240\)/);
	assert.match(fieldOs, /drawConductorTelemetry\(status\);[\s\S]*drawConductorPreview\(status, true\)/);
});

test('S3 field OS does not periodically blank and repaint the AMOLED', () => {
	const source = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	const fieldOs = source.match(/class WaveshareS3FieldOs[\s\S]*?static WaveshareS3FieldOs/);
	assert.ok(fieldOs, 'missing S3 field OS implementation');
	const loop = fieldOs[0].match(/void loop\(\) override \{[\s\S]*?\n  \}/);
	assert.ok(loop, 'missing S3 field OS loop');
	assert.doesNotMatch(loop[0], /now - lastDraw[\s\S]*?draw\(\)/,
		'periodic full-screen repaint causes the visible AMOLED blink');
});

test('S3 Conductor uses the live framebuffer and canonical pattern names', () => {
	const api = fs.readFileSync(path.join(root, 'usermods/Tubes/s3_field_api.h'), 'utf8');
	const tubes = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.h'), 'utf8');
	const patterns = fs.readFileSync(path.join(root, 'usermods/Tubes/pattern.h'), 'utf8');
	const fieldOs = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');

	assert.match(api, /constexpr size_t TUBES_S3_PREVIEW_PIXELS = 60;/);
	assert.match(tubes, /strip\.getPixelColor\(pixel\)/);
	assert.match(tubes, /getPatternName\(status\.patternId, status\.patternName/);
	assert.match(patterns, /extractModeName\(gPatterns\[patternId\]\.wled_fx_id/);
	assert.match(fieldOs, /drawConductorPreview\(status\)/);
	assert.match(fieldOs, /PREVIEW_INTERVAL_MS/);
	assert.match(fieldOs, /no mesh packets heard/);
	assert.match(fieldOs, /SYNCED from %03X/);
	assert.match(fieldOs, /Packets heard; no fresh sync state/);
	assert.doesNotMatch(fieldOs, /display\.printf\("Pattern %u/);
});

test('S3 field telemetry reports real radio, traffic, freshness, and accepted sync evidence', () => {
	const api = fs.readFileSync(path.join(root, 'usermods/Tubes/s3_field_api.h'), 'utf8');
	const node = fs.readFileSync(path.join(root, 'usermods/Tubes/node.h'), 'utf8');
	const tubes = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.h'), 'utf8');
	const fieldOs = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');

	assert.match(api, /bool radioReady/);
	assert.match(api, /uint32_t synchronizedPacketCount/);
	assert.match(node, /peerTelemetry\.observe[\s\S]*receivedPacketCount\+\+/);
	assert.match(node, /message->command == COMMAND_STATE \|\| message->command == COMMAND_BEATS/);
	assert.match(node, /lastSyncSourceId = message->header\.id/);
	assert.match(tubes, /status\.radioReady = espnowBroadcast\.isStarted\(\)/);
	assert.match(tubes, /status\.radioChannel = WiFi\.channel\(\)/);
	assert.match(fieldOs, /TUBE ID     DEVICE #   FOLLOWING   SIGNAL       FRESHNESS/);
	assert.match(fieldOs, /Device # unavailable on peer wire/);
	assert.match(fieldOs, /%u Tubes heard - S3 %s top ID/);
	assert.match(fieldOs, /peer\.latestRssi/);
	assert.match(fieldOs, /display\.print\(F\("--"\)\)/);
	assert.match(fieldOs, /candidate\.nodeId == status\.deviceId/);
	assert.match(fieldOs, /externalCount/);
});

test('S3 Surveyor sorts fresh known RSSI before unknown and ties by device ID', () => {
	const fieldOs = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	assert.match(fieldOs, /candidateKnown != priorKnown/);
	assert.match(fieldOs, /candidate\.latestRssi > prior\.latestRssi/);
	assert.match(fieldOs, /candidate\.nodeId < prior\.nodeId/);
	assert.match(fieldOs, /candidate\.nodeId == status\.deviceId/);
	assert.match(fieldOs, /age > 60000/);
});

test('S3 Surveyor redraw stays bounded and Conductor touch invokes next-pattern semantics', () => {
	const tubes = fs.readFileSync(path.join(root, 'usermods/Tubes/Tubes.h'), 'utf8');
	const fieldOs = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');

	const surveyor = fieldOs.match(/void drawSurveyorTelemetry\(\)[\s\S]*?\n  void drawSurveyor\(\)/);
	assert.ok(surveyor, 'missing Surveyor telemetry renderer');
	assert.doesNotMatch(surveyor[0], /fillRect\(20, 70, 440, 390/,
		'periodic full-body clearing can leave the AMOLED visually blank');
	assert.match(surveyor[0], /TUBE ID     DEVICE #   FOLLOWING   SIGNAL/);
	assert.match(surveyor[0], /display\.print\(F\("--"\)\)/);

	assert.match(fieldOs, /screen == FieldScreen::Conductor && y >= 320 && y < 410/);
	assert.match(fieldOs, /x >= 20 && x < 240\) tubesS3ForcePrevious\(\)/);
	assert.match(fieldOs, /x >= 240 && x < 460\) tubesS3ForceNext\(\)/);
	assert.match(fieldOs, /button\(20, 148, 210, 32[\s\S]*button\(250, 148, 210, 32/,
		'Follower/Master controls must remain compact above the strip');
	assert.match(fieldOs, /button\(20, 320, 210, 90[\s\S]*button\(250, 320, 210, 90/,
		'Previous/Next controls must be equal buttons below the strip');
	assert.match(tubes, /bool s3ForceNext\(\)[\s\S]*controller\.force_next_pattern\(\)/,
		'Next pattern must not use the generic next scheduled event');
	assert.match(tubes, /bool s3ForcePrevious\(\)[\s\S]*controller\.force_previous_pattern\(\)/,
		'Previous pattern must not use the generic next scheduled event');
	assert.match(fieldOs, /TOUCH_DEBOUNCE_MS/);
	assert.match(fieldOs, /if \(!action\) return;/);
	assert.match(fieldOs, /if \(nextScreen != screen\)[\s\S]*?draw\(\);/);
	assert.doesNotMatch(fieldOs.match(/void onTouch[\s\S]*?\n  \}\n\npublic:/)[0], /\n    draw\(\);\n  \}/,
		'held touch must not redraw unconditionally');
});
test('peripheral smoke loop never full-screen repaints and static frame is setup-only', () => {
	const source = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	const smoke = source.match(/class WaveshareS3PeripheralSmoke[\s\S]*?static WaveshareS3PeripheralSmoke/)[0];
	const loop = smoke.match(/void loop\(\) override \{[\s\S]*?\n  \}/)[0];
	assert.doesNotMatch(loop, /fillScreen/);
	assert.match(smoke, /if \(displayReady\) display\.fillScreen\(RGB565_BLACK\);[\s\S]*drawStatus\(\);/);
	assert.match(smoke, /sampleTouch\(\);/);
});

// AI: end
