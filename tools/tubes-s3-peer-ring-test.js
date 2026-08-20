import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(repo, 'usermods/Tubes/node.h'), 'utf8');

class Ring {
  constructor(size) { this.size = size; this.buf = []; this.drops = 0; }
  push(value) { if (this.buf.length === this.size - 1) { this.drops++; return false; } this.buf.push(value); return true; }
  drain() { const out = this.buf; this.buf = []; return out; }
}

test('S3 peer ring wraps, bounds full state, and drains exactly once in order', () => {
  const ring = new Ring(4);
  assert.deepEqual([1, 2, 3].map(v => ring.push(v)), [true, true, true]);
  assert.equal(ring.push(4), false);
  assert.equal(ring.drops, 1);
  assert.deepEqual(ring.drain(), [1, 2, 3]);
  assert.deepEqual([5, 6, 7].map(v => ring.push(v)), [true, true, true]);
  assert.deepEqual(ring.drain(), [5, 6, 7]);
  assert.deepEqual(ring.drain(), []);
});

test('firmware ring publishes payload before release and consumes with acquire', () => {
  assert.match(source, /std::atomic<uint8_t> peerSampleHead/);
  assert.match(source, /std::atomic<uint8_t> peerSampleTail/);
  assert.match(source, /peerSampleHead\.store\(next, std::memory_order_release\)/);
  assert.match(source, /peerSampleHead\.load\(std::memory_order_acquire\)/);
  assert.match(source, /peerSampleDrops\.fetch_add\(1/);
  assert.doesNotMatch(source, /portENTER_CRITICAL/);
});