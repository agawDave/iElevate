import { phaseInfo, topicIconPath } from '../../lib/topicFaces';

// A soft orange glow in the top-right corner of the navy topic faces.
export const TOPIC_GLOW = 'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(254,129,1,0.28),transparent_45%)]';

export function TopicIcon({ slug, title, className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={topicIconPath(slug, title)} />
    </svg>
  );
}

const TILE_SIZES = {
  sm: { box: 'h-9 w-9 rounded-[10px]', icon: 'h-5 w-5' },
  md: { box: 'h-11 w-11 rounded-xl', icon: 'h-[22px] w-[22px]' },
};

// The topic's icon on a small tile in its phase's navy (lists, rows).
export function TopicTile({ slug, title, phase, size = 'md' }) {
  const { box, icon } = TILE_SIZES[size] || TILE_SIZES.md;
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden text-white ${box} ${phaseInfo(phase).gradient}`} aria-hidden="true">
      <TopicIcon slug={slug} title={title} className={`relative ${icon}`} />
    </span>
  );
}

// The band across the top of a topic card: icon, phase, phase name and hours.
export function TopicBand({ slug, title, phase, hours }) {
  const info = phaseInfo(phase);
  return (
    <div className={`relative flex items-center gap-3.5 px-6 py-4 text-white ${info.gradient}`}>
      <span className={TOPIC_GLOW} aria-hidden="true" />
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/20 bg-white/[0.12]" aria-hidden="true">
        <TopicIcon slug={slug} title={title} className="h-[26px] w-[26px]" />
      </span>
      <span className="relative min-w-0">
        <span className="block text-[12px] font-bold uppercase tracking-[0.12em] text-accent-500">{phase}</span>
        <span className="block truncate text-[13px] text-brand-100">{[info.name, hours && `${hours} hours`].filter(Boolean).join(' · ')}</span>
      </span>
    </div>
  );
}
