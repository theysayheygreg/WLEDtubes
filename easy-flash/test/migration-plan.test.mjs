import assert from "node:assert/strict";
import test from "node:test";

import { planMigration } from "../migration-plan.mjs";

const target = {
	hardwareTargetId: "dig2go-classic-esp32-4mb-dio",
	firmwareFixtureId: "tubes-v14-dig2go",
	configurationSchema: 2,
};

for (const source of [
	{ lineage: "stock-wled", major: 14 },
	{ lineage: "stock-wled", major: 15 },
	{ lineage: "stock-wled", major: 16 },
	{ lineage: "tubes", major: 13 },
]) {
	test(`${source.lineage} ${source.major} installs and verifies Tubes before configuration`, () => {
		const plan = planMigration({
			...source,
			hardwareTargetId: target.hardwareTargetId,
			identityConfidence: "exact",
			configurationSchema: source.lineage === "stock-wled" ? source.major : 1,
		}, target);
		assert.equal(plan.status, "ready");
		assert.deepEqual(plan.steps.map(({ operation }) => operation), [
			"backup-configuration",
			"install-firmware",
			"verify-firmware",
			"apply-configuration",
			"verify-configuration",
		]);
		assert.equal(plan.steps[1].fixtureId, "tubes-v14-dig2go");
		assert.equal(plan.steps[3].minimumVerifiedFirmwareFixtureId, "tubes-v14-dig2go");
	});
}

test("Tubes v14 verifies current firmware before applying configuration", () => {
	const plan = planMigration({
		lineage: "tubes",
		major: 14,
		hardwareTargetId: target.hardwareTargetId,
		identityConfidence: "exact",
		firmwareFixtureId: "tubes-v14-dig2go",
		configurationSchema: 1,
	}, target);
	assert.deepEqual(plan.steps.map(({ operation }) => operation), [
		"backup-configuration",
		"verify-firmware",
		"apply-configuration",
		"verify-configuration",
	]);
});

test("ambiguous hardware fails before configuration or firmware selection", () => {
	const plan = planMigration({
		lineage: "stock-wled",
		major: 16,
		hardwareTargetId: null,
		identityConfidence: "ambiguous",
		configurationSchema: 16,
	}, target);
	assert.equal(plan.status, "blocked");
	assert.deepEqual(plan.steps, []);
	assert.match(plan.reason, /exact hardware identity/i);
});

test("special legacy variants require an explicit migration profile", () => {
	const plan = planMigration({
		lineage: "tubes",
		major: 13,
		hardwareTargetId: target.hardwareTargetId,
		identityConfidence: "exact",
		firmwareVariant: "golden",
		configurationSchema: 1,
	}, target);
	assert.equal(plan.status, "blocked");
	assert.match(plan.reason, /variant migration profile/i);
});

test("missing explicit LED bus permits only a narrow preflash hardware transform", () => {
	const plan = planMigration({
		lineage: "stock-wled",
		major: 14,
		hardwareTargetId: target.hardwareTargetId,
		identityConfidence: "exact",
		requiresExplicitBusBeforeFirmware: true,
	}, target);
	assert.deepEqual(plan.steps.map(({ operation }) => operation), [
		"backup-configuration",
		"normalize-hardware-output",
		"install-firmware",
		"verify-firmware",
		"apply-configuration",
		"verify-configuration",
	]);
	assert.equal(plan.steps[1].scope, "explicit-led-bus-only");
});

test("explicitly identified special variant migrates to its matching runtime profile after firmware verification", () => {
	const plan = planMigration({
		lineage: "tubes",
		major: 13,
		hardwareTargetId: target.hardwareTargetId,
		identityConfidence: "exact",
		firmwareVariant: "golden",
		variantMigrationProfileId: "golden",
	}, { ...target, runtimeProfileId: "golden" });
	assert.equal(plan.status, "ready");
	assert.equal(plan.steps.find(({ operation }) => operation === "apply-configuration").runtimeProfileId, "golden");
	assert.ok(plan.steps.findIndex(({ operation }) => operation === "verify-firmware")
		< plan.steps.findIndex(({ operation }) => operation === "apply-configuration"));
});
