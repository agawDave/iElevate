// Learning circumstances used to match a beneficiary with the specialist
// whose situation aligns with theirs. Keep these values in sync with
// frontend/src/lib/circumstances.js.

const LEARNING_MODES = ['face_to_face', 'online', 'radio'];
const MODE_LABELS = {
  face_to_face: 'face-to-face sessions',
  online: 'online classes',
  radio: 'radio lessons',
};
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const TIME_BLOCKS = ['morning', 'afternoon', 'evening'];
const AVAILABILITY_SLOTS = DAYS.flatMap((day) => TIME_BLOCKS.map((time) => `${day}-${time}`));
const DEVICE_ACCESS = ['computer', 'smartphone', 'none'];
const INTERNET_ACCESS = ['stable', 'slow', 'none'];
const MAX_BARANGAY_LENGTH = 100;

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanBarangay(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

// "Daang-Lungsod", "daang lungsod" and "Daang Lungsod" compare as equal.
function barangayKey(value) {
  return cleanBarangay(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function circumstancesFromRow(row) {
  return {
    learningModes: parseList(row?.learning_modes).filter((mode) => LEARNING_MODES.includes(mode)),
    availability: parseList(row?.availability).filter((slot) => AVAILABILITY_SLOTS.includes(slot)),
    deviceAccess: row?.device_access || null,
    internetAccess: row?.internet_access || null,
    // Where the person is, from their Profile address. Specialists hold
    // face-to-face sessions where they are, so this is their service area too.
    barangay: row?.barangay || null,
    city: row?.city || null,
    area: row?.province || row?.state_region || null,
    country: row?.country || null,
  };
}

// A beneficiary needs a place (barangay, or city outside the Philippines)
// so face-to-face specialists can be compared.
function isComplete(circumstances, userType) {
  if (!circumstances.learningModes.length || !circumstances.availability.length) return false;
  if (userType === 'beneficiary') {
    return Boolean(circumstances.deviceAccess && circumstances.internetAccess
      && (circumstances.barangay || circumstances.city));
  }
  return userType === 'specialist';
}

// Online classes need a device and an internet connection.
function feasibleModes(circumstances) {
  if (!circumstances?.learningModes?.length) return null;
  const offline = circumstances.deviceAccess === 'none' || circumstances.internetAccess === 'none';
  return circumstances.learningModes.filter((mode) => !(mode === 'online' && offline));
}

function uniqueValidList(value, allowed) {
  if (!Array.isArray(value)) return null;
  if (value.some((item) => !allowed.includes(item))) return null;
  return allowed.filter((item) => value.includes(item));
}

function validateCircumstances(body, userType) {
  const input = body || {};
  const learningModes = uniqueValidList(input.learningModes, LEARNING_MODES);
  if (!learningModes || !learningModes.length) {
    return { error: 'Choose at least one learning mode.' };
  }
  const availability = uniqueValidList(input.availability, AVAILABILITY_SLOTS);
  if (!availability || !availability.length) {
    return { error: 'Choose at least one day and time you are available.' };
  }

  if (userType === 'beneficiary') {
    if (!DEVICE_ACCESS.includes(input.deviceAccess)) return { error: 'Tell us which device you can use.' };
    if (!INTERNET_ACCESS.includes(input.internetAccess)) return { error: 'Tell us about your internet connection.' };
    // Barangay is normally edited on the Profile; when it's left out here the
    // saved one is kept (undefined), but an empty or too-long one is rejected.
    let barangay;
    if (input.barangay !== undefined) {
      barangay = cleanBarangay(input.barangay);
      if (!barangay || barangay.length > MAX_BARANGAY_LENGTH) return { error: 'Enter your barangay.' };
    }
    const value = {
      learningModes,
      availability,
      deviceAccess: input.deviceAccess,
      internetAccess: input.internetAccess,
      barangay,
      serviceBarangays: [],
    };
    if (!feasibleModes(value).length) {
      return { error: 'Online classes need a device and an internet connection. Also choose face-to-face or radio.' };
    }
    return { value };
  }

  // Specialists' face-to-face place is their Profile address, so the barangay
  // saved from the Profile is kept (undefined) and no typed list is stored.
  return {
    value: {
      learningModes,
      availability,
      deviceAccess: null,
      internetAccess: null,
      barangay: undefined,
      serviceBarangays: [],
    },
  };
}

function joinWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

// ["mon-morning", "wed-morning", "sat-afternoon"] -> "Mon and Wed mornings, Sat afternoon"
function describeSlots(slots) {
  return TIME_BLOCKS
    .map((time) => {
      const days = DAYS.filter((day) => slots.includes(`${day}-${time}`)).map((day) => DAY_LABELS[day]);
      if (!days.length) return null;
      return `${joinWords(days)} ${time}${days.length > 1 ? 's' : ''}`;
    })
    .filter(Boolean)
    .join(', ');
}

// Compares one beneficiary with one specialist who teaches the topic.
// Unknown circumstances (not filled in yet) neither block nor add to a match.
function evaluateMatch(learner, specialist) {
  const reasons = [];
  let score = 0;

  const learnerModes = feasibleModes(learner);
  const specialistModes = specialist?.learningModes?.length ? specialist.learningModes : null;
  let sharedModes = learnerModes || specialistModes;
  if (learnerModes && specialistModes) {
    sharedModes = learnerModes.filter((mode) => specialistModes.includes(mode));
    if (!sharedModes.length) return { eligible: false, blocker: 'mode' };
    score += 30;
    reasons.push(`Offers ${joinWords(sharedModes.map((mode) => MODE_LABELS[mode]))}, which you can attend`);
    const offline = learner.deviceAccess === 'none' || learner.internetAccess === 'none';
    if (offline) {
      reasons.push('You won’t need your own device or internet for these sessions');
    } else if (learner.internetAccess === 'slow' && sharedModes.length === 1 && sharedModes[0] === 'online') {
      score -= 15;
    }
  }

  const learnerSlots = learner?.availability?.length ? learner.availability : null;
  const specialistSlots = specialist?.availability?.length ? specialist.availability : null;
  if (learnerSlots && specialistSlots) {
    const overlap = AVAILABILITY_SLOTS.filter((slot) => learnerSlots.includes(slot) && specialistSlots.includes(slot));
    if (!overlap.length) return { eligible: false, blocker: 'schedule' };
    score += 10 * Math.min(overlap.length, 6);
    reasons.push(`Free at the same times as you: ${describeSlots(overlap)}`);
  }

  // Face-to-face distance from both Profile addresses. Names like "Poblacion"
  // repeat across towns, so a barangay only counts inside the same city, and a
  // city only inside the same province (or state) and country.
  const sameValue = (a, b) => Boolean(a && b && barangayKey(a) === barangayKey(b));
  if ((!sharedModes || sharedModes.includes('face_to_face'))
    && sameValue(learner?.country, specialist?.country)
    && sameValue(learner?.area, specialist?.area)
    && sameValue(learner?.city, specialist?.city)) {
    if (sameValue(learner.barangay, specialist.barangay)) {
      score += 20;
      reasons.push(`Lives in your barangay, ${learner.barangay}, so face-to-face sessions are close by`);
    } else {
      score += 10;
      reasons.push(`Lives in ${learner.city}, so face-to-face sessions are close by`);
    }
  }

  return { eligible: true, score: Math.max(0, score), reasons };
}

function describeWaiting(topicTitle, evaluations) {
  if (!evaluations.length) return `No specialist teaches ${topicTitle} yet.`;
  const blockers = new Set(evaluations.map((evaluation) => evaluation.blocker));
  if (blockers.size === 1 && blockers.has('schedule')) {
    return `The ${topicTitle} specialists are not free at the times you chose.`;
  }
  if (blockers.size === 1 && blockers.has('mode')) {
    return `The ${topicTitle} specialists do not offer a learning mode you can attend.`;
  }
  return `No ${topicTitle} specialist fits both your schedule and your learning mode yet.`;
}

module.exports = {
  LEARNING_MODES,
  AVAILABILITY_SLOTS,
  DEVICE_ACCESS,
  INTERNET_ACCESS,
  circumstancesFromRow,
  isComplete,
  validateCircumstances,
  evaluateMatch,
  describeWaiting,
  describeSlots,
  cleanBarangay,
  MAX_BARANGAY_LENGTH,
};
