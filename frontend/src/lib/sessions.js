// Helpers for topic learning sessions and the module chat.

export const SESSION_STATUS = {
  pending: { label: 'Waiting for reply', style: 'bg-amber-50 text-amber-800 border-amber-200' },
  confirmed: { label: 'Booked', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  completed: { label: 'Done', style: 'bg-stone-100 text-slate-700 border-stone-200' },
  cancelled: { label: 'Cancelled', style: 'bg-stone-100 text-slate-500 border-stone-200' },
  no_show: { label: 'Missed', style: 'bg-red-50 text-red-700 border-red-200' },
};

export const DURATIONS = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1½ hours' },
  { minutes: 120, label: '2 hours' },
];

export function formatDay(date) {
  return new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatSessionRange(startsAt, endsAt) {
  return `${formatDay(startsAt)} · ${formatTime(startsAt)}–${formatTime(endsAt)}`;
}

// Value for <input type="datetime-local"> in the viewer's time zone.
export function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isLink(value) {
  return /^https?:\/\//i.test(value || '');
}

// "2 days", "5 hours", "a few minutes".
export function waitedFor(since, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000));
  if (minutes < 60) return minutes < 5 ? 'a few minutes' : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// "2:08 PM" today, otherwise "Nov 5".
export function shortWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toDateString() === new Date().toDateString()
    ? formatTime(date)
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
