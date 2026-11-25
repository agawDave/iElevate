const test = require('node:test');
const assert = require('node:assert');
const { faceToFaceDto } = require('./moduleTests');

const row = (minutes, country = null) => ({ module_id: 95, beneficiary_id: 7, hours: 16, minutes, country, post_test_opened_at: null });

test('the post-test can be opened once the face-to-face hours reach the module hours', () => {
  assert.deepStrictEqual(
    [faceToFaceDto(row(0)).ready, faceToFaceDto(row(16 * 60 - 1)).ready, faceToFaceDto(row(16 * 60)).ready],
    [false, false, true]
  );
  assert.strictEqual(faceToFaceDto(row(150)).hoursDone, 2.5);
});

test('beneficiaries outside the Philippines learn online only, so they need no hours', () => {
  assert.strictEqual(faceToFaceDto(row(0, 'Japan')).ready, true);
  assert.strictEqual(faceToFaceDto(row(0, 'Philippines')).ready, false);
});
