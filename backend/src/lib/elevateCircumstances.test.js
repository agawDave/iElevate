const test = require('node:test');
const assert = require('node:assert');
const { fitsFreeTime } = require('./elevateCircumstances');

// 2026-11-25 is a Wednesday. Times are Philippine time (+08:00).
const at = (time) => new Date(`2026-11-25T${time}:00+08:00`);

test('a session must fit inside one free block', () => {
  const slots = ['wed-morning', 'wed-evening'];
  assert.ok(fitsFreeTime(slots, at('08:00'), at('12:00')));
  assert.ok(fitsFreeTime(slots, at('19:30'), at('21:00')));
  assert.ok(!fitsFreeTime(slots, at('11:30'), at('12:30')), 'runs past the morning');
  assert.ok(!fitsFreeTime(slots, at('14:00'), at('15:00')), 'afternoon is not free');
  assert.ok(!fitsFreeTime(['thu-morning'], at('09:00'), at('10:00')), 'wrong day');
  assert.ok(!fitsFreeTime([], at('09:00'), at('10:00')), 'no free times set');
});
