'use strict';

const fs = require('node:fs');

const FLASH_SIZE = 16 * 1024 * 1024;
const REQUIRED = ['nvs', 'otadata', 'ota_0', 'ota_1', 'spiffs'];

function number(value) {
	if (!value) return undefined;
	const suffix = value.match(/^([0-9]+)([KMG])$/i);
	if (suffix) return Number(suffix[1]) * {K: 1024, M: 1024 ** 2, G: 1024 ** 3}[suffix[2].toUpperCase()];
	return Number.parseInt(value, 0);
}

function parsePartitions(csv) {
	let nextOffset;
	return csv.split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).filter(Boolean).map(line => {
		const fields = line.split(',').map(value => value.trim());
		const offset = number(fields[3]) ?? nextOffset;
		const size = number(fields[4]);
		const partition = {name: fields[0], type: fields[1], subtype: fields[2], offset, size};
		nextOffset = offset + size;
		return partition;
	});
}

function validatePartitions(partitions) {
	const errors = [];
	const byName = new Map(partitions.map(partition => [partition.name, partition]));
	for (const name of REQUIRED) if (!byName.has(name)) errors.push(`missing required partition: ${name}`);
	const ordered = [...partitions].sort((a, b) => a.offset - b.offset);
	for (let index = 1; index < ordered.length; index++) {
		if (ordered[index].offset < ordered[index - 1].offset + ordered[index - 1].size)
			errors.push(`partition overlap: ${ordered[index - 1].name} and ${ordered[index].name}`);
	}
	for (const partition of partitions) {
		if (partition.offset + partition.size > FLASH_SIZE) errors.push(`${partition.name} extends beyond 16MB flash`);
	}
	const ota0 = byName.get('ota_0');
	const ota1 = byName.get('ota_1');
	if (ota0 && ota1 && ota0.size !== ota1.size) errors.push('OTA slots must have equal size');
	return errors;
}

function validateBinarySize(binarySize, slotSize) {
	return binarySize * 100 <= slotSize * 85 ? [] :
		[`application size ${binarySize} leaves less than required 15% headroom in OTA slot ${slotSize}`];
}

if (require.main === module) {
	const [csvPath, binaryPath] = process.argv.slice(2);
	if (!csvPath) {
		console.error('usage: node tools/s3-partition-contract.js PARTITIONS.csv [firmware.bin]');
		process.exit(2);
	}
	const partitions = parsePartitions(fs.readFileSync(csvPath, 'utf8'));
	const errors = validatePartitions(partitions);
	if (binaryPath) {
		const ota0 = partitions.find(partition => partition.name === 'ota_0');
		if (ota0) errors.push(...validateBinarySize(fs.statSync(binaryPath).size, ota0.size));
	}
	if (errors.length) {
		console.error(errors.join('\n'));
		process.exit(1);
	}
	console.log('S3 partition and application-size contract satisfied');
}

module.exports = {parsePartitions, validatePartitions, validateBinarySize};
