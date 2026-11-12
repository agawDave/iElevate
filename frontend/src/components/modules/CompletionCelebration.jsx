import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../layout/BrandMark';
import LineIcon from '../ui/LineIcon';
import { openCertificate } from '../../lib/certificates';
import ctuSeal from '../../assets/seal-ctu.webp';
import bsitSeal from '../../assets/seal-ctu-tuburan-bsit.webp';

// Shown on a topic's page once the specialist marks it completed: congratulations,
// the pre/post-test result, a small certificate card, and what to do next.
// Closing it leaves a one-line "Completed" strip (remembered in this browser).

const CONFETTI_COLORS = ['#FE8101', '#033962', '#1E7A4C', '#FFC98A', '#4F7BA3'];

// Confetti only around the edges (a band along the top, clear of the close
// button, and a few down each side), so it never sits behind the words or the
// certificate card. Falls once; none with reduced motion.
const CONFETTI = [
  ...Array.from({ length: 16 }, (_, i) => ({ left: `${3 + ((i * 37) % 86)}%`, top: 4 + ((i * 11) % 16) })),
  ...Array.from({ length: 4 }, (_, i) => ({ left: `${4 + ((i * 3) % 6)}px`, top: `${34 + i * 15}%` })),
  ...Array.from({ length: 4 }, (_, i) => ({ right: `${4 + ((i * 3) % 6)}px`, top: `${30 + i * 16}%` })),
].map((spot, i) => ({
  ...spot,
  width: i % 3 ? 7 : 5,
  height: i % 2 ? 13 : 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  spin: (i * 47) % 180,
  delay: (i % 8) * 70,
}));

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '';
}

function storageKey(userId, moduleId) {
  return `ielevate:celebrated:${userId}:${moduleId}`;
}

// The one line about the next topic.
function UpNext({ topic }) {
  if (!topic) return <p className="mt-4 text-sm text-slate-600">That&apos;s every topic in your plan. Well done!</p>;
  const link = (to) => <Link to={to} className="font-bold text-brand-600 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600">{topic.title}</Link>;
  const lines = {
    assigned: <>{link(`/modules/${topic.id}`)}: continue where you left off.</>,
    suggested: <>{link('/modules')}: apply to a specialist to start it.</>,
    pending: <>{link('/modules?tab=incoming')}: waiting for {topic.specialist || 'a specialist'} to accept you.</>,
    queued: <>{link('/modules')}: see it in Modules.</>,
    waiting: <>{link('/modules')}: waiting for a specialist who fits your schedule.</>,
  };
  return <p className="mt-4 text-sm text-slate-600">Up next: {lines[topic.status] || link('/modules')}</p>;
}

function CertificateButtons({ certificate, compact = false }) {
  const [error, setError] = useState('');
  const primary = compact
    ? 'rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700'
    : 'rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-accent-550';
  const secondary = compact
    ? 'rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-800 underline-offset-2 hover:underline'
    : 'rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700';
  function view() {
    setError('');
    openCertificate(certificate.id).catch(() => setError('Unable to open the certificate. Try again, or open it from My Portfolio.'));
  }
  return (
    <>
      <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'mt-5 gap-2.5'}`}>
        {certificate.hasFile
          ? <button type="button" onClick={view} className={primary}>View certificate</button>
          : <Link to="/portfolio" className={primary}>See it in My Portfolio</Link>}
        {certificate.hasFile && <Link to="/portfolio" className={secondary}>{compact ? 'My Portfolio' : 'See it in My Portfolio'}</Link>}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </>
  );
}

// The small certificate card on the right: the program's mark, who it is for,
// the topic, the seals, who issued it and when. A picture, so screen readers skip it.
function CertificateCard({ learnerName, module, issuedBy, day }) {
  return (
    <div className="mx-auto w-full max-w-[290px] rotate-[1.5deg] rounded-[10px] bg-white p-[7px] shadow-[0_14px_30px_-12px_rgb(2_42_73_/_0.35)]" aria-hidden="true">
      <div className="rounded-md border-2 border-brand-600 bg-[radial-gradient(circle_at_50%_0%,#F5F8FB,#fff_70%)] px-4 pb-3 pt-4 text-center">
        <span className="flex justify-center"><BrandMark size={22} onLight /></span>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-600">Certificate of completion</p>
        <p className="mt-2 text-[11px] text-stone-500">This certifies that</p>
        <p className="text-lg font-extrabold leading-tight text-brand-700">{learnerName}</p>
        <p className="mt-1 text-[11px] text-stone-500">completed</p>
        <p className="text-[13px] font-bold leading-snug text-slate-900">{module.title}</p>
        <p className="text-[10.5px] text-stone-500">{[module.phase, module.hours && `${module.hours} hours`].filter(Boolean).join(' · ')}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="flex gap-1">
            <img src={ctuSeal} alt="" className="h-[26px] w-[26px] rounded-full" />
            <img src={bsitSeal} alt="" className="h-[26px] w-[26px] rounded-full" />
          </span>
          <span className="text-right text-[10px] leading-tight text-slate-500">{issuedBy}<br />{day}</span>
        </div>
      </div>
    </div>
  );
}

export default function CompletionCelebration({ userId, learnerName, module, certificate, test, nextTopic }) {
  const key = storageKey(userId, module.id);
  const [closed, setClosed] = useState(() => {
    try { return window.localStorage.getItem(key) === '1'; } catch { return false; }
  });
  const day = formatDay(certificate.issuedAt);
  const issued = `${certificate.issuedBy} issued your certificate${day ? ` on ${day}` : ''}.`;

  function close() {
    setClosed(true);
    try { window.localStorage.setItem(key, '1'); } catch { /* private window: it shows again next time */ }
  }

  if (closed) {
    return (
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm text-emerald-900">
          <LineIcon name="check" strokeWidth={2.5} className="h-4 w-4 shrink-0 text-emerald-600" />
          <span><span className="font-semibold">Completed.</span> {issued}</span>
        </p>
        <CertificateButtons certificate={certificate} compact />
      </div>
    );
  }

  const firstName = (learnerName || '').split(' ')[0];
  const gain = test?.pre && test?.post ? test.post.score - test.pre.score : null;
  return (
    <section
      aria-labelledby="celebration-title"
      className="pop-enter relative mt-5 overflow-hidden rounded-[18px] border border-accent-100 bg-gradient-to-b from-[#FFF7EE] via-white to-white shadow-[0_10px_28px_-14px_rgb(2_42_73_/_0.18)]"
    >
      <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden="true">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className="confetti-piece absolute rounded-[2px] opacity-90"
            style={{
              left: piece.left, right: piece.right, top: piece.top, width: piece.width, height: piece.height,
              background: piece.color, transform: `rotate(${piece.spin}deg)`, '--spin': `${piece.spin}deg`, animationDelay: `${piece.delay}ms`,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Close the congratulations"
        title="Close"
        className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-slate-400 transition hover:bg-white hover:text-slate-700"
      >
        ×
      </button>
      <div className="relative grid items-center gap-7 px-7 pb-7 pt-8 md:grid-cols-[1fr_290px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-600">Topic completed</p>
          <h2 id="celebration-title" className="mt-1.5 text-[26px] font-extrabold leading-tight tracking-tight text-brand-700">
            Congratulations{firstName ? `, ${firstName}` : ''}!
          </h2>
          <p className="mt-1.5 text-[15px] text-slate-600">
            You finished <span className="font-bold text-slate-800">{module.title}</span>. {issued}
          </p>
          {test?.post && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-bold text-emerald-700">
              {test.pre && <>Pre-test {test.pre.score}/{test.pre.total} <span aria-hidden="true">→</span><span className="sr-only">then</span> </>}
              Post-test {test.post.score}/{test.post.total}
              {gain > 0 && <> · +{gain}</>}
            </p>
          )}
          <CertificateButtons certificate={certificate} />
          <UpNext topic={nextTopic} />
        </div>
        <CertificateCard learnerName={learnerName} module={module} issuedBy={certificate.issuedBy} day={day} />
      </div>
    </section>
  );
}
