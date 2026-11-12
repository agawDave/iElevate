// The specialist's optional rubric on a written or file-task answer:
// three criteria scored from 1 to 4, all or none.
export const RUBRIC_ITEMS = [
  { key: 'content', label: 'Content' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'effort', label: 'Effort' },
];
export const EMPTY_RUBRIC = { content: null, completeness: null, effort: null };
const SCORES = [1, 2, 3, 4];

export const rubricTotal = (rubric) => RUBRIC_ITEMS.reduce((sum, item) => sum + (rubric[item.key] || 0), 0);

// "Rubric 11 of 12 · Content 4 · Completeness 3 · Effort 4"
export function RubricSummary({ rubric, className = '' }) {
  if (!rubric) return null;
  return (
    <p className={`text-sm text-slate-700 ${className}`}>
      <span className="font-semibold">Rubric {rubricTotal(rubric)} of {RUBRIC_ITEMS.length * 4}</span>
      {RUBRIC_ITEMS.map((item) => <span key={item.key} className="text-slate-500"> · {item.label} {rubric[item.key]}</span>)}
    </p>
  );
}

// Pressing the chosen score again clears it.
export function RubricInput({ value, onChange }) {
  const scored = RUBRIC_ITEMS.filter((item) => value[item.key]).length;
  return (
    <fieldset className="mt-2">
      <legend className="text-xs font-medium text-slate-600">Rubric <span className="font-normal text-slate-500">(optional, 1 = needs work, 4 = excellent)</span></legend>
      <div className="mt-1 space-y-1">
        {RUBRIC_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className="w-28 text-sm text-slate-700">{item.label}</span>
            <div className="flex gap-1" role="radiogroup" aria-label={item.label}>
              {SCORES.map((score) => {
                const selected = value[item.key] === score;
                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${item.label} ${score}`}
                    onClick={() => onChange({ ...value, [item.key]: selected ? null : score })}
                    className={`h-7 w-7 rounded-full border text-xs font-semibold ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-slate-600 hover:border-brand-400'}`}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {scored === RUBRIC_ITEMS.length && <p className="mt-1 text-xs font-semibold text-slate-700">Total {rubricTotal(value)} of {RUBRIC_ITEMS.length * 4}</p>}
    </fieldset>
  );
}
