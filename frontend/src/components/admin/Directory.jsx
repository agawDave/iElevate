import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { HeaderStat } from '../layout/PageHeader';
import BrandMark from '../layout/BrandMark';
import { SkeletonTableRows } from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { avatarTint, initials } from '../../lib/people';

// Shared building blocks for the admin directories. Search, filters, sort and
// page live in the URL, so the back button and shared links keep them, and
// the server returns one page at a time.
export function useDirectory(endpoint, defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ rows: [], pagination: null, extra: {}, loading: true, error: '' });
  const params = { ...defaults, ...Object.fromEntries(searchParams.entries()) };
  const key = JSON.stringify(params);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    const query = JSON.parse(key);
    axiosClient.get(endpoint, { params: query })
      .then((response) => {
        const { data, pagination, success, ...extra } = response.data;
        setState({ rows: data, pagination, extra, loading: false, error: '' });
      })
      .catch((error) => setState((current) => ({ ...current, loading: false, error: error.response?.data?.message || 'Unable to load this list.' })));
  }, [endpoint, key]);

  useEffect(() => { load(); }, [load]);

  // Several changes at once (one URL update), e.g. { topicId: '', topics: 'none' }.
  function setParams(updates) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([name, value]) => {
      if (value === '' || value === undefined || value === null || value === defaults[name]) next.delete(name);
      else next.set(name, value);
    });
    if (!('page' in updates)) next.delete('page');
    setSearchParams(next, { replace: Object.keys(updates).length === 1 && 'q' in updates });
  }

  function setParam(name, value) {
    setParams({ [name]: value });
  }

  // Clears the filters, keeping the params named in `keep` (e.g. the tab in the header).
  function clearAll(keep = []) {
    const next = new URLSearchParams();
    (Array.isArray(keep) ? keep : []).forEach((name) => {
      if (searchParams.get(name)) next.set(name, searchParams.get(name));
    });
    setSearchParams(next);
  }

  return { ...state, params, setParam, setParams, clearAll, reload: load };
}

export function SearchBox({ value, onChange, placeholder, label = 'Search' }) {
  const [text, setText] = useState(value || '');
  const timer = useRef(null);
  useEffect(() => { setText(value || ''); }, [value]);
  return (
    <div className="relative w-full shrink-0 sm:w-72">
      <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.48l4.32 4.32a1 1 0 01-1.42 1.42l-4.32-4.32A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
      <input
        type="search"
        aria-label={label}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onChange(next.trim()), 300);
        }}
        className="w-full rounded-lg border border-transparent bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-accent-500"
      />
    </div>
  );
}

// Filters sit on the dark strip of the admin header: light labels, white controls.
export const filterLabelClass = 'flex items-center gap-2 text-xs font-medium text-brand-100';
export const filterInputClass = 'rounded-lg border border-transparent bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-accent-500';
export const clearButtonClass = 'ml-auto text-sm font-semibold text-white underline-offset-2 hover:underline';

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className={filterLabelClass}>
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className={`max-w-[15rem] py-2 ${filterInputClass}`}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

// The compact navy header of each admin page: the title (and a short line under
// it) with the tabs beside it and the page's buttons on the right; `below` is
// an extra row (e.g. key numbers); the search and filters (children) sit on a
// plain dark strip at the bottom. Hidden when printing.
export function AdminHeader({ title, meta, tabs, actions, below, children }) {
  return (
    <section className="brand-pattern relative mb-5 overflow-hidden rounded-2xl text-white print:hidden">
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><BrandMark size={26} />{title}</h1>
          {meta && <p className="text-xs text-brand-100">{meta}</p>}
        </div>
        {tabs}
        {actions && <div className="ml-auto flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {below && <div className="relative px-5 pb-4">{below}</div>}
      {children && <div className="relative flex flex-wrap items-center gap-3 bg-brand-900 px-5 py-3">{children}</div>}
    </section>
  );
}

// Tabs in the admin header, each with its count: [{ value, label, count, alert? }].
export function HeaderTabs({ label, tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <HeaderStat
          key={tab.value || 'all'}
          compact
          value={tab.count === undefined ? '—' : Number(tab.count).toLocaleString()}
          label={tab.label}
          selected={(value || '') === tab.value}
          alert={Boolean(tab.alert)}
          onClick={() => onChange(tab.value)}
        />
      ))}
    </div>
  );
}

// The filters used less often, behind a button; it shows how many are on.
// Put it after the main filters: when open, its filters take a row of their own.
export function MoreFilters({ active = 0, children }) {
  const [open, setOpen] = useState(active > 0);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
      >
        {open ? 'Fewer filters' : 'More filters'}{active > 0 ? ` (${active})` : ''}
      </button>
      {open && <div className="order-last flex w-full flex-wrap items-center gap-3">{children}</div>}
    </>
  );
}

// Their profile photo, or their initials (in their own tint) when they have none (or it fails to load).
export function Avatar({ name, src, className = 'h-9 w-9 text-xs' }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  if (src && !broken) {
    return <img src={src} alt={`${name}'s profile photo`} onError={() => setBroken(true)} className={`${className} shrink-0 rounded-full bg-stone-100 object-cover`} />;
  }
  return <span className={`${className} flex shrink-0 items-center justify-center rounded-full font-bold ${avatarTint(name)}`} aria-hidden="true">{initials(name)}</span>;
}

// The top of a details panel: a large photo (click to see it full size), name and email.
export function ProfileHeader({ name, email, src, status }) {
  const photo = <Avatar name={name} src={src} className="h-20 w-20 text-xl" />;
  return (
    <div className="flex items-center gap-4">
      {src ? <a href={src} target="_blank" rel="noopener noreferrer" title="See the full photo" className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{photo}</a> : photo}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">{name}{status && status !== 'active' && <StatusBadge status={status} />}</p>
        {email && <p className="truncate text-sm text-slate-500">{email}</p>}
        {!src && <p className="text-xs text-slate-400">No profile photo yet</p>}
      </div>
    </div>
  );
}

// A person in a table: photo (or initials), name, and a line under it (usually the email).
// status: their account status, shown only when it isn't active (so problems stand out).
export function PersonCell({ name, detail, note, status, avatar }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar name={name} src={avatar} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 font-medium text-slate-900">
          {name}
          {note && <span className="text-xs font-normal text-slate-500">{note}</span>}
          {status && status !== 'active' && <StatusBadge status={status} />}
        </span>
        {detail && <span className="block text-xs text-slate-500">{detail}</span>}
      </span>
    </span>
  );
}

export function Pagination({ pagination, onPage, noun = 'results' }) {
  // An empty list already says so in its own message.
  if (!pagination || !pagination.total) return null;
  const { page, pageSize, total, totalPages } = pagination;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 text-sm text-slate-600">
      <span>{total ? `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()} ${noun}` : `No ${noun}`}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-50 disabled:opacity-40">Previous</button>
          <span className="tabular-nums">Page {page} of {totalPages.toLocaleString()}</span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-50 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

// With onRowClick, each row opens its details, and ends with a "View" button
// (so it's clear the row opens, and it works from the keyboard).
export function DirectoryTable({ columns, rows, rowKey = 'id', onRowClick, viewLabel = 'View', loading, error, emptyText, selectedKey }) {
  const span = columns.length + (onRowClick ? 1 : 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((column) => <th key={column.key} className={`px-4 py-3 font-semibold ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>)}
            {onRowClick && <th className="px-4 py-3"><span className="sr-only">Details</span></th>}
          </tr>
        </thead>
        <tbody>
          {error ? (
            <tr><td colSpan={span} className="px-4 py-8 text-center text-red-600" role="alert">{error}</td></tr>
          ) : loading && !rows.length ? (
            <SkeletonTableRows columns={span} />
          ) : !rows.length ? (
            <tr><td colSpan={span}><EmptyState icon="search" title={emptyText} compact className="py-8" /></td></tr>
          ) : rows.map((row) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-stone-100 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-stone-50' : ''} ${String(selectedKey) === String(row[rowKey]) ? 'bg-brand-50' : ''} ${loading ? 'opacity-60' : ''}`}
            >
              {columns.map((column) => (
                <td key={column.key} className={`px-4 py-3 align-middle ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
              {onRowClick && (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); onRowClick(row); }}
                    className="whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                  >
                    {viewLabel} →
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Slide-over details panel; Escape or the backdrop closes it.
export function DetailPanel({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-slate-900/30" />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none text-slate-500 hover:bg-stone-100" aria-label="Close">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

export function StatusBadge({ status }) {
  const styles = {
    active: 'bg-emerald-50 text-emerald-700',
    suspended: 'bg-amber-50 text-amber-800',
    banned: 'bg-red-50 text-red-700',
    deleted: 'bg-stone-100 text-slate-500',
    pending: 'bg-amber-50 text-amber-800',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${styles[status] || 'bg-stone-100 text-slate-600'}`}>{status}</span>;
}

export function DetailRow({ label, children }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-800">{children || '—'}</dd>
    </div>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

// A date in a table cell, kept on one line.
export function DateCell({ value }) {
  return <span className="whitespace-nowrap">{formatDate(value)}</span>;
}

export const STATUS_FILTER = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
];
