import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function loadCorpus() {
	return JSON.parse(await readFile(new URL("migration-fixtures/manifest.json", root), "utf8"));
}

test("migration corpus pins stock WLED 14, 15, 16 and Tubes 13, 14", async () => {
	const corpus = await loadCorpus();
	assert.deepEqual(corpus.fixtures.map(({ id }) => id).sort(), [
		"stock-wled-14-esp32",
		"stock-wled-15-esp32",
		"stock-wled-16-esp32",
		"tubes-v13-dig2go-reconstructed",
		"tubes-v14-christmas-dig2go",
		"tubes-v14-dig2go",
		"tubes-v14-golden-dig2go",
		"tubes-v14-homelight",
		"tubes-v14-master-dig2go",
		"tubes-v14-mauve-dig2go",
		"tubes-v14-ruby-dig2go-source",
	].sort());
});

test("every pinned binary exists and matches its declared length and SHA-256", async () => {
	const corpus = await loadCorpus();
	for (const fixture of corpus.fixtures) {
		if (!fixture.artifact) {
			assert.match(fixture.buildStatus, /known-failed/, `${fixture.id} missing artifact without known failure`);
			assert.ok(fixture.buildFailure, `${fixture.id} missing build failure details`);
			continue;
		}
		const file = new URL(fixture.artifact.path, root);
		assert.equal((await stat(file)).size, fixture.artifact.sizeBytes, `${fixture.id} size`);
		const digest = createHash("sha256").update(await readFile(file)).digest("hex");
		assert.equal(digest, fixture.artifact.sha256, `${fixture.id} SHA-256`);
	}
});

test("old stock and reconstructed firmware are source fixtures, never destination artifacts", async () => {
	const corpus = await loadCorpus();
	for (const fixture of corpus.fixtures.filter((fixture) => fixture.lineage === "stock-wled" || fixture.major < 14)) {
		assert.equal(fixture.installPolicy, "migration-source-only");
	}
	assert.equal(corpus.fixtures.find(({ id }) => id === "tubes-v14-dig2go").installPolicy, "migration-destination");
});

test("legacy behavior variants map to runtime profiles or distinct hardware targets", async () => {
	const corpus = await loadCorpus();
	const runtimeProfiles = JSON.parse(await readFile(new URL("migration-fixtures/runtime-profiles.json", root), "utf8"));
	for (const id of ["golden", "christmas", "ruby", "mauve", "master"]) {
		const profile = corpus.legacyOverrides.find((entry) => entry.id === id);
		assert.equal(profile.migrationDisposition, "runtime-profile");
		assert.equal(profile.requiresExplicitIdentity, true);
		assert.equal(profile.runtimeProfileId, id);
		assert.ok(runtimeProfiles.profiles.some((entry) => entry.id === id));
	}
	const homeLight = corpus.legacyOverrides.find(({ id }) => id === "homelight");
	assert.equal(homeLight.migrationDisposition, "distinct-hardware-target");
	for (const entry of corpus.legacyOverrides) {
		assert.ok(corpus.fixtures.some(({ id }) => id === entry.sourceFixtureId), `${entry.id} source fixture missing`);
	}
	assert.match(
		corpus.fixtures.find(({ id }) => id === "tubes-v14-ruby-dig2go-source").buildStatus,
		/known-failed/,
	);
});
