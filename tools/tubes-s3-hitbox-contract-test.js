import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(import.meta.dirname, '../usermods/WaveshareS3CompileCanary/WaveshareS3CompileCanary.cpp'), 'utf8');
test('S3 hitboxes keep navigation boundaries and intentional gaps explicit', () => {
  assert.match(source, /screen != FieldScreen::Home && x >= 360 && y <= 75/);
  assert.match(source, /screen == FieldScreen::Home/);
  assert.match(source, /screen == FieldScreen::Conductor && y >= 92 && y < 156 && \(x >= 257 && x < 441\)/);
  assert.match(source, /Follow\/Master hit rects match.*gap does nothing/);
  assert.match(source, /screen == FieldScreen::Conductor && y >= 320 && y < 410/);
  assert.match(source, /screen == FieldScreen::Anchor && x >= 40 && x < 440 && y >= 325 && y < 425/);
});