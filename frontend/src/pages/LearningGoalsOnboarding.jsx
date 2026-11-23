import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import CircumstancesForm from '../components/CircumstancesForm';
import SkillCheckQuestionnaire from '../components/skillCheck/SkillCheckQuestionnaire';
import SkillCheckResults from '../components/skillCheck/SkillCheckResults';
import axiosClient from '../api/axiosClient';
import { SkeletonLines } from '../components/ui/Skeleton';

const STEPS = [
  { key: 'skill-check', label: 'Pre-assessment' },
  { key: 'results', label: 'Your topics' },
  { key: 'circumstances', label: 'Preferred setup' },
];

const COPY = {
  'skill-check': {
    title: 'ELEVATE pre-assessment',
    intro: 'One short list for everyone: tell us your goal and how well you can do a few everyday tasks. Your answers decide which ELEVATE topics you learn and which specialist teaches you. There are no wrong answers.',
  },
  results: {
    title: 'Your ELEVATE topics',
    intro: 'Anything you can’t do on your own yet is a learning topic. Topics for your main goal come first, up to four at a time; the rest are next up.',
  },
  circumstances: {
    title: 'Your preferred setup',
    intro: 'We match each topic with a specialist whose schedule, learning mode, and location fit yours, so you don’t have to choose one yourself.',
  },
};

// ELEVATE profiling: the pre-assessment (skill check) decides what the beneficiary
// learns, and their preferred setup decides which specialist teaches each topic.
export default function LearningGoalsOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retake = searchParams.get('retake') === '1';
  const [step, setStep] = useState(null);
  const [previousProfile, setPreviousProfile] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      axiosClient.get('/elevate/skill-check/me').catch(() => ({ data: { data: { completed: false } } })),
      axiosClient.get('/skills/me').catch(() => ({ data: { data: [] } })),
    ]).then(([checkResponse, skillsResponse]) => {
      if (!active) return;
      const check = checkResponse.data.data;
      setPreviousProfile(check.profile || null);
      setResults(check.results || []);
      const hasTopics = skillsResponse.data.data.some((skill) => skill.relation_type === 'wants_to_learn');
      setStep(!retake && (check.completed || hasTopics) ? 'circumstances' : 'skill-check');
    });
    return () => { active = false; };
  }, [retake]);

  const stepIndex = STEPS.findIndex((item) => item.key === step);
  const copy = COPY[step] || COPY['skill-check'];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">ELEVATE orientation, pre-test and profiling</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.intro}</p>

        <ol className="mt-5 flex flex-wrap gap-3 text-xs font-medium">
          {STEPS.map((item, index) => (
            <li
              key={item.key}
              className={`flex items-center rounded-full px-3 py-1.5 ${index === stepIndex ? 'bg-brand-600 text-white' : index < stepIndex ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-slate-500'}`}
            >
              {item.label}
            </li>
          ))}
        </ol>

        <section className="mt-5 rounded-xl border border-stone-200 bg-white p-5">
          {step === null && <SkeletonLines lines={5} />}
          {step === 'skill-check' && (
            <SkillCheckQuestionnaire
              initialProfile={previousProfile ? {
                goalTrack: previousProfile.goalTrack,
                usedComputer: previousProfile.usedComputer,
                phasesCompleted: previousProfile.phasesCompleted || [],
                notes: previousProfile.notes || '',
              } : null}
              onComplete={(data) => {
                setResults(data.results || []);
                setStep('results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
          {step === 'results' && (
            <div className="space-y-5">
              <SkillCheckResults results={results} />
              <button
                type="button"
                onClick={() => setStep('circumstances')}
                className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 transition hover:bg-accent-550"
              >
                Continue
              </button>
            </div>
          )}
          {step === 'circumstances' && (
            <>
              <CircumstancesForm
                userType="beneficiary"
                askPlace
                submitLabel="Find my specialists"
                onSaved={() => navigate('/modules', { replace: true })}
              />
              <button
                type="button"
                onClick={() => setStep('skill-check')}
                className="mt-4 text-sm text-slate-500 hover:text-brand-600"
              >
                ← Retake the pre-assessment
              </button>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
