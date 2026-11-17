import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { ActivityFileLink, FilePicker } from '../modules/ActivityFiles';
import { RubricSummary } from '../modules/Rubric';
import { BAND_LABELS, EDUCATION_LABELS } from '../../lib/profileLabels';
import { useConfirm } from '../../context/ConfirmContext';
import { AddButton, Avatar, CertificateActions, ItemCard, ItemForm, itemAddLabel, longDate, useItemEditor } from './PortfolioView';

const UPLOADED_LABEL = 'Uploaded by the beneficiary';
const RESUME_ACCEPT = '.pdf,.doc,.docx';
const PROFILE_PATH = '/elevate/portfolio/career/profile';
const input = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';
const ENTRY_COPY = {
  work: { heading: 'Work experience', add: '+ Add experience', title: 'Job title', organization: 'Employer', notes: 'What did you do? (optional)', empty: 'Part-time work, helping in a family store and volunteering all count.' },
  education: { heading: 'Education', add: '+ Add school', title: 'School', organization: 'Course or level', notes: 'Honors or notes (optional)', empty: 'Add the schools you attended.' },
};

function resumeFileError(file) {
  return /\.(pdf|docx?)$/i.test(file.name) ? '' : 'Choose a PDF or Word file.';
}

function Section({ number, title, action, children }) {
  return (
    <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 print:mb-4 print:rounded-none print:border-0 print:p-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{number}. {title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// One text saved to the career profile: a form for the owner, plain text on paper and for admins.
function SavedText({ label, field, value, placeholder, own, rows = 2, maxLength, onChanged }) {
  const [saved, setSaved] = useState(value);
  const [text, setText] = useState(value);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await axiosClient.put(PROFILE_PATH, { [field]: text });
      setSaved(text.trim());
      setText(text.trim());
      setStatus('Saved');
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this.');
    } finally {
      setBusy(false);
    }
  }

  const plain = saved && (
    <div className={own ? 'hidden print:block' : ''}>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="whitespace-pre-line text-sm text-slate-700">{saved}</p>
    </div>
  );
  if (!own) return plain || null;
  return (
    <>
      {plain}
      <form onSubmit={save} className="print:hidden">
        <label className="text-sm font-semibold text-slate-800">
          {label}
          <textarea value={text} onChange={(event) => { setText(event.target.value); setStatus(''); }} rows={rows} maxLength={maxLength} placeholder={placeholder} className={`${input} font-normal`} />
        </label>
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <button type="submit" disabled={text.trim() === saved || busy} className="rounded-lg border border-brand-600 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
          {status && <span role="status" className="text-xs text-emerald-700">{status}</span>}
        </div>
      </form>
    </>
  );
}

function EntryForm({ kind, entry, onDone, onCancel }) {
  const copy = ENTRY_COPY[kind];
  const [values, setValues] = useState({ title: entry?.title || '', organization: entry?.organization || '', period: entry?.period || '', description: entry?.description || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (event) => setValues((previous) => ({ ...previous, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (entry) await axiosClient.put(`/elevate/portfolio/career/entries/${entry.id}`, values);
      else await axiosClient.post('/elevate/portfolio/career/entries', { kind, ...values });
      await onDone();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-2 rounded-xl border border-stone-200 bg-stone-50 p-4 print:hidden">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">{copy.title}<input value={values.title} onChange={set('title')} maxLength={190} className={input} /></label>
        <label className="block text-sm font-medium text-slate-700">{copy.organization}<input value={values.organization} onChange={set('organization')} maxLength={190} className={input} /></label>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-700">Years<input value={values.period} onChange={set('period')} maxLength={60} placeholder="e.g. 2024–2025" className={`${input} max-w-44`} /></label>
      <label className="mt-3 block text-sm font-medium text-slate-700">{copy.notes}<textarea value={values.description} onChange={set('description')} rows={2} maxLength={1000} className={input} /></label>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={!values.title.trim() || busy} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>
      </div>
    </form>
  );
}

function Entries({ kind, entries, own, onChanged }) {
  const confirm = useConfirm();
  const copy = ENTRY_COPY[kind];
  const [editing, setEditing] = useState(null); // 'new' or an entry
  const [error, setError] = useState('');
  async function done() {
    setEditing(null);
    await onChanged();
  }
  async function remove(entry) {
    if (!await confirm({ title: 'Remove this from your portfolio?', message: `"${entry.title}" will no longer show in your career portfolio.`, confirmLabel: 'Remove', danger: true })) return;
    setError('');
    try {
      await axiosClient.delete(`/elevate/portfolio/career/entries/${entry.id}`);
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove this.');
    }
  }
  if (!own && !entries.length) return null;
  return (
    <div className={`mt-4 ${entries.length ? '' : 'print:hidden'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{copy.heading}</p>
        {own && <button type="button" onClick={() => setEditing('new')} className="text-sm font-semibold text-brand-600 hover:underline print:hidden">{copy.add}</button>}
      </div>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{error}</p>}
      {editing && <EntryForm key={editing === 'new' ? 'new' : editing.id} kind={kind} entry={editing === 'new' ? null : editing} onDone={done} onCancel={() => setEditing(null)} />}
      {entries.length > 0 ? (
        <ul className="mt-1 divide-y divide-stone-100">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 py-2 print:break-inside-avoid">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{[entry.title, entry.organization].filter(Boolean).join(' · ')}</p>
                {entry.period && <p className="text-xs text-slate-500">{entry.period}</p>}
                {entry.description && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{entry.description}</p>}
              </div>
              {own && (
                <span className="flex shrink-0 gap-1 print:hidden">
                  <button type="button" onClick={() => setEditing(entry)} className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
                  <button type="button" onClick={() => remove(entry)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">Remove</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : own && !editing && <p className="mt-1 text-sm text-slate-500">{copy.empty}</p>}
    </div>
  );
}

function ResumeSection({ data, own, onChanged }) {
  const confirm = useConfirm();
  const { career, person } = data;
  const { profile } = career;
  const [view, setView] = useState(profile.resumeMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shown = own ? view : profile.resumeMode;
  const byKind = (kind) => career.entries.filter((entry) => entry.kind === kind);

  async function run(action, fallback) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || fallback);
    } finally {
      setBusy(false);
    }
  }

  function choose(next) {
    setView(next);
    setError('');
    // Showing an uploaded resume needs one; until then the choice is just on screen.
    if (next === 'built' || profile.resumeFile) run(() => axiosClient.put(PROFILE_PATH, { resumeMode: next }), 'Could not save your choice.');
  }

  function upload(file) {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    run(() => axiosClient.put('/elevate/portfolio/career/resume', form), 'Could not upload your resume.');
  }

  async function removeFile() {
    if (!await confirm({ title: 'Remove your uploaded resume?', message: 'The file is deleted. You can upload another one any time.', confirmLabel: 'Remove', danger: true })) return;
    setView('built');
    run(() => axiosClient.delete('/elevate/portfolio/career/resume'), 'Could not remove your resume.');
  }

  const modeButton = (value, label) => (
    <button
      type="button"
      role="radio"
      aria-checked={shown === value}
      disabled={busy}
      onClick={() => choose(value)}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${shown === value ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-slate-700 hover:bg-stone-50'}`}
    >
      {label}
    </button>
  );

  return (
    <Section number={1} title="Resume">
      {own && (
        <div className="mb-4 flex flex-wrap gap-2 print:hidden" role="radiogroup" aria-label="Which resume to show">
          {modeButton('built', 'Built here')}
          {modeButton('uploaded', 'Upload my own')}
        </div>
      )}
      {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
      {shown === 'uploaded' ? (
        <div>
          {profile.resumeFile ? (
            <>
              <div className="print:hidden"><ActivityFileLink kind="resume" id={person.id} file={profile.resumeFile} /></div>
              <p className="hidden text-sm text-slate-700 print:block">Resume attached separately: {profile.resumeFile.name}</p>
            </>
          ) : !own && <p className="text-sm text-slate-500">No resume uploaded.</p>}
          {own && (
            <div className="mt-3 flex flex-wrap items-center gap-3 print:hidden">
              <FilePicker file={null} onChange={upload} accept={RESUME_ACCEPT} validate={resumeFileError} buttonText={profile.resumeFile ? 'Replace file' : 'Choose your resume'} hint="PDF or Word. Up to 20 MB." />
              {profile.resumeFile && <button type="button" onClick={removeFile} className="self-start rounded px-2 py-2 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">Remove</button>}
            </div>
          )}
        </div>
      ) : (
        <div>
          <SavedText label="Objective" field="objective" value={profile.objective} own={own} rows={3} maxLength={1000} placeholder="e.g. To work as a virtual assistant and use my skills in documents, spreadsheets and email." onChanged={onChanged} />
          <Entries kind="work" entries={byKind('work')} own={own} onChanged={onChanged} />
          <Entries kind="education" entries={byKind('education')} own={own} onChanged={onChanged} />
          {own && <p className="mt-3 text-xs text-slate-500 print:hidden">Your contact details, skills, trainings and certificates are filled in for you below.</p>}
        </div>
      )}
    </Section>
  );
}

function WorkSample({ sample }) {
  const { item, topic } = sample;
  if (sample.type === 'project') {
    return (
      <li className="rounded-xl border border-stone-200 p-4 print:break-inside-avoid">
        <p className="font-semibold text-slate-900">{item.title}</p>
        {item.itemDate && <p className="text-xs text-slate-500">{longDate(item.itemDate)}</p>}
        {item.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{item.description}</p>}
        {item.previewUrl && <img src={item.previewUrl} alt={item.title} className="mt-2 max-h-56 rounded-lg border border-stone-200 object-contain" />}
        {item.file && !item.previewUrl && <div className="mt-2 print:hidden"><ActivityFileLink kind="portfolio" id={item.id} file={item.file} /></div>}
        {item.file && !item.previewUrl && <p className="mt-1 hidden text-sm text-slate-700 print:block">File: {item.file.name}</p>}
      </li>
    );
  }
  return (
    <li className="rounded-xl border border-stone-200 p-4 print:break-inside-avoid">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{topic.title}</p>
      <p className="mt-0.5 whitespace-pre-line font-semibold text-slate-900">{item.prompt}</p>
      {item.text && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{item.text}</p>}
      {item.file && <div className="mt-2 print:hidden"><ActivityFileLink kind="answer" id={item.answerId} file={item.file} /></div>}
      {item.file && <p className="mt-1 hidden text-sm text-slate-700 print:block">File: {item.file.name}</p>}
      {item.reviewedAt && item.feedback && <p className="mt-2 text-sm text-emerald-900"><span className="font-semibold">Feedback from {topic.specialist}:</span> {item.feedback}</p>}
      <RubricSummary rubric={item.rubric} className="mt-0.5" />
    </li>
  );
}

function AskForm({ topics, onChanged }) {
  const [moduleId, setModuleId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function ask(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await axiosClient.post('/elevate/portfolio/recommendations', { moduleId, note });
      setModuleId('');
      setNote('');
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your request.');
    } finally {
      setBusy(false);
    }
  }
  if (!topics.length) return null;
  return (
    <form onSubmit={ask} className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4 print:hidden">
      <p className="text-sm font-semibold text-slate-800">Ask for a recommendation</p>
      <label className="mt-2 block text-sm font-medium text-slate-700">
        Who should write it?
        <select value={moduleId} onChange={(event) => setModuleId(event.target.value)} className={input}>
          <option value="">Choose a topic and specialist</option>
          {topics.map((topic) => <option key={topic.moduleId} value={topic.moduleId}>{topic.title} · {topic.specialist}</option>)}
        </select>
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Note to the specialist <span className="font-normal text-slate-500">(optional)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="e.g. I'm applying as a virtual assistant." className={input} />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!moduleId || busy} className="mt-3 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">{busy ? 'Sending…' : 'Ask for a recommendation'}</button>
    </form>
  );
}

function Recommendations({ data, own, onChanged, letters, editor }) {
  const confirm = useConfirm();
  const { career, topics } = data;
  const [error, setError] = useState('');
  const written = career.recommendations.filter((item) => item.status === 'written');
  const open = career.recommendations.filter((item) => item.status !== 'written');
  const askable = topics.filter((topic) => topic.acceptedAt && topic.specialist && !career.recommendations.some((item) => item.moduleId === topic.moduleId));

  async function remove(item, question) {
    if (!await confirm({ danger: true, ...question })) return;
    setError('');
    try {
      await axiosClient.delete(`/elevate/portfolio/recommendations/${item.id}`);
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove this.');
    }
  }

  return (
    <Section number={5} title="Recommendations" action={own && <AddButton label={itemAddLabel('letter')} onClick={() => editor.setEditing('new')} />}>
      {(error || editor.error) && <p role="alert" className="mb-2 text-sm text-red-600">{error || editor.error}</p>}
      {editor.editing && <ItemForm key={editor.editing === 'new' ? 'new' : editor.editing.id} kind="letter" item={editor.editing === 'new' ? null : editor.editing} onDone={editor.done} onCancel={() => editor.setEditing(null)} />}
      {written.length > 0 && (
        <ul className="mt-2 space-y-3">
          {written.map((item) => (
            <li key={item.id} className="rounded-xl border border-stone-200 p-4 print:break-inside-avoid">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-line text-sm italic text-slate-800">&ldquo;{item.body}&rdquo;</p>
                {own && <button type="button" onClick={() => remove(item, { title: 'Remove this recommendation?', message: `${item.specialist}'s recommendation will no longer show in your portfolio.`, confirmLabel: 'Remove' })} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 print:hidden">Remove</button>}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{item.specialist}</p>
              <p className="text-xs text-slate-500">Specialist, {item.topic} · Written on iELEVATE · {longDate(item.writtenAt)}</p>
            </li>
          ))}
        </ul>
      )}
      {letters.length > 0 && <ul className="mt-3 space-y-3">{letters.map((item) => <ItemCard key={item.id} item={item} own={own} editor={editor} addedLabel={UPLOADED_LABEL} />)}</ul>}
      {own && open.length > 0 && (
        <ul className="mt-3 space-y-2 print:hidden">
          {open.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-slate-600">
              <span className="min-w-0">{item.status === 'requested' ? `Waiting for ${item.specialist} to write it · ${item.topic}` : `${item.specialist} couldn't write one right now · ${item.topic}`}</span>
              <button type="button" onClick={() => remove(item, item.status === 'requested'
                ? { title: 'Cancel this request?', message: `${item.specialist} won't be asked for a recommendation for ${item.topic} any more.`, confirmLabel: 'Cancel request', cancelLabel: 'Keep it' }
                : { title: 'Clear this?', message: `The note that ${item.specialist} couldn't write one is removed from your list.`, confirmLabel: 'Clear' })} className="shrink-0 rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">{item.status === 'requested' ? 'Cancel' : 'Clear'}</button>
            </li>
          ))}
        </ul>
      )}
      {!written.length && !letters.length && !(own && open.length) && <p className="text-sm text-slate-500">{own ? 'Ask the specialists who taught you, or upload a letter from someone else.' : 'None yet.'}</p>}
      {own && <AskForm topics={askable} onChanged={onChanged} />}
    </Section>
  );
}

// The career portfolio: short and meant for employers. Admins see it read-only.
export default function CareerPortfolioView({ data, own = true, onChanged }) {
  const [fileError, setFileError] = useState('');
  const licenses = useItemEditor(onChanged);
  const trainings = useItemEditor(onChanged);
  const letters = useItemEditor(onChanged);
  const { person, about, career, summary, topics, items } = data;
  const byKind = (kind) => items.filter((item) => item.kind === kind);
  const contact = [career.contact.mobile, career.contact.email, career.contact.place].filter(Boolean);
  const samples = [
    ...byKind('project').filter((item) => item.showInCareer).map((item) => ({ key: `p${item.id}`, type: 'project', item })),
    ...topics.flatMap((topic) => topic.work.filter((item) => item.showInCareer).map((item) => ({ key: `w${item.answerId}`, type: 'work', item, topic }))),
  ];
  const certified = topics.filter((topic) => topic.certificate);
  const inTraining = topics.filter((topic) => !topic.certificate);
  const otherLists = [['license', licenses], ['training', trainings]];
  const qualifications = [
    ['Education', EDUCATION_LABELS[about.education]],
    ['School or organization', about.schoolOrOrg],
    ['ELEVATE training completed', summary.completed ? `${summary.completed} topic${summary.completed === 1 ? '' : 's'}, ${summary.hoursCompleted} hours` : ''],
  ].filter(([, value]) => value);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center gap-5 rounded-2xl border border-stone-200 bg-white p-5 print:rounded-none print:border-0 print:border-b print:border-stone-400 print:p-0 print:pb-4">
        <Avatar person={person} about={about} size="h-20 w-20 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{person.name}</h2>
          <p className="mt-1 text-sm text-slate-700">{contact.join(' · ')}</p>
          {own && !career.contact.mobile && <p className="mt-1 text-xs text-amber-800 print:hidden">Add your mobile number on your <Link to="/profile" className="font-medium underline">Profile</Link> so employers can call you.</p>}
        </div>
      </header>

      {fileError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}

      <ResumeSection data={data} own={own} onChanged={onChanged} />

      <Section number={2} title="Work samples">
        {samples.length > 0
          ? <ul className="space-y-3">{samples.map((sample) => <WorkSample key={sample.key} sample={sample} />)}</ul>
          : <p className="text-sm text-slate-500">{own ? 'Pick your best work: on the Learning tab, tick "Show in career portfolio" under a task or project.' : 'None chosen.'}</p>}
      </Section>

      <Section number={3} title="Skills and qualifications">
        {career.skills.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {career.skills.map((skill) => (
              <li key={skill.moduleId} className="rounded-full border border-stone-200 px-3 py-1 text-sm text-slate-800 print:border-stone-400">
                {skill.title} <span className="text-xs font-semibold text-emerald-700">{skill.certified ? 'Certified' : BAND_LABELS[skill.band]}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">{own ? 'Skills you do well in the skill check, and topics you complete, show here.' : 'None yet.'}</p>}
        {career.skills.length > 0 && <p className="mt-2 text-xs text-slate-500">Certified: completed with an ELEVATE specialist. Proficient or Strong: the beneficiary&apos;s own rating in the ELEVATE skill check.</p>}
        <div className="mt-4">
          <SavedText label="Other skills" field="otherSkills" value={career.profile.otherSkills} own={own} maxLength={500} placeholder="e.g. Cebuano and English, driving, customer service" onChanged={onChanged} />
        </div>
        {qualifications.length > 0 && (
          <dl className="mt-4 space-y-1 text-sm">
            {qualifications.map(([label, value]) => (
              <div key={label}>
                <dt className="inline text-slate-500">{label}: </dt>
                <dd className="inline text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section
        number={4}
        title="Certificates, licenses and trainings"
        action={own && (
          <div className="flex flex-wrap gap-2">
            <AddButton label={itemAddLabel('license')} onClick={() => licenses.setEditing('new')} />
            <AddButton label={itemAddLabel('training')} onClick={() => trainings.setEditing('new')} />
          </div>
        )}
      >
        {otherLists.map(([kind, editor]) => (
          <div key={kind}>
            {editor.error && <p role="alert" className="mb-2 text-sm text-red-600">{editor.error}</p>}
            {editor.editing && <ItemForm key={editor.editing === 'new' ? 'new' : editor.editing.id} kind={kind} item={editor.editing === 'new' ? null : editor.editing} onDone={editor.done} onCancel={() => editor.setEditing(null)} />}
          </div>
        ))}
        {certified.length > 0 && (
          <ul className="mt-2 space-y-3">
            {certified.map((topic) => (
              <li key={topic.moduleId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 print:break-inside-avoid">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{topic.title}</p>
                  <p className="text-xs text-slate-500">
                    {[`ELEVATE Program, CTU-Tuburan`, topic.hours && `${topic.hours} hours`, `issued ${longDate(topic.completedAt)}`, topic.certificate.issuedBy && `by ${topic.certificate.issuedBy}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex gap-2"><CertificateActions certificate={topic.certificate} onFileError={setFileError} /></div>
              </li>
            ))}
          </ul>
        )}
        {otherLists.map(([kind, editor]) => byKind(kind).length > 0 && <ul key={kind} className="mt-3 space-y-3">{byKind(kind).map((item) => <ItemCard key={item.id} item={item} own={own} editor={editor} />)}</ul>)}
        {byKind('award').length > 0 && <ul className="mt-3 space-y-3">{byKind('award').map((item) => <ItemCard key={item.id} item={item} own={false} />)}</ul>}
        {inTraining.length > 0 && <p className="mt-3 text-sm text-slate-600">In training: {inTraining.map((topic) => topic.title).join(', ')}</p>}
        {!certified.length && !byKind('license').length && !byKind('training').length && !byKind('award').length && !inTraining.length && <p className="text-sm text-slate-500">{own ? 'Certificates from your specialists show here. You can add licenses and other trainings too.' : 'None yet.'}</p>}
      </Section>

      <Recommendations data={data} own={own} onChanged={onChanged} letters={byKind('letter')} editor={letters} />
    </div>
  );
}
