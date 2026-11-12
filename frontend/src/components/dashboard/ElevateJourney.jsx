import LineIcon from '../ui/LineIcon';
import { phaseInfo } from '../../lib/topicFaces';

// "Your ELEVATE journey": one step per program phase, with a tick on the ones
// done, the orange "you are here" step, and the ones still to come. A phase the
// skill check found nothing to learn in shows as not needed.
const STATE_LABELS = { done: 'Done', skipped: 'Not needed', now: 'You are here', next: 'Coming next' };

function Dot({ step, number }) {
  if (step.state === 'done') {
    return <span className="relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-emerald-600 text-white"><LineIcon name="check" strokeWidth={3} className="h-[18px] w-[18px]" /></span>;
  }
  if (step.state === 'skipped') {
    return <span className="relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 text-emerald-600"><LineIcon name="check" strokeWidth={3} className="h-4 w-4" /></span>;
  }
  if (step.state === 'now') {
    return <span className="relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-accent-500 font-extrabold text-brand-900 ring-[6px] ring-accent-50">{number}</span>;
  }
  return <span className="relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-stone-200 bg-white font-extrabold text-slate-500">{number}</span>;
}

function note(step) {
  if (step.state === 'skipped') return 'Your skill check says you know these';
  if (step.state === 'done') return `All ${step.total} topic${step.total === 1 ? '' : 's'} completed`;
  const shown = step.topics.slice(0, 2).join(' · ');
  return step.topics.length > 2 ? `${shown} and ${step.topics.length - 2} more` : shown;
}

export default function ElevateJourney({ journey }) {
  if (!journey?.length) return null;
  const now = journey.findIndex((step) => step.state === 'now');
  const allDone = now === -1 && journey.every((step) => ['done', 'skipped'].includes(step.state));
  return (
    <section className="mb-7 rounded-2xl border border-stone-200 bg-white px-6 py-5">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-slate-900">Your ELEVATE journey</h2>
        <span className="text-sm text-slate-500">{allDone ? 'All phases complete' : now >= 0 ? `Phase ${phaseInfo(journey[now].phase).number || now + 1} of ${journey.length}` : ''}</span>
      </div>
      <ol className="grid gap-y-5" style={{ gridTemplateColumns: `repeat(${journey.length}, minmax(0, 1fr))` }} aria-label="Your ELEVATE journey">
        {journey.map((step, index) => {
          const info = phaseInfo(step.phase);
          const number = info.number || index + 1;
          const nextStep = journey[index + 1];
          // The line to the next step: green once the journey has reached it, light orange from where you are, grey ahead.
          const line = !nextStep ? null
            : nextStep.state !== 'next' ? 'bg-emerald-500'
              : step.state === 'now' ? 'bg-accent-200' : 'bg-stone-200';
          return (
            <li key={step.phase} className="relative pr-4">
              {line && <span className={`absolute left-[34px] right-0 top-[15px] h-[3px] rounded-full ${line}`} aria-hidden="true" />}
              <Dot step={step} number={number} />
              <p className={`mt-2.5 text-[12px] font-bold uppercase tracking-[0.1em] ${step.state === 'now' ? 'text-accent-600' : 'text-slate-500'}`}>
                Phase {number} · {STATE_LABELS[step.state]}
              </p>
              <p className="text-[15px] font-bold text-slate-900">{info.name || step.phase}</p>
              <p className="text-[12.5px] leading-snug text-slate-500">{note(step)}</p>
              {step.state === 'now' && (
                <p className="mt-1 text-xs font-semibold text-brand-600">
                  {step.completed} of {step.total} completed{step.started ? ` · ${step.started} in progress` : ''}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
