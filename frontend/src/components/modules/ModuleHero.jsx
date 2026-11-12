import { Link } from 'react-router-dom';
import { TOPIC_GLOW, TopicIcon } from '../ui/TopicFace';
import LineIcon from '../ui/LineIcon';
import { phaseInfo } from '../../lib/topicFaces';
import { avatarTint, initials } from '../../lib/people';

// How far through the activities: a ring with the percentage.
function ProgressRing({ done, total, completed }) {
  const percent = completed ? 100 : total ? Math.round((done / total) * 100) : 0;
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const label = completed ? 'Topic completed' : `${done} of ${total} activities done (${percent}%)`;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 76 76" className="h-full w-full" aria-hidden="true">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth="7" />
        <circle
          cx="38" cy="38" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
          className={completed ? 'text-emerald-400' : 'text-accent-500'} stroke="currentColor"
          strokeDasharray={`${(circumference * percent) / 100} ${circumference}`} transform="rotate(-90 38 38)"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        {completed
          ? <LineIcon name="check" strokeWidth={3} className="h-7 w-7 text-emerald-300" />
          : <><span className="text-[17px] font-extrabold leading-none">{percent}%</span><span className="mt-0.5 text-[10px] text-brand-100">{done} of {total}</span></>}
      </span>
    </div>
  );
}

// The top of a topic's page: its face (icon, phase colour), title and short
// description, a progress ring, their specialist, and the one next thing to do.
//   next: { label, onClick } or { label, to }, or { note } when there's nothing to do but wait
export default function ModuleHero({ module, specialist, progress, completed, chatLink, next }) {
  const info = phaseInfo(module.phase);
  const firstName = specialist.name.split(' ')[0];
  const nextClass = 'rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-accent-550';
  return (
    <section className={`relative mt-3 overflow-hidden rounded-[18px] text-white shadow-[0_10px_28px_-14px_rgb(2_42_73_/_0.4)] ${info.gradient}`}>
      <span className={TOPIC_GLOW} aria-hidden="true" />
      <div className="relative flex flex-wrap items-center gap-5 px-7 py-6">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] border border-white/20 bg-white/[0.12]" aria-hidden="true">
          <TopicIcon slug={module.slug} title={module.title} className="h-[38px] w-[38px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-accent-500">
            {[module.phase, info.name, module.hours && `${module.hours} hours`].filter(Boolean).join(' · ')}
          </p>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight tracking-tight">{module.title}</h1>
          {module.topic && module.topic !== module.title && <p className="text-xs font-semibold text-brand-200">ELEVATE topic: {module.topic}</p>}
          {module.description && <p className="mt-1 text-sm text-brand-100">{module.description}</p>}
        </div>
        {(progress.total > 0 || completed) && <ProgressRing done={progress.done} total={progress.total} completed={completed} />}
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-3 bg-brand-900/55 px-7 py-3.5">
        <div className="flex items-center gap-2.5">
          {specialist.avatar
            ? <img src={specialist.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
            : <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-extrabold ${avatarTint(specialist.name)}`} aria-hidden="true">{initials(specialist.name)}</span>}
          <span>
            <span className="block text-sm font-semibold">{specialist.name}</span>
            <span className="block text-xs text-brand-200">Your specialist</span>
          </span>
          <Link to={chatLink} className="ml-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white/10">
            Chat<span className="sr-only"> with {firstName}</span>
          </Link>
        </div>
        {next?.to && <Link to={next.to} className={nextClass}>{next.label} →</Link>}
        {next?.onClick && <button type="button" onClick={next.onClick} className={nextClass}>{next.label} →</button>}
        {next?.note && <p className="text-sm text-brand-100">{next.note}</p>}
      </div>
    </section>
  );
}
