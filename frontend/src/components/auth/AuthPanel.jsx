import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Log in and Sign up (/login and /signup): a small frosted-glass card that slides
// in from the right over the dimmed landing page. Switching between them stays
// in the card; clicking outside or Escape goes back to the landing page.

// A labelled field: white text label, white box (an optional button sits inside on the right).
function Field({ id, label, hint, trailing, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-white">
        {label}{hint && <span className="font-normal text-white/70"> {hint}</span>}
      </label>
      <div className="relative mt-1">
        <input id={id} {...inputProps} className={`block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-accent-500 ${trailing ? 'pr-16' : ''}`} />
        {trailing}
      </div>
    </div>
  );
}

// iELEVATE's main-action orange, with navy text (white on this orange is too faint to read).
const buttonClass = 'w-full rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-brand-900 shadow transition hover:bg-accent-550 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50';
const errorClass = 'rounded-lg border border-red-300/50 bg-red-600/40 px-3 py-2 text-sm text-white';
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
        <Field
          id="login-email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          autoFocus
        />
        <Field
          id="login-password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          trailing={(
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        />

        {error && <p role="alert" className={errorClass}>{error}</p>}

        <div className="pt-1">
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? 'Logging in…' : 'Log in'}
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-white">I want to join as a</p>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => {
            const selected = form.userType === r.value;
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setForm({ ...form, userType: r.value })}
                // Selected: white with navy text (orange stays for the main button).
                className={`relative rounded-xl border px-3 py-2.5 text-left transition ${
                  selected ? 'border-white bg-white text-brand-700' : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white" aria-hidden="true">
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.2 2.2 2.2 4.8-4.8" /></svg>
                  </span>
                )}
                <p className="pr-4 text-sm font-semibold">{r.label}</p>
                <p className={`mt-0.5 text-xs ${selected ? 'text-brand-600' : 'text-white/80'}`}>{r.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Field
        id="signup-name"
        label="Full name"
        type="text"
        autoComplete="name"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        required
        autoFocus
      />
      <Field
        id="signup-school"
        label="School or organization"
        hint="(optional)"
        type="text"
        autoComplete="organization"
        value={form.schoolOrOrg}
        onChange={(e) => setForm({ ...form, schoolOrOrg: e.target.value })}
      />
      <Field
        id="signup-email"
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <Field
        id="signup-password"
        label="Password"
        hint="(at least 8 characters)"
        type="password"
        autoComplete="new-password"
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
  login: { title: 'Welcome back', subtitle: 'Log in to your iELEVATE account.', ask: 'Don’t have an account?', switchTo: '/signup', switchLabel: 'Sign up' },
  signup: { title: 'Create your account', subtitle: 'Join iELEVATE and start your skill journey.', ask: 'Already have an account?', switchTo: '/login', switchLabel: 'Log in' },
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
    <div className="fixed inset-0 z-50 overflow-y-auto [scrollbar-width:none]" role="dialog" aria-modal="true" aria-labelledby="auth-panel-title">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={close} className="fixed inset-0 cursor-default bg-slate-900/40" />
      {/* Still scrolls on short screens; clicks beside the card reach the close layer. */}
      <div className="pointer-events-none relative flex min-h-full items-center justify-end px-4 py-8 sm:pr-10">
        <section className="drawer-enter pointer-events-auto w-full max-w-sm rounded-xl border border-white/25 bg-white/15 px-6 py-6 text-white shadow-2xl backdrop-blur-md sm:px-7">
          {/* Keyed by mode, so switching between Log in and Sign up slides the new one in. */}
          <div key={mode} className="slide-enter">
            <div className="flex items-start justify-between gap-3">
              <h2 id="auth-panel-title" className="text-2xl font-extrabold tracking-tight">{copy.title}</h2>
              <button type="button" onClick={close} aria-label="Close" className="-mr-2 rounded-lg px-2 text-2xl leading-none text-white/80 hover:bg-white/10 hover:text-white">×</button>
            </div>
            <p className="mt-1 text-sm text-white/85">{copy.subtitle}</p>
            <div className="mt-5">{mode === 'login' ? <LoginForm /> : <SignupForm />}</div>
            <p className="mt-5 text-center text-sm text-white/85">
              {copy.ask}{' '}
              <button type="button" onClick={() => navigate(copy.switchTo, { replace: true })} className={linkClass}>{copy.switchLabel}</button>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
