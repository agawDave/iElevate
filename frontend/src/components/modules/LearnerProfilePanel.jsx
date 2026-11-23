import { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { DetailPanel, DetailRow } from '../admin/Directory';
import { DAYS, LEARNING_MODES, TIME_BLOCKS } from '../../lib/circumstances';
import {
  BAND_LABELS,
  BAND_STYLES,
  DEVICE_LABELS,
  EDUCATION_LABELS,
  GOAL_LABELS,
  INTERNET_LABELS,
  SEX_LABELS,
  WORK_LABELS,
} from '../../lib/profileLabels';
import { formatDay } from '../../lib/sessions';
import { SkeletonLines } from '../ui/Skeleton';
import { avatarTint, initials } from '../../lib/people';

const STAGE_LABELS = { incoming: 'Applied', ongoing: 'Ongoing', completed: 'Completed' };
const STAGE_STYLES = {
  incoming: 'bg-amber-50 text-amber-800',
  ongoing: 'bg-brand-50 text-brand-700',
  completed: 'bg-emerald-50 text-emerald-700',
};

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-600">{title}</h3>
      {children}
    </section>
  );
}

// Weekly availability as a small days × time-of-day grid.
function AvailabilityGrid({ slots }) {
  if (!slots.length) return <p className="text-sm text-slate-500">Not set yet.</p>;
  return (
    <table className="text-center text-xs">
      <thead>
        <tr>
          <th className="pr-2" aria-label="Time of day" />
          {DAYS.map((day) => <th key={day.value} className="w-9 pb-1 font-medium text-slate-500">{day.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {TIME_BLOCKS.map((block) => (
          <tr key={block.value}>
            <th className="pr-2 text-left font-medium text-slate-500" title={block.hint}>{block.label}</th>
            {DAYS.map((day) => {
              const free = slots.includes(`${day.value}-${block.value}`);
              return (
                <td key={day.value} className="p-0.5">
                  <span
                    className={`block h-5 rounded ${free ? 'bg-emerald-500' : 'bg-stone-100'}`}
                    title={`${day.label} ${block.label.toLowerCase()}: ${free ? 'free' : 'not free'}`}
                  >
                    <span className="sr-only">{free ? 'free' : 'not free'}</span>
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A beneficiary's information for the specialist they applied to or learn with.
export default function LearnerProfilePanel({ beneficiaryId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!beneficiaryId) return;
    setData(null);
    setError('');
    axiosClient.get(`/elevate/learners/${beneficiaryId}`)
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load this beneficiary.'));
  }, [beneficiaryId]);

  const place = data ? [data.place.barangay && `Brgy. ${data.place.barangay}`, data.place.city, data.place.province].filter(Boolean).join(', ') : '';
  const modes = data?.learning.learningModes.map((mode) => LEARNING_MODES.find((item) => item.value === mode)?.label || mode).join(', ');

  return (
    <DetailPanel open={Boolean(beneficiaryId)} title={data?.fullName || 'Beneficiary'} onClose={onClose}>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!data && !error && <SkeletonLines lines={8} label="Loading their profile…" />}
      {data && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            {data.avatarUrl
              ? <img src={data.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              : <span className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold ${avatarTint(data.fullName)}`} aria-hidden="true">{initials(data.fullName)}</span>}
            <div className="min-w-0">
              <p className="text-lg font-semibold text-slate-900">{data.fullName}</p>
              <p className="text-sm text-slate-500">{[data.age ? `${data.age} years old` : null, SEX_LABELS[data.sex], place].filter(Boolean).join(' · ')}</p>
            </div>
          </div>

          <Section title="With you">
            <ul className="space-y-1.5">
              {data.withYou.map((topic) => (
                <li key={topic.moduleId} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-800">{topic.title}</span>
                    <span className="block text-xs text-slate-500">
                      {topic.stage === 'completed' && topic.completedAt ? `Completed ${formatDay(topic.completedAt)}`
                        : topic.stage === 'ongoing' && topic.acceptedAt ? `Accepted ${formatDay(topic.acceptedAt)}`
                          : topic.appliedAt ? `Applied ${formatDay(topic.appliedAt)}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_STYLES[topic.stage]}`}>{STAGE_LABELS[topic.stage]}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Profile">
            <dl>
              <DetailRow label="Age">{data.age ? `${data.age}` : null}</DetailRow>
              <DetailRow label="Sex">{SEX_LABELS[data.sex]}</DetailRow>
              <DetailRow label="Education">{EDUCATION_LABELS[data.education]}</DetailRow>
              <DetailRow label="Work">{WORK_LABELS[data.workStatus]}</DetailRow>
              <DetailRow label="School / organization">{data.schoolOrOrg}</DetailRow>
              <DetailRow label="Address">{place}</DetailRow>
              <DetailRow label="About">{data.bio && <span className="whitespace-pre-line">{data.bio}</span>}</DetailRow>
            </dl>
          </Section>

          <Section title="Contact">
            {data.contact ? (
              <dl>
                <DetailRow label="Mobile">{data.contact.mobile && <a href={`tel:${data.contact.mobile}`} className="text-brand-600 hover:underline">{data.contact.mobile}</a>}</DetailRow>
                <DetailRow label="Email"><a href={`mailto:${data.contact.email}`} className="text-brand-600 hover:underline">{data.contact.email}</a></DetailRow>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Shown once you accept their application.</p>
            )}
          </Section>

          <Section title="Learning">
            <dl>
              <DetailRow label="Main goal">{GOAL_LABELS[data.learning.goalTrack]}</DetailRow>
              <DetailRow label="Used a computer">{data.learning.usedComputer === null ? null : data.learning.usedComputer ? 'Yes' : 'Not yet'}</DetailRow>
              <DetailRow label="They told us">{data.learning.notes && <span className="whitespace-pre-line italic">&ldquo;{data.learning.notes}&rdquo;</span>}</DetailRow>
              <DetailRow label="Can attend">{modes}</DetailRow>
              <DetailRow label="Device">{DEVICE_LABELS[data.learning.deviceAccess]}</DetailRow>
              <DetailRow label="Internet">{INTERNET_LABELS[data.learning.internetAccess]}</DetailRow>
            </dl>
            <p className="mb-1.5 mt-3 text-sm text-slate-500">Free each week</p>
            <AvailabilityGrid slots={data.learning.availability} />
          </Section>

          <Section title={`Pre-assessment${data.learning.skillCheckAt ? ` · ${formatDay(data.learning.skillCheckAt)}` : ''}`}>
            {data.skills.length ? (
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {data.skills.map((skill) => {
                  const yours = data.withYou.some((topic) => topic.moduleId === skill.moduleId);
                  return (
                    <li key={skill.moduleId} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${yours ? 'bg-brand-50/50' : ''}`}>
                      <span className="min-w-0 truncate text-slate-800">{skill.title}{yours && <span className="ml-1.5 text-xs text-brand-600">(with you)</span>}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_STYLES[skill.band] || 'bg-stone-100 text-slate-600'}`}>
                        {BAND_LABELS[skill.band] || skill.band}{skill.kind === 'post' ? ' (retake)' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-slate-500">They haven&apos;t taken the pre-assessment yet.</p>}
          </Section>
        </div>
      )}
    </DetailPanel>
  );
}
