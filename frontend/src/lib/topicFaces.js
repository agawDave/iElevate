// Each ELEVATE topic's "face": an icon, on its phase's shade of navy, and a
// short name for each phase (shown on the journey, the phase headings and the
// topic bands).

export const PHASES = {
  1: { name: 'Computer & online basics', gradient: 'bg-gradient-to-br from-brand-500 to-brand-400' },
  2: { name: 'Working online', gradient: 'bg-gradient-to-br from-brand-600 to-brand-500' },
  3: { name: 'Digital business', gradient: 'bg-gradient-to-br from-brand-700 to-brand-600' },
};
const OTHER_PHASE = { name: '', gradient: 'bg-gradient-to-br from-brand-700 to-brand-600' };

// "ELEVATE Phase 2" -> 2
export function phaseNumber(phase) {
  return Number(String(phase || '').match(/\d+/)?.[0]) || null;
}

export function phaseInfo(phase) {
  const number = phaseNumber(phase);
  return { number, ...(PHASES[number] || OTHER_PHASE) };
}

// Line-icon paths (24×24) per topic slug.
const ICONS = {
  monitor: 'M5 4h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 16H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 4Zm3 16h8m-4-4v4',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4',
  slides: 'M3 4h18M5 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4M12 15v4m-4 2 4-2 4 2M9 8h6M9 11h4',
  sheet: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm-1 6h16M4 15h16M10 4v16',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  speech: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12ZM8.5 11h7M8.5 14h4',
  briefcase: 'M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm4 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18',
  store: 'M4 10h16M5 10l1.2-5h11.6L19 10M6 10v9h12v-9M10 19v-5h4v5',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  browser: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 5h18M7 6.5h.01M10 6.5h.01M8 13h8M8 16h5',
  headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H5a1 1 0 0 1-1-1v-4Zm16 0h-3v5h2a1 1 0 0 0 1-1v-4Z',
  megaphone: 'M4 10v4h3l7 4V6l-7 4H4Zm14-1a4 4 0 0 1 0 6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  growth: 'M4 19l6-6 4 4 6-8m-5 0h5v5',
  book: 'M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2m0-13c1.5-1.5 4-2 8-2v13c-4 0-6.5.5-8 2m0-13v13',
};

const BY_SLUG = {
  'elevate-basic-computer-operation': 'monitor',
  'elevate-google-document': 'doc',
  'elevate-google-slides': 'slides',
  'elevate-google-spreadsheet': 'sheet',
  'elevate-basic-internet-operation': 'globe',
  'elevate-english-communication': 'speech',
  'elevate-freelancing-101': 'briefcase',
  'elevate-online-marketplace': 'store',
  'elevate-work-from-home-setup': 'home',
  'elevate-wordpress': 'browser',
  'elevate-virtual-assistant': 'headset',
  'elevate-digital-marketing-intro': 'megaphone',
  'elevate-core-digital-marketing': 'target',
  'elevate-digital-business': 'growth',
};

// Topics without a slug (or new ones) are matched by words in the title.
const BY_WORD = [
  [/computer/i, 'monitor'], [/document|docs/i, 'doc'], [/slide/i, 'slides'], [/sheet|excel/i, 'sheet'],
  [/internet/i, 'globe'], [/english|communication/i, 'speech'], [/freelanc/i, 'briefcase'], [/marketplace/i, 'store'],
  [/home/i, 'home'], [/wordpress|website/i, 'browser'], [/assistant/i, 'headset'], [/marketing/i, 'megaphone'], [/business/i, 'growth'],
];

export function topicIconPath(slug, title = '') {
  const name = BY_SLUG[slug] || BY_WORD.find(([pattern]) => pattern.test(title))?.[1] || 'book';
  return ICONS[name];
}
