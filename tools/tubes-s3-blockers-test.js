import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const nodeSource = fs.readFileSync(path.join(repo, 'usermods/Tubes/node.h'), 'utf8');
const controllerSource = fs.readFileSync(path.join(repo, 'usermods/Tubes/controller.h'), 'utf8');

test('valid NodeMessage telemetry is staged only by the pre-routing observer', () => {
  const observerStart = nodeSource.lastIndexOf('static void onEspNowObserver');
  const observerEnd = nodeSource.indexOf('static bool onEspNowFilter', observerStart);
  assert.ok(observerStart >= 0 && observerEnd > observerStart, 'observer definition is present');
  const observer = nodeSource.slice(observerStart, observerEnd);
  assert.equal((observer.match(/peerSampleRing\[head\]/g) ?? []).length, 1);
  const peerData = nodeSource.match(/void onPeerData\([\s\S]*?MeshRoutePlan route/);
  assert.ok(peerData, 'peer data handler is present');
  assert.equal((peerData[0].match(/peerSampleRing|peerTelemetry\.observe\(/g) ?? []).length, 0);
});

test('Previous wraps to the last registered pattern', () => {
  const previous = controllerSource.match(/void force_previous_pattern\(\) \{[\s\S]*?\n  }/);
  assert.ok(previous, 'previous-pattern handler is present');
  assert.match(previous[0], /current_state\.pattern_id == 0 \? gPatternCount - 1 : current_state\.pattern_id - 1/);
  assert.doesNotMatch(previous[0], /\? 255/);
});
