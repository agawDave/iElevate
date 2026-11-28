import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import AppFooter from '../components/layout/AppFooter';
import AuthPanel from '../components/auth/AuthPanel';
import { headerPrimaryClass } from '../components/layout/PageHeader';
import elevateLogo from '../assets/elevate-logo.png';
import loginBackground from '../assets/login-background.jpg';

const STEPS = [
  { title: 'Take the pre-assessment', text: 'Tell us your goal and how well you can do a few everyday tasks. Your answers pick the topics you learn.' },
  { title: 'Learn with a specialist', text: 'Apply to a specialist for each topic and study the materials they share. They can also set face-to-face sessions.' },
  { title: 'Earn your certificate', text: 'Take the post-test when your specialist opens it. Your certificate then goes into your portfolio.' },
];

const wrap = 'mx-auto w-full max-w-6xl px-4 sm:px-6';

// The first page people see: what iELEVATE is, how it works and the ELEVATE
// phases. Log in and Sign up (also /login and /signup) slide in a card over it.
// Numbers and phases come from the database. Behind the whole page: the
// CTU-Tuburan ELEVATE group photo, tinted navy.
export default function LandingPage() {
  const { user } = useAuth();
  const [facts, setFacts] = useState(null);
  // /login and /signup open their panel over this page.
  const { pathname } = useLocation();
  const authMode = { '/login': 'login', '/signup': 'signup' }[pathname];

  useEffect(() => {
    axiosClient.get('/public/program').then((response) => setFacts(response.data.data)).catch(() => {});
  }, []);

  if (user) return <Navigate to="/dashboard" replace />;

  const stats = facts && [
    { value: facts.topics, label: 'Training topics' },
    { value: facts.phases, label: 'Program phases' },
    { value: facts.hours, label: 'Training hours' },
  ];

  return (
    <div className="relative min-h-screen bg-brand-900 text-white">
      {/* The CTU-Tuburan ELEVATE group photo, softly blurred and tinted navy, behind the whole page. */}
      <img src={loginBackground} alt="" aria-hidden="true" className="fixed inset-0 h-full w-full scale-105 object-cover blur-[3px]" />
      <div className="fixed inset-0 bg-gradient-to-b from-brand-900/70 via-brand-900/60 to-brand-900/80" aria-hidden="true" />
      <div className="relative flex min-h-screen flex-col">
      <section>
        <header className={`${wrap} flex items-center justify-between gap-4 py-5`}>
          <span className="inline-flex rounded-lg bg-white px-3 py-2">
            <img src={elevateLogo} alt="iELEVATE" className="h-9 w-auto sm:h-11" />
          </span>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <a href="#how-it-works" className="hidden rounded-lg px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white md:inline-block">How it works</a>
            <a href="#phases" className="hidden rounded-lg px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white md:inline-block">Phases</a>
            <Link to="/login" className="rounded-lg px-3 py-2 text-white hover:bg-white/10">Log in</Link>
          </nav>
        </header>

        <div className={`${wrap} pb-12 pt-12 sm:pt-16`}>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Learn by doing.
            <span className="block text-accent-500">Grow by sharing.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-brand-100 sm:text-lg">
            iELEVATE is the online home of CTU-Tuburan&apos;s ELEVATE program. Take a quick pre-assessment, learn the topics you need with a specialist, and earn certificates for your portfolio.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link to="/signup" className={headerPrimaryClass}>Get started</Link>
            <Link to="/login" className="text-sm font-semibold text-white underline-offset-4 hover:underline">I already have an account</Link>
          </div>
        </div>
      </section>

      {/* The program's numbers. */}
      <div className={wrap}>
        {stats && <dl className="grid grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center px-2 py-5 text-center">
              <dt className="order-2 text-xs text-brand-100 sm:text-sm">{stat.label}</dt>
              <dd className="order-1 text-2xl font-extrabold tabular-nums text-accent-500 sm:text-3xl">{stat.value}</dd>
            </div>
          ))}
        </dl>}
      </div>

      <section id="how-it-works" className={`${wrap} py-16`}>
        <h2 className="text-2xl font-extrabold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-white/15 bg-white/10 p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500 text-sm font-bold text-brand-900">{index + 1}</span>
              <h3 className="mt-3 font-bold">{step.title}</h3>
              <p className="mt-1 text-sm text-brand-100">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {facts?.phaseList?.length > 0 && (
        <section id="phases" className={`${wrap} pb-16`}>
          <h2 className="text-2xl font-extrabold tracking-tight">The ELEVATE phases</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {facts.phaseList.map((phase) => (
              <li key={phase.number} className="rounded-2xl border border-white/15 bg-white/10 p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent-500">Phase {phase.number}</p>
                <h3 className="mt-1 font-bold">{phase.name}</h3>
                <p className="mt-1 text-sm text-brand-100">{phase.topics} topic{phase.topics === 1 ? '' : 's'} · {phase.hours} hours</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A darker navy band across the bottom (at the bottom of the window on tall screens). */}
      <div className="mt-auto bg-brand-900/80">
        <div className={wrap}><AppFooter dark /></div>
      </div>
      </div>
      {authMode && <AuthPanel mode={authMode} />}
    </div>
  );
}
