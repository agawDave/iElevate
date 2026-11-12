import { selectedTabMark } from '../layout/BrandMark';

// Learning | Career, at the top of the portfolio. The tab is kept in the
// address (?tab=career) so Print and refresh stay on it. onNavy: inside the
// navy page header.
export default function PortfolioTabs({ tab, onChange, onNavy = false }) {
  const tabs = [['learning', 'Learning'], ['career', 'Career']];
  const style = (selected) => (onNavy
    ? (selected ? `border-white bg-white text-brand-700 ${selectedTabMark}` : 'border-white/20 bg-white/10 text-white hover:bg-white/20')
    : (selected ? `border-brand-600 bg-brand-600 text-white ${selectedTabMark}` : 'border-stone-300 bg-white text-slate-700 hover:bg-stone-50'));
  return (
    <div className={`flex gap-2 print:hidden ${onNavy ? '' : 'mb-5'}`} role="tablist" aria-label="Portfolio">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={tab === value}
          onClick={() => onChange(value)}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${style(tab === value)}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
