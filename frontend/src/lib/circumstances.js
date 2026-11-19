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
  { value: 'morning', label: 'Morning', hint: '8 AM – 12 NN' },
  { value: 'afternoon', label: 'Afternoon', hint: '1 – 5 PM' },
  { value: 'evening', label: 'Evening', hint: '6 – 9 PM' },
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
