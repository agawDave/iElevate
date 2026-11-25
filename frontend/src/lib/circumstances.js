// Learning circumstances used for specialist matching.
// Keep values in sync with backend/src/lib/elevateCircumstances.js.

export const LEARNING_MODES = [
  {
    value: 'face_to_face',
    label: 'Face-to-face',
    description: 'In-person sessions at CTU-Tuburan or a barangay venue.',
  },
  {
    value: 'online',
    label: 'Online',
    description: 'Live video classes such as Zoom. Needs a device and internet.',
  },
  {
    value: 'radio',
    label: 'Radio',
    description: 'Lessons broadcast on BT Radio, with self-paced materials.',
  },
];

export const DAYS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

export const TIME_BLOCKS = [
  { value: 'morning', label: 'Morning', hint: '8 AM – 12 NN', from: 8, to: 12 },
  { value: 'afternoon', label: 'Afternoon', hint: '1 – 5 PM', from: 13, to: 17 },
  { value: 'evening', label: 'Evening', hint: '6 – 9 PM', from: 18, to: 21 },
];

export const DEVICE_OPTIONS = [
  { value: 'computer', label: 'I have my own computer or laptop' },
  //{ value: 'smartphone', label: 'I only have a smartphone' },
  { value: 'none', label: 'I don’t have a device I can use' },
];

export const INTERNET_OPTIONS = [
  { value: 'stable', label: 'Stable internet at home' },
  { value: 'slow', label: 'Slow or unreliable internet' },
  { value: 'none', label: 'No internet at home' },
];

// Places (barangay, city) are typed in; see lib/places.js for the PSGC regions.

export function slotKey(day, time) {
  return `${day}-${time}`;
}

// "Mon, Wed morning (8 AM – 12 NN) · Sat evening (6 – 9 PM)"
export function describeFreeTimes(slots) {
  return TIME_BLOCKS.map((time) => {
    const days = DAYS.filter((day) => slots.includes(slotKey(day.value, time.value))).map((day) => day.label);
    return days.length ? `${days.join(', ')} ${time.label.toLowerCase()} (${time.hint})` : null;
  }).filter(Boolean).join(' · ');
}

// Start times every 30 minutes where a session of this length fits inside a
// free block on that date ("2026-11-25"). Philippine time (UTC+8), like the server check.
export function freeStartTimes(slots, date, minutes, now = Date.now()) {
  if (!date) return [];
  const day = DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7].value;
  return TIME_BLOCKS.filter((time) => slots.includes(slotKey(day, time.value))).flatMap((block) => {
    const starts = [];
    for (let m = block.from * 60; m + minutes <= block.to * 60; m += 30) {
      const hour = Math.floor(m / 60);
      const value = `${String(hour).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const label = `${((hour + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
      if (new Date(`${date}T${value}:00+08:00`).getTime() > now) starts.push({ value, label, block });
    }
    return starts;
  });
}
