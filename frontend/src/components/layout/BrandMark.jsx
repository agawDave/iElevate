// The iELEVATE mark, taken from the logo: the "V" turning into the tall orange
// rising stroke of the "A". A white V for the navy headers; onLight = a navy V
// for light backgrounds. Decorative only.
export default function BrandMark({ size = 30, onLight = false }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className={`shrink-0 ${onLight ? 'text-brand-600' : 'text-white'}`}>
      <polyline points="6,20 26,58 54,4" fill="none" stroke="currentColor" strokeWidth="11" strokeLinejoin="miter" strokeMiterlimit="10" />
      <line x1="26" y1="58" x2="54" y2="4" stroke="currentColor" strokeWidth="11" className="text-accent-500" />
    </svg>
  );
}

// "You are here" in orange: the underline on the selected tab.
export const selectedTabMark = 'shadow-[inset_0_-3px_0_theme(colors.accent.500)]';
