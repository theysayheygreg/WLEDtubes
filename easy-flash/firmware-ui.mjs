export function classifyFirmwareCatalog(manifest) {
	const groups = new Map();
	for (const variant of manifest.variants) {
		const targetKey = [variant.target.chip, variant.target.hardwareFamily, variant.target.board, variant.target.flashSizeBytes].join(":");
		if (!groups.has(targetKey)) groups.set(targetKey, []);
		groups.get(targetKey).push(variant);
	}
	const hardwareTargets = [];
	const parkedExperiments = [];
	for (const variants of groups.values()) {
		const selected = variants.find((variant) => variant.status === "stable") || variants[0];
		hardwareTargets.push(selected);
		parkedExperiments.push(...variants.filter((variant) => variant !== selected));
	}
	return { hardwareTargets, parkedExperiments };
}

export function makeFirmwareOperationReceipt(variant, artifact, now = new Date()) {
	return { createdAt: now.toISOString(), variantId: variant.id, transport: artifact.transport, artifactSha256: artifact.sha256, target: variant.target, partition: variant.partition, sourceCommit: variant.source.commit, result: "prepared-not-written" };
}
