// Skill-check results: one row per topic with its level (0 to 3), band, and
// what happens next. Mirrors the scoring in backend/src/lib/elevateSkillCheck.js.

const BAND_LABELS = {
  beginner: 'Beginner',
  developing: 'Developing',
  proficient: 'Proficient',
  strong: 'Strong',
};

const BAND_STYLES = {
  beginner: 'bg-amber-50 text-amber-800',
  developing: 'bg-sky-50 text-sky-800',
  proficient: 'bg-emerald-50 text-emerald-800',
  strong: 'bg-emerald-100 text-emerald-900',
};

const GROUPS = [
  {
    key: 'active',
    outcomes: ['active'],
    title: 'Learning now',
    hint: 'Each of these is matched with a specialist.',
  },
  {
    key: 'next_up',
    outcomes: ['next_up'],
    title: 'Next up',
    hint: 'These start as you finish your current topics. Retake the pre-assessment after training to move them up.',
  },
  {
    key: 'done',
    outcomes: ['refresher', 'peer_helper'],
    title: 'Already on your own',
    hint: 'You said you can do these on your own, so no training is needed.',
  },
];

// Level 0 / 1 / 2 = the learner's answer: Never / With help / On my own.
const ANSWER_LABELS = ['You answered: Never', 'You answered: With help', 'You answered: On my own'];

function AnswerNote({ level }) {
  const label = ANSWER_LABELS[Math.round(level)];
  return label ? <span className="text-xs text-slate-500">{label}</span> : null;
}

export default function SkillCheckResults({ results }) {
  if (!results?.length) {
    return <p className="text-sm text-slate-500">No pre-assessment results yet.</p>;
  }

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const rows = results.filter((result) => group.outcomes.includes(result.outcome));
        if (!rows.length) return null;
        return (
          <section key={group.key}>
            <h3 className="text-sm font-semibold text-slate-800">
              {group.title} <span className="font-normal text-slate-500">({rows.length})</span>
            </h3>
            <p className="mb-2 text-xs text-slate-500">{group.hint}</p>
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
              {rows.map((result) => (
                <li key={result.slug} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{result.title}</p>
                    {result.reason && <p className="text-xs text-slate-500">{result.reason}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <AnswerNote level={Number(result.level)} />
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[result.band] || 'bg-stone-100 text-slate-600'}`}>
                      {BAND_LABELS[result.band] || result.band}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
