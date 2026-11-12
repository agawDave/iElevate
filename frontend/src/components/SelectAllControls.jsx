// "Check all · Clear selection" for any group of checkboxes (advisor's general
// rule). Pass onCheckAll to show "Check all"; onClear is always shown.
export default function SelectAllControls({ onCheckAll, onClear, allChecked = false, noneChecked = false, label }) {
  const buttonClass = 'rounded px-1.5 py-0.5 font-medium text-brand-600 hover:bg-brand-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent';
  return (
    <span className="inline-flex items-center gap-1 text-xs" role="group" aria-label={label ? `Select ${label}` : 'Selection'}>
      {onCheckAll && (
        <>
          <button type="button" onClick={onCheckAll} disabled={allChecked} className={buttonClass}>Check all</button>
          <span className="text-slate-300" aria-hidden="true">·</span>
        </>
      )}
      <button type="button" onClick={onClear} disabled={noneChecked} className={buttonClass}>Clear selection</button>
    </span>
  );
}
