import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import AuthShell, { PillInput, authButtonClass, authErrorClass, authLinkClass } from '../components/auth/AuthShell';

const FEATURES = ['Pre-assessment', 'Specialist-guided modules', 'Pre- and post-tests', 'Certificates & portfolio'];

// The program's real size (topics, phases, hours), read from the database so
// the numbers stay true. Nothing shows until they've loaded.
function useProgramFacts() {
  const [facts, setFacts] = useState(null);
  useEffect(() => {
    axiosClient.get('/public/program').then((response) => setFacts(response.data.data)).catch(() => {});
  }, []);
  return facts;
}

export default function Login() {
  const facts = useProgramFacts();
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
      <AuthShell
        title="Welcome back"
        subtitle="Sign in to your iELEVATE account"
        aside={(
          <>
            <div>
              <h2 className="text-4xl font-extrabold leading-tight mb-1 tracking-tight text-white">Learn by doing.</h2>
              <h2 className="text-4xl font-extrabold leading-tight text-accent-500 mb-4 tracking-tight">Grow by sharing.</h2>
              <p className="text-brand-100 max-w-sm mb-6">
                Take a quick pre-assessment, learn the ELEVATE topics you need with a specialist, and earn certificates for your portfolio.
              </p>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((t) => (
                  <span key={t} className="text-xs bg-white/15 rounded-full px-3 py-1.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {facts ? (
              <div className="flex gap-8 text-sm">
                {[
                  { value: facts.topics, label: 'Training topics' },
                  { value: facts.phases, label: 'Program phases' },
                  { value: facts.hours, label: 'Training hours' },
                ].map((fact) => (
                  <div key={fact.label}>
                    <p className="text-2xl font-bold tabular-nums">{fact.value}</p>
                    <p className="text-brand-200">{fact.label}</p>
                  </div>
                ))}
              </div>
            ) : <div />}
          </>
        )}
        footer={(
          <>
            Don't have an account?{' '}
            <Link to="/signup" className={authLinkClass}>Create your free account</Link>
          </>
        )}
      >
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

          {error && <p role="alert" className={authErrorClass}>{error}</p>}

          <div className="pt-1">
            <button type="submit" disabled={submitting} className={authButtonClass}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </AuthShell>

      {accountNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" role="dialog" aria-modal="true" aria-labelledby="account-notice-title">
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
