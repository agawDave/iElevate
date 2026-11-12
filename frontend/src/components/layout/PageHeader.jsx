import BrandMark, { selectedTabMark } from './BrandMark';

// The navy header at the top of each page: title, a line about the page, its
// main buttons, and an optional row below (key numbers, or tabs). The faint
// rising-peak pattern (brand-pattern in index.css) instead of the dashboards'
// photo. Hidden when printing.
export default function PageHeader({ eyebrow, title, subtitle, actions, children }) {
  return (
    <section className="brand-pattern relative mb-6 overflow-hidden rounded-2xl text-white print:hidden">
      <div className="relative p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            {eyebrow && <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-accent-500">{eyebrow}</p>}
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight"><BrandMark size={30} />{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-brand-100">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </section>
  );
}

// A number in the header. With onClick it's a tab (selected = white).
// alert = orange dot (something new); dot = red dot with its own label (e.g. waiting for your reply).
// compact = one line (number then label), for the admin pages' slim header.
export function HeaderStat({ value, label, selected = false, onClick, alert = false, dot = '', compact = false }) {
  const look = selected ? `border-white bg-white text-brand-700 ${selectedTabMark}` : `border-white/20 bg-white/10 text-white ${onClick ? 'hover:bg-white/20' : ''}`;
  const className = compact
    ? `flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left transition ${look}`
    : `flex min-w-[7.5rem] flex-col rounded-xl border px-4 py-2.5 text-left transition ${look}`;
  const content = (
    <>
      <span className={`flex items-center gap-1.5 font-extrabold tabular-nums ${compact ? 'text-base' : 'text-xl'}`}>
        {value}
        {alert && <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />}
        {dot && <span className="h-2.5 w-2.5 rounded-full bg-red-500" title={dot} aria-hidden="true" />}
        {dot && <span className="sr-only">({dot})</span>}
      </span>
      <span className={`text-xs font-medium ${selected ? 'text-brand-600' : 'text-brand-100'}`}>{label}</span>
    </>
  );
  if (!onClick) return <div className={className}>{content}</div>;
  return <button type="button" role="tab" aria-selected={selected} onClick={onClick} className={className}>{content}</button>;
}

// A secondary button on the navy header.
export const headerButtonClass = 'rounded-lg border border-white/60 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10';
export const headerPrimaryClass = 'rounded-lg bg-accent-500 px-4 py-2 text-sm font-bold text-brand-900 transition hover:bg-accent-550 disabled:opacity-50';
