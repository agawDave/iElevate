// Initials for someone without a photo, e.g. "Maria Santos" -> "MS".
export function initials(name = '') {
  return String(name || '').split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// Each person's initials get the same soft tint every time (from their name),
// from a small on-brand palette, so lists of people don't look all alike.
const TINTS = [
  'bg-brand-50 text-brand-700',
  'bg-accent-50 text-accent-700',
  'bg-teal-50 text-teal-700',
  'bg-violet-50 text-violet-700',
  'bg-sky-50 text-sky-700',
];

export function avatarTint(name = '') {
  const sum = [...String(name || '')].reduce((total, char) => total + char.charCodeAt(0), 0);
  return TINTS[sum % TINTS.length];
}
