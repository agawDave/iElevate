import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

// Beneficiaries finish ELEVATE profiling (skill check + circumstances) before
// using the rest of the app, because matching depends on both. Beneficiaries
// who picked topics by hand before the skill check existed count as done.
export default function BeneficiaryLearningGoalGate() {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState(user?.userType === 'beneficiary' ? 'loading' : 'ready');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (user?.userType !== 'beneficiary') {
      setStatus('ready');
      setError('');
      return undefined;
    }

    let active = true;
    setStatus('loading');
    setError('');
    Promise.all([
      axiosClient.get('/skills/me'),
      axiosClient.get('/users/me/circumstances'),
      axiosClient.get('/elevate/skill-check/me').catch(() => ({ data: { data: { completed: false } } })),
    ])
      .then(([skillsResponse, circumstancesResponse, skillCheckResponse]) => {
        if (!active) return;
        // A learner who is already strong in every topic has a finished skill
        // check but no topics to learn.
        const hasLearningGoals = skillsResponse.data.data.some((skill) => skill.relation_type === 'wants_to_learn')
          || Boolean(skillCheckResponse.data.data?.completed);
        const hasCircumstances = Boolean(circumstancesResponse.data.data?.complete);
        setStatus(hasLearningGoals && hasCircumstances ? 'ready' : 'required');
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.message || 'Unable to check your learning profile.');
        setStatus('error');
      });

    return () => { active = false; };
  }, [user?.id, user?.userType, retry]);

  if (user?.userType !== 'beneficiary' || status === 'ready') return <Outlet />;
  if (status === 'loading') {
    return <main className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-slate-500">Checking your learning profile…</main>;
  }
  if (status === 'required') {
    return <Navigate to="/onboarding/learning-goals" replace state={{ from: location.pathname }} />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <section className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6">
        <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">We couldn’t check your learning profile</h1>
        <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => setRetry((current) => current + 1)}
          className="mt-4 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
