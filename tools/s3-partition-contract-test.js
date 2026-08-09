const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const {parsePartitions, validatePartitions, validateBinarySize} = require('./s3-partition-contract');

const validCsv = `# Name, Type, SubType, Offset, Size, Flags
nvs,data,nvs,0x9000,0x5000,
otadata,data,ota,0xe000,0x2000,
ota_0,app,ota_0,0x10000,0x600000,
ota_1,app,ota_1,0x610000,0x600000,
spiffs,data,spiffs,0xc10000,0x3e0000,
coredump,data,coredump,0xff0000,0x10000,
`;

function errors(csv = validCsv) {
	return validatePartitions(parsePartitions(csv));
}

test('Waveshare S3 partition contract accepts equal OTA slots with filesystem and coredump', () => {
	assert.deepEqual(errors(), []);
});

test('Waveshare S3 partition contract rejects missing required partitions', () => {
	assert.match(errors(validCsv.replace(/^otadata.*\n/m, '')).join('\n'), /missing required partition: otadata/);
});

test('Waveshare S3 partition contract rejects overlapping partitions', () => {
	assert.match(errors(validCsv.replace('0x610000,0x600000', '0x600000,0x600000')).join('\n'), /overlap/);
});

test('Waveshare S3 partition contract rejects unequal OTA slots', () => {
	assert.match(errors(validCsv.replace('ota_1,app,ota_1,0x610000,0x600000', 'ota_1,app,ota_1,0x610000,0x5f0000')).join('\n'), /equal size/);
});

test('Waveshare S3 partition contract rejects partitions beyond 16MB', () => {
	assert.match(errors(validCsv.replace('0xff0000,0x10000', '0xff0000,0x20000')).join('\n'), /16MB flash/);
});

test('Waveshare S3 partition contract requires 15 percent application headroom', () => {
	assert.deepEqual(validateBinarySize(0x519999, 0x600000), []);
	assert.match(validateBinarySize(0x51999a, 0x600000).join('\n'), /15% headroom/);
});

test('Waveshare S3 environment and compile canary stay on the pinned stack', () => {
	const ini = fs.readFileSync(path.join(root, 'platformio_tubes.ini'), 'utf8');
	const env = ini.match(/\[env:waveshare_s3_tubes_remote\]([\s\S]*?)(?=\n\[|$)/);
	assert.ok(env, 'missing waveshare_s3_tubes_remote environment');
	for (const expected of [
		'extends = env:esp32s3dev_16MB_opi',
		'board_build.partitions = tools/WLED_ESP32S3_WAVESHARE_16MB.csv',
		'-D ARDUINO_USB_CDC_ON_BOOT=1', '-D WAVESHARE_S3_TUBES_REMOTE',
		'github.com/moononournation/Arduino_GFX.git#v1.4.9',
		'github.com/lewisxhe/SensorLib.git#v0.3.3',
		'github.com/lewisxhe/XPowersLib.git#v0.2.6'
	]) assert.match(env[1], new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	assert.doesNotMatch(env[1], /LVGL|1\.6\.4/);
	const canary = fs.readFileSync(path.join(root, 'usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
	for (const token of ['Arduino_ESP32QSPI', 'Arduino_CO5300', 'TouchDrvCST92xx', 'SensorQMI8658', 'XPowersPMU']) assert.match(canary, new RegExp(token));
	assert.doesNotMatch(canary, /\.begin\s*\(/);
});
