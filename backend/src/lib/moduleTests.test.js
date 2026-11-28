const test = require('node:test');
const assert = require('node:assert');
const { faceToFaceDto } = require('./moduleTests');

const row = (minutes, country = null) => ({ module_id: 95, beneficiary_id: 7, hours: 16, minutes, country, post_test_opened_at: null });

test('face-to-face minutes show as hours, to one decimal', () => {
  assert.strictEqual(faceToFaceDto(row(150)).hoursDone, 2.5);
  assert.strictEqual(faceToFaceDto(row(0)).hoursDone, 0);
});

test('beneficiaries outside the Philippines learn online only', () => {
  assert.strictEqual(faceToFaceDto(row(0, 'Japan')).onlineOnly, true);
  assert.strictEqual(faceToFaceDto(row(0, 'Philippines')).onlineOnly, false);
});
