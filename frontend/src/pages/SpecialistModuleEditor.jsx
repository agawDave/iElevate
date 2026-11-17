import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import MaterialsPanel from '../components/modules/MaterialsPanel';
import ActivitiesPanel from '../components/modules/ActivitiesPanel';
import LineIcon from '../components/ui/LineIcon';
import { SkeletonLines } from '../components/ui/Skeleton';
import { moduleStatusOf } from '../lib/moduleStatus';
import { phaseInfo } from '../lib/topicFaces';

const MIN_OVERVIEW = 30;
const fieldClass = 'mt-1 block w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-stone-50';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '';
}

function CheckItem({ done, optional = false, children }) {
  return (
    <li className={`flex items-start gap-2 ${done ? 'text-slate-800' : 'text-slate-500'}`}>
      {done
        ? <LineIcon name="check" strokeWidth={2.5} className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        : <span className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${optional ? 'border-stone-300' : 'border-amber-400'}`} aria-hidden="true" />}
      <span>{children}{optional && <span className="text-slate-400"> (optional)</span>}<span className="sr-only">{done ? ', done' : ', not yet'}</span></span>
    </li>
  );
}

function ContentRow({ title, detail, button, onClick }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3.5">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="text-xs text-slate-500">{detail}</span>
      </span>
      <button type="button" onClick={onClick} className="rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">{button}</button>
    </li>
  );
}

// A specialist creates (or edits) their own module for one ELEVATE topic:
// title, overview and hours, then materials, activities and the pre/post-test
// with the same panels as the Modules page, then sends it to the admin.
export default function SpecialistModuleEditor() {
  const { topicId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ title: '', overview: '', hours: '' });
  const [saved, setSaved] = useState(null); // the form as last saved, to know about unsaved changes
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [panel, setPanel] = useState(''); // 'materials' | 'activities' | 'test'

  const load = useCallback(async ({ keepForm = false } = {}) => {
    try {
      const response = await axiosClient.get(`/elevate/my-modules/${topicId}`);
      const loaded = response.data.data;
      setData(loaded);
      if (!keepForm) {
        const initial = {
          title: loaded.module?.title || loaded.topic.title,
          overview: loaded.module?.overview || '',
          hours: String(loaded.module?.hours || loaded.topic.hours || ''),
        };
        setForm(initial);
        setSaved(loaded.module ? initial : null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open this module.');
    }
  }, [topicId]);

  useEffect(() => { load(); }, [load]);

  if (user && user.userType !== 'specialist') return <Navigate to="/modules" replace />;

  if (!data) {
    return (
      <AppLayout>
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        {error
          ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{error}</p>
          : <SkeletonLines lines={8} label="Loading your module…" className="mt-4 rounded-2xl border border-stone-200 bg-white p-6" />}
      </AppLayout>
    );
  }

  const { topic, module, counts, teaches } = data;
  const status = module?.status || 'none';
  const statusInfo = moduleStatusOf(module);
  const info = phaseInfo(topic.phase);
  const dirty = !saved || saved.title !== form.title || saved.overview !== form.overview || saved.hours !== form.hours;
  const ready = {
    about: form.title.trim().length > 0 && form.overview.trim().length >= MIN_OVERVIEW,
    materials: counts.materials > 0,
    activities: counts.activities > 0,
  };
  const canSubmit = ready.about && ready.materials && ready.activities;
  const canSend = ['none', 'draft', 'changes_requested'].includes(status);
  const locked = !teaches;

  const update = (field) => (event) => setForm((previous) => ({ ...previous, [field]: event.target.value }));
  const body = () => ({ title: form.title, overview: form.overview, hours: Number(form.hours) });

  async function save() {
    const response = await axiosClient.put(`/elevate/my-modules/${topicId}`, body());
    setSaved({ ...form });
    return response;
  }

  async function onSave(event) {
    event.preventDefault();
    setBusy('save');
    setError('');
    setNotice('');
    try {
      const response = await save();
      setNotice(response.data.message);
      await load({ keepForm: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save your module.');
    } finally {
      setBusy('');
    }
  }

  async function onSubmit() {
    setBusy('submit');
    setError('');
    setNotice('');
    try {
      if (dirty) await save();
      await axiosClient.post(`/elevate/my-modules/${topicId}/submit`);
      navigate('/modules', { state: { notice: `“${form.title}” was sent to the admin for approval.` } });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to submit your module.');
      await load({ keepForm: true });
      setBusy('');
    }
  }

  function closePanel() {
    setPanel('');
    load({ keepForm: true });
  }

  return (
    <AppLayout>
      <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
      <div className="mt-3">
        <PageHeader
          eyebrow={[topic.phase, info.name, 'Training design topic'].filter(Boolean).join(' · ')}
          title={module ? `Your module: ${topic.title}` : `Create your module: ${topic.title}`}
          subtitle="Your own module for this topic. Beneficiaries who choose you will learn from it."
        />
      </div>

      {locked && (
        <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {topic.title} is no longer in your teaching plan, so this module can&apos;t be changed. <Link to="/learning-plan" className="font-semibold underline">Open your teaching plan</Link>
        </p>
      )}
      {status === 'changes_requested' && module.reviewNote && (
        <div role="status" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-red-700">Note from the admin · {formatDate(module.reviewedAt)}</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-red-900">{module.reviewNote}</p>
        </div>
      )}
      {notice && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{notice}</p>}
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <form id="module-form" onSubmit={onSave} className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="text-[17px] font-semibold text-slate-900">About your module</h2>
            <label htmlFor="module-title" className="mt-4 block text-sm font-medium text-slate-700">Module title</label>
            <input id="module-title" value={form.title} onChange={update('title')} maxLength={160} required disabled={locked} className={fieldClass} />
            <label htmlFor="module-overview" className="mt-4 block text-sm font-medium text-slate-700">
              Overview <span className="font-normal text-slate-500">(what learners will learn and do)</span>
            </label>
            <textarea
              id="module-overview"
              value={form.overview}
              onChange={update('overview')}
              rows={4}
              maxLength={2000}
              disabled={locked}
              placeholder={`e.g. ${topic.description}`}
              className={`${fieldClass} leading-6`}
            />
            <p className={`mt-1 text-xs ${form.overview.trim().length >= MIN_OVERVIEW ? 'text-slate-500' : 'text-amber-700'}`}>
              {form.overview.trim().length >= MIN_OVERVIEW ? `${form.overview.length} / 2000` : `At least a sentence (${MIN_OVERVIEW} characters).`}
            </p>
            <div className="mt-4 max-w-[12rem]">
              <label htmlFor="module-hours" className="block text-sm font-medium text-slate-700">Hours</label>
              <input id="module-hours" type="number" min={1} max={200} value={form.hours} onChange={update('hours')} required disabled={locked} className={fieldClass} />
            </div>
            {topic.hours > 0 && <p className="mt-1 text-xs text-slate-500">The training design suggests {topic.hours} hours.</p>}
          </form>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="text-[17px] font-semibold text-slate-900">Content</h2>
            <p className="mt-0.5 text-sm text-slate-500">You can add these before or after saving, and keep adding them after approval.</p>
            <ul className="mt-2 divide-y divide-stone-100">
              <ContentRow
                title="Materials"
                detail={counts.materials ? `${counts.materials} added · PDFs, documents, videos or links` : 'None yet · PDFs, documents, videos or links'}
                button="Materials"
                onClick={() => setPanel('materials')}
              />
              <ContentRow
                title="Activities"
                detail={counts.activities ? `${counts.activities} added · multiple choice, written or file tasks` : 'None yet · multiple choice, written or file tasks'}
                button="Tests & activities"
                onClick={() => setPanel('activities')}
              />
              <ContentRow
                title="Pre/post-test"
                detail={counts.testQuestions ? `${counts.testQuestions} question${counts.testQuestions === 1 ? '' : 's'}` : 'Not added yet · optional'}
                button={counts.testQuestions ? 'Edit questions' : 'Add questions'}
                onClick={() => setPanel('test')}
              />
            </ul>
          </section>
        </div>

        <aside className="rounded-2xl border border-stone-200 bg-white p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-slate-900">{canSend ? 'Ready to submit?' : 'Your module'}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${statusInfo.style}`}>
              {statusInfo.check && <LineIcon name="check" strokeWidth={2.5} className="h-3 w-3" />}{statusInfo.label}
            </span>
          </div>
          {status === 'pending' && <p className="mt-2 text-sm text-slate-600">Sent to the admin on {formatDate(module.submittedAt)}. You can keep improving it while you wait.</p>}
          {status === 'approved' && <p className="mt-2 text-sm text-slate-600">Approved on {formatDate(module.approvedAt)}. Beneficiaries can apply to you, and changes you save show to them right away.</p>}
          <ul className="mt-3 space-y-2 text-sm">
            <CheckItem done={ready.about}>Title and overview written</CheckItem>
            <CheckItem done={ready.materials}>At least one material</CheckItem>
            <CheckItem done={ready.activities}>At least one activity</CheckItem>
            <CheckItem done={counts.testQuestions > 0} optional>Pre/post-test</CheckItem>
          </ul>
          {!locked && (
            <div className="mt-5 space-y-2">
              {canSend && (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={!canSubmit || Boolean(busy)}
                  className="block w-full rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-accent-550 disabled:opacity-40"
                >
                  {busy === 'submit' ? 'Sending…' : status === 'changes_requested' ? 'Resubmit for approval' : 'Submit for approval'}
                </button>
              )}
              <button
                type="submit"
                form="module-form"
                disabled={Boolean(busy) || (Boolean(module) && !dirty)}
                className="block w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
              >
                {busy === 'save' ? 'Saving…' : canSend ? (!module ? 'Save as draft' : dirty ? 'Save draft' : 'Draft saved') : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          )}
          {canSend && <p className="mt-3 text-xs text-slate-500">The admin reviews it. Beneficiaries can apply to you once it&apos;s approved.</p>}
        </aside>
      </div>

      {panel === 'materials' && <MaterialsPanel topicId={topic.id} onClose={closePanel} />}
      {(panel === 'activities' || panel === 'test') && <ActivitiesPanel topicId={topic.id} topics={[{ id: topic.id, title: topic.title }]} start={panel} onClose={closePanel} onChanged={() => load({ keepForm: true })} />}
    </AppLayout>
  );
}
