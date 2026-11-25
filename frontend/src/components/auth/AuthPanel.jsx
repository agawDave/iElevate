import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import elevateLogo from '../../assets/elevate-logo.png';

// Log in and Sign up, in a panel that slides in from the right over the landing
// page (/login and /signup). Switching between them stays in the panel.

const ICONS = {
  email: <path d="M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4.5 7.8" />,
  password: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />,
  person: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
  school: <path d="M3 9.5 12 5l9 4.5-9 4.5-9-4.5Zm3 2v4.5c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />,
};

// A rounded field with an icon on the left (and an optional button on the right).
// The label is kept for screen readers; the icon and placeholder show it on screen.
function PillInput({ id, icon, label, trailing, ...inputProps }) {
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
const buttonClass = 'mx-auto block rounded bg-accent-500 px-7 py-2.5 text-sm font-bold uppercase tracking-wider text-brand-900 shadow transition hover:bg-accent-550 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50';
const errorClass = 'rounded border border-red-300/50 bg-red-600/40 px-3 py-2 text-sm text-white';
const linkClass = 'font-semibold text-white underline underline-offset-2 hover:text-accent-500';

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [accountNotice, setAccountNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setAccountNotice(null);
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      const response = err.response?.data;
      if (response?.accountStatus === 'suspended' || response?.accountStatus === 'banned') {
        setAccountNotice(response);
      } else {
        setError(response?.message || 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PillInput
          id="login-email"
          icon="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoFocus
        />
        <PillInput
          id="login-password"
          icon="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          trailing={(
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="shrink-0 px-4 text-xs font-semibold text-brand-700 hover:underline"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        />

        {error && <p role="alert" className={errorClass}>{error}</p>}

        <div className="pt-1">
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>

      {accountNotice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 text-slate-900" role="alertdialog" aria-modal="true" aria-labelledby="account-notice-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Account access</p>
                <h2 id="account-notice-title" className="text-xl font-semibold mt-1">Account {accountNotice.accountStatus}</h2>
              </div>
              <button type="button" onClick={() => setAccountNotice(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-slate-600 mt-4">Your account cannot sign in because it has been {accountNotice.accountStatus}. Contact the administrator to ask about the decision and next steps.</p>
            {accountNotice.adminContact ? (
              <div className="mt-4 rounded-lg bg-stone-50 p-4">
                <p className="text-sm font-medium">Administrator: {accountNotice.adminContact.full_name}</p>
                <a href={`mailto:${accountNotice.adminContact.email}`} className="text-sm text-brand-600 hover:underline">{accountNotice.adminContact.email}</a>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-4">No administrator contact is currently available.</p>
            )}
            <button type="button" onClick={() => setAccountNotice(null)} className="mt-5 w-full rounded-lg bg-accent-500 hover:bg-accent-550 py-2.5 text-sm font-semibold text-brand-900">Close</button>
          </div>
        </div>
      )}
    </>
  );
}

const ROLES = [
  { value: 'specialist', label: 'Specialist', desc: 'Teach topics · Create modules' },
  { value: 'beneficiary', label: 'Beneficiary', desc: 'Pre-assessment · Learn with a specialist' },
];

function SignupForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    schoolOrOrg: '',
    userType: 'specialist',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-medium text-white">I want to join as a</p>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const selected = form.userType === r.value;
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setForm({ ...form, userType: r.value })}
                // Selected: iELEVATE's "Navy 50" tint with navy border and text (orange stays for the main button).
                className={`relative rounded-md border-2 px-3 py-2 text-left transition ${
                  selected ? 'border-brand-600 bg-brand-50 text-brand-600' : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white" aria-hidden="true">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.2 2.2 2.2 4.8-4.8" /></svg>
                  </span>
                )}
                <p className="pr-4 text-sm font-semibold">{r.label}</p>
                <p className={`text-xs ${selected ? 'text-brand-500' : 'text-white/80'}`}>{r.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <PillInput
        id="signup-name"
        icon="person"
        label="Full name"
        type="text"
        placeholder="Full name"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        required
        autoFocus
      />
      <PillInput
        id="signup-school"
        icon="school"
        label="School / Organization (optional)"
        type="text"
        placeholder="School / Organization (optional)"
        value={form.schoolOrOrg}
        onChange={(e) => setForm({ ...form, schoolOrOrg: e.target.value })}
      />
      <PillInput
        id="signup-email"
        icon="email"
        label="Email address"
        type="email"
        placeholder="Email address"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <PillInput
        id="signup-password"
        icon="password"
        label="Password (min 8 characters)"
        type="password"
        placeholder="Password (min 8 characters)"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
        minLength={8}
      />

      {error && <p role="alert" className={errorClass}>{error}</p>}

      <div className="pt-1">
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? 'Creating account…' : 'Create my account'}
        </button>
      </div>
    </form>
  );
}

const COPY = {
  login: { title: 'Welcome back', subtitle: 'Sign in to your iELEVATE account', ask: 'Don’t have an account?', switchTo: '/signup', switchLabel: 'Create your free account' },
  signup: { title: 'Create your account', subtitle: 'Join iELEVATE and start your skill journey', ask: 'Already have an account?', switchTo: '/login', switchLabel: 'Sign in' },
};

// mode: 'login' or 'signup'. Closing goes back to the landing page (/).
export default function AuthPanel({ mode }) {
  const navigate = useNavigate();
  const copy = COPY[mode];
  const close = () => navigate('/');

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') navigate('/'); };
    window.addEventListener('keydown', onKey);
    // The landing page behind doesn't scroll (or show its scroll bar) while the panel is open.
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="auth-panel-title">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={close} className="absolute inset-0 cursor-default bg-slate-900/40" />
      {/* Still scrolls on short screens, without a scroll bar. */}
      <section className="drawer-enter relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-brand-700 [scrollbar-width:none] px-6 py-6 text-white shadow-2xl sm:px-8">
        <div className="flex items-center justify-between">
          <span className="inline-flex rounded-md bg-white px-2.5 py-1.5">
            <img src={elevateLogo} alt="iELEVATE" className="h-8 w-auto" />
          </span>
          <button type="button" onClick={close} aria-label="Close" className="rounded-lg px-2 text-2xl leading-none text-white/80 hover:bg-white/10 hover:text-white">×</button>
        </div>
        {/* Keyed by mode, so switching between Log in and Sign up slides the new one in. */}
        <div key={mode} className="slide-enter my-auto py-8">
          <h2 id="auth-panel-title" className="text-lg font-normal uppercase tracking-[0.18em]">{copy.title}</h2>
          <p className="mt-1.5 text-sm text-white/85">{copy.subtitle}</p>
          <div className="mt-6">{mode === 'login' ? <LoginForm /> : <SignupForm />}</div>
          <p className="mt-5 text-sm text-white/85">
            {copy.ask}{' '}
            <button type="button" onClick={() => navigate(copy.switchTo, { replace: true })} className={linkClass}>{copy.switchLabel}</button>
          </p>
        </div>
      </section>
    </div>
  );
}
