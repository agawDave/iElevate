import { Link } from 'react-router-dom';
import loginBackground from '../../assets/login-background.jpg';
import BrandMark from '../layout/BrandMark';

// Pieces shared by the dashboards: the navy banner, number tiles, cards,
// session rows and a progress bar.

const ICONS = {
  progress: <path d="M12 3a9 9 0 1 0 9 9M12 3v9l6.4 6.4" />,
  check: <path d="M20 6 9 17l-5-5" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  clock: <path d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  users: <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm10 9v-1.5a3.5 3.5 0 0 0-2.5-3.35M15 4.15a3.5 3.5 0 0 1 0 6.7" />,
  inbox: <path d="M4 13h4l1.5 3h5L16 13h4M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z" />,
  doc: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4" />,
  award: <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5-1L7 21l5-3 5 3-1.5-7" />,
  board: <path d="M3 4h18M5 4v10h14V4M12 14v3m-4 4 4-4 4 4" />,
};

export function Icon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// A dashboard section. The main one sits in a white card; `plain` sections
// (the side lists) sit on the page, with a line between them (put them in a
// SideColumn), so the page has fewer boxes.
export function Card({ title, link, children, className = '', plain = false }) {
  const box = plain ? 'px-1 py-6 last:pb-1' : 'rounded-2xl border border-stone-200 bg-white p-5';
  return (
    <section className={`${box} ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-slate-900">{title}</h2>
        {link && <Link to={link.to} className="shrink-0 text-sm font-medium text-brand-600 hover:underline">{link.label} →</Link>}
      </div>
      {children}
    </section>
  );
}

// The right-hand column of plain sections, with a line between them.
export function SideColumn({ children, className = '' }) {
  return <div className={`divide-y divide-stone-200 ${className}`}>{children}</div>;
}

// The navy banner: greeting and a line under it.
export function DashboardBanner({ title, subtitle }) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-brand-600 text-white">
      <img src={loginBackground} alt="" aria-hidden="true" className="absolute inset-y-0 right-0 h-full w-2/3 object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-600 via-brand-600/95 to-brand-600/40" aria-hidden="true" />
      <div className="relative p-6 sm:p-8">
        <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight"><BrandMark size={32} />{title}</h1>
        <p className="mt-1 text-brand-100">{subtitle}</p>
      </div>
    </section>
  );
}

// tiles: [{ key, label, icon, style, to, alert? }], values: { [key]: number }
export function StatTiles({ tiles, values }) {
  return (
    <div className="mb-7 grid grid-cols-2 gap-5 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          to={tile.to}
          className={`flex items-center gap-4 rounded-2xl border bg-white p-4 transition hover:border-brand-300 hover:shadow-sm ${tile.alert && values[tile.key] ? 'border-accent-500' : 'border-stone-200'}`}
        >
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile.style}`}><Icon name={tile.icon} /></span>
          <span className="min-w-0">
            <span className="block text-2xl font-extrabold tabular-nums text-brand-600">{values[tile.key]}</span>
            <span className="block text-xs text-slate-500">{tile.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export const smallButton = 'shrink-0 rounded-lg bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100';

export function ProgressBar({ done, total, label }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label}>
      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

// person = the other person in the session (the specialist for a learner, the learner for a specialist).
export function SessionRow({ session, person }) {
  const starts = new Date(session.startsAt);
  const badge = session.needsMyAnswer
    ? { label: 'Needs your answer', style: 'bg-amber-50 text-amber-800' }
    : session.status === 'confirmed'
      ? { label: 'Confirmed', style: 'bg-emerald-50 text-emerald-700' }
      : { label: `Waiting for ${person.split(' ')[0]}`, style: 'bg-stone-100 text-slate-600' };
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-600 text-white">
        <span className="text-lg font-extrabold leading-none">{starts.getDate()}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{starts.toLocaleDateString([], { month: 'short' })}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{session.topic}</p>
        <p className="text-xs text-slate-500">with {person} · {starts.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.style}`}>{badge.label}</span>
    </li>
  );
}
