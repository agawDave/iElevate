import { useEffect } from 'react';
import loginBackground from '../../assets/login-background.jpg';
import elevateLogo from '../../assets/elevate-logo.png';

// The login and signup look: the CTU-Tuburan ELEVATE group photo, softly
// blurred and tinted, behind the whole page. On wide screens the left half shows
// the iELEVATE logo and the page's own text (aside); the form sits in a
// frosted-glass card on the right, with a note under it.
export default function AuthShell({ title, subtitle, children, footer, aside }) {
  // No scrollbar on these pages (see index.css); other pages keep theirs.
  useEffect(() => {
    document.documentElement.classList.add('auth-page');
    return () => document.documentElement.classList.remove('auth-page');
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-900">
      <img src={loginBackground} alt="" aria-hidden="true" className="fixed inset-0 h-full w-full scale-105 object-cover blur-[3px]" />
      <div className="fixed inset-0 bg-gradient-to-b from-brand-900/65 via-brand-900/55 to-brand-900/75" aria-hidden="true" />
      {/* A little more tint on the left, so its text reads well. */}
      <div className="fixed inset-y-0 left-0 hidden w-1/2 bg-gradient-to-r from-brand-900/50 to-transparent lg:block" aria-hidden="true" />
      <div className="relative flex min-h-screen">
        {aside && (
          <aside className="hidden flex-col justify-between p-12 text-white lg:flex lg:w-1/2">
            <span className="inline-flex w-fit rounded-lg bg-white px-3 py-2">
              <img src={elevateLogo} alt="iELEVATE" className="h-11 w-auto" />
            </span>
            {aside}
          </aside>
        )}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
          <div className="w-full max-w-sm">
            <div className="rounded-md border border-white/25 bg-white/15 px-6 py-6 shadow-2xl backdrop-blur-md sm:px-7">
              {/* The logo is on the left on wide screens; in the card otherwise. */}
              <span className={`mb-4 inline-flex rounded-md bg-white px-2.5 py-1.5 ${aside ? 'lg:hidden' : ''}`}>
                <img src={elevateLogo} alt="iELEVATE" className="h-8 w-auto" />
              </span>
              <h1 className="text-lg font-normal uppercase tracking-[0.18em] text-white">{title}</h1>
              <p className="mt-1.5 text-sm text-white/85">{subtitle}</p>
              <div className="mt-5">{children}</div>
            </div>
            {footer && <p className="mt-3 px-2 text-sm text-white/85">{footer}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}

const ICONS = {
  email: <path d="M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4.5 7.8" />,
  password: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />,
  person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
  school: <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Zm3 2v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />,
};

// A rounded field with an icon on the left (and an optional button on the right).
// The label is kept for screen readers; the icon and placeholder show it on screen.
export function PillInput({ id, icon, label, trailing, ...inputProps }) {
  return (
    <div className="flex items-center overflow-hidden rounded-full bg-white/85 focus-within:bg-white focus-within:ring-2 focus-within:ring-white">
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-slate-300/60 text-slate-600" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon]}</svg>
      </span>
      <input id={id} {...inputProps} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-500" />
      {trailing}
    </div>
  );
}

// iELEVATE's main-action orange, with navy text (white on this orange is too faint to read).
export const authButtonClass = 'mx-auto block rounded bg-accent-500 px-7 py-2.5 text-sm font-bold uppercase tracking-wider text-brand-900 shadow transition hover:bg-accent-550 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50';
export const authErrorClass = 'rounded border border-red-300/50 bg-red-600/40 px-3 py-2 text-sm text-white';
export const authLinkClass = 'font-semibold text-white underline underline-offset-2 hover:text-accent-500';
