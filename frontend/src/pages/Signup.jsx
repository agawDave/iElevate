import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell, { PillInput, authButtonClass, authErrorClass, authLinkClass } from '../components/auth/AuthShell';

const steps = [
  { title: 'Create your profile', desc: 'Choose your role and set up your skills' },
  { title: 'Get matched', desc: 'Our algorithm finds your best skill partner' },
  { title: 'Schedule a session', desc: 'Book and connect with your match' },
  { title: 'Earn credentials', desc: 'Receive verified blockchain certificates' },
];

const ROLES = [
  { value: 'specialist', label: 'Specialist', desc: 'Share skills · Build reputation' },
  { value: 'beneficiary', label: 'Beneficiary', desc: 'Find specialists · Level up your skills' },
];

export default function Signup() {
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
    <AuthShell
      title="Create your account"
      subtitle="Join iELEVATE and start your skill journey"
      aside={(
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-500 mb-4">How it works</p>
            <ol className="space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-white text-brand-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-brand-200 text-xs">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div />
        </>
      )}
      footer={(
        <>
          Already have an account?{' '}
          <Link to="/login" className={authLinkClass}>Sign in</Link>
        </>
      )}
    >
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

        {error && <p role="alert" className={authErrorClass}>{error}</p>}

        <div className="pt-1">
          <button type="submit" disabled={submitting} className={authButtonClass}>
            {submitting ? 'Creating account…' : 'Create my account'}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
