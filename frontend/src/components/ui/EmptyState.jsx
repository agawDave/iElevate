import { Link } from 'react-router-dom';
import LineIcon from './LineIcon';
import BrandMark from '../layout/BrandMark';

// "Nothing here yet", with a little life: an icon in a soft circle, a short
// title, one line about what to do, and (if there's something to do) one action.
//   icon:   a LineIcon name, or 'brand' for the iELEVATE mark
//   action: { label, to } (a link) or { label, onClick }; primary = orange
export default function EmptyState({ icon = 'inbox', title, children, action, primary = false, compact = false, className = '' }) {
  const circle = primary ? 'bg-accent-50 text-accent-600' : 'bg-brand-50 text-brand-600';
  const buttonClass = primary
    ? 'mt-4 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-accent-550'
    : 'mt-3 rounded-lg bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100';
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-4' : 'px-4 py-6'} ${className}`}>
      <span className={`mb-3 flex items-center justify-center rounded-full ${circle} ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}>
        {icon === 'brand' ? <BrandMark size={compact ? 20 : 24} onLight /> : <LineIcon name={icon} className={compact ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'} />}
      </span>
      {title && <p className="text-sm font-bold text-slate-800">{title}</p>}
      {children && <div className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">{children}</div>}
      {action && (action.to
        ? <Link to={action.to} className={buttonClass}>{action.label}</Link>
        : <button type="button" onClick={action.onClick} className={buttonClass}>{action.label}</button>)}
    </div>
  );
}
