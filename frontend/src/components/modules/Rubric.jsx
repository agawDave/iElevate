// The specialist's rubric on a past written or file-task answer (shown in the
// portfolio): three criteria scored from 1 to 4.
const RUBRIC_ITEMS = [
  { key: 'content', label: 'Content' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'effort', label: 'Effort' },
];
const rubricTotal = (rubric) => RUBRIC_ITEMS.reduce((sum, item) => sum + (rubric[item.key] || 0), 0);

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
