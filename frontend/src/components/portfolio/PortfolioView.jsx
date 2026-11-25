import { useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { ActivityFileLink, FilePicker } from '../modules/ActivityFiles';
import { RubricSummary } from '../modules/Rubric';
import { openCertificate } from '../../lib/certificates';
import { ACTIVITY_FILE_HINT } from '../../lib/activityFiles';
import { BAND_LABELS, BAND_STYLES, EDUCATION_LABELS } from '../../lib/profileLabels';
import { avatarTint, initials } from '../../lib/people';
import EmptyState from '../ui/EmptyState';
import { TopicTile } from '../ui/TopicFace';
import { useConfirm } from '../../context/ConfirmContext';

const TYPE_LABELS = { written: 'Written task', file: 'File task' };
export const ADDED_LABEL = 'Added by the beneficiary';
const PHOTO_ACCEPT = '.jpg,.jpeg,.png';
const SECTIONS = [
  { id: 'pf-about', title: 'About Me' },
  { id: 'pf-skills', title: 'Skill profile' },
  { id: 'pf-works', title: 'Sample works' },
  { id: 'pf-certificates', title: 'Certificates and recognitions' },
  { id: 'pf-photos', title: 'Photos' },
];
const ITEM_COPY = {
  project: { add: '+ Add a project', title: 'Project title', placeholder: 'e.g. Website for our barangay store', notes: 'What is it, and what did you do?', file: 'File (optional if you described it)' },
  award: { add: '+ Add an award', title: 'Award or recognition', placeholder: 'e.g. Best Project, Barangay Skills Fair', notes: 'Who gave it, and why? (optional)', file: 'Picture or file of the award (optional)' },
  photo: { add: '+ Add a photo', title: 'Photo title', placeholder: 'e.g. Our training at the barangay hall', notes: 'Caption (optional)', file: 'Photo' },
};

export function longDate(value) {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function photoError(file) {
  return /\.(jpe?g|png)$/i.test(file.name) ? '' : 'Choose a JPG or PNG photo.';
}

export function Avatar({ person, about, size }) {
  return about.avatarUrl
    ? <img src={about.avatarUrl} alt={`${person.name}'s profile`} className={`${size} rounded-full object-cover`} />
    : <span className={`${size} flex items-center justify-center rounded-full text-2xl font-bold ${avatarTint(person.name)}`} aria-hidden="true">{initials(person.name)}</span>;
}

function Band({ band }) {
  if (!band) return <span className="text-xs text-slate-400">—</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_STYLES[band] || 'bg-stone-100 text-slate-600'}`}>{BAND_LABELS[band] || band}</span>;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 print:border-stone-400">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums text-brand-600">{value}</p>
    </div>
  );
}

function Section({ index, children, action, plain = false }) {
  const section = SECTIONS[index];
  return (
    <section id={section.id} className={`mb-6 scroll-mt-4 ${plain ? '' : 'rounded-2xl border border-stone-200 bg-white p-5 print:rounded-none print:border-0 print:p-0'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900">{index + 1}. {section.title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// "What I learned": the learner writes it; admins and paper show it as text.
function Reflection({ item, own }) {
  const [saved, setSaved] = useState(item.reflection);
  const [text, setText] = useState(item.reflection);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const changed = text.trim() !== saved;

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await axiosClient.put(`/elevate/portfolio/reflections/${item.answerId}`, { reflection: text });
      setSaved(text.trim());
      setText(text.trim());
      setStatus('Saved');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save your reflection.');
    } finally {
      setBusy(false);
    }
  }

  const readOnly = saved && (
    <div className={own ? 'mt-3 hidden print:block' : 'mt-3'}>
      <p className="text-sm font-semibold text-slate-800">What I learned</p>
      <p className="whitespace-pre-line text-sm text-slate-700">{saved}</p>
    </div>
  );
  if (!own) return readOnly || null;
  return (
    <>
      {readOnly}
      <form onSubmit={save} className="mt-3 print:hidden">
        <label className="text-sm font-semibold text-slate-800" htmlFor={`reflection-${item.answerId}`}>What I learned</label>
        <textarea
          id={`reflection-${item.answerId}`}
          value={text}
          onChange={(event) => { setText(event.target.value); setStatus(''); }}
          rows={2}
          maxLength={2000}
          placeholder="What did this task teach you?"
          className="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <button type="submit" disabled={!changed || busy} className="rounded-lg border border-brand-600 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40">
            {busy ? 'Saving…' : 'Save'}
          </button>
          {status && <span role="status" className="text-xs text-emerald-700">{status}</span>}
        </div>
      </form>
    </>
  );
}

function WorkItem({ item, specialistFirstName, own, onChanged }) {
  return (
    <li className="rounded-lg border border-stone-200 bg-stone-50/60 p-3 print:break-inside-avoid">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{TYPE_LABELS[item.type] || 'Activity'} · sent {longDate(item.submittedAt)}</p>
      <p className="mt-0.5 whitespace-pre-line text-sm font-medium text-slate-900">{item.prompt}</p>
      {item.file && <div className="mt-2 print:hidden"><ActivityFileLink kind="answer" id={item.answerId} file={item.file} /></div>}
      {item.file && <p className="mt-1 hidden text-sm text-slate-700 print:block">File sent: {item.file.name}</p>}
      {item.text && <p className="mt-2 whitespace-pre-line rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-slate-800">{item.text}</p>}
      {item.reviewedAt ? (
        <div className="mt-2">
          <p className="text-sm text-emerald-900"><span className="font-semibold">{specialistFirstName || 'Specialist'} replied:</span> {item.feedback || 'Seen ✓'}</p>
          <RubricSummary rubric={item.rubric} className="mt-0.5" />
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Not read by the specialist yet.</p>
      )}
      <Reflection item={item} own={own} />
    </li>
  );
}

export function CertificateActions({ certificate, onFileError }) {
  if (!certificate.hasFile) return null;
  async function open(download) {
    onFileError('');
    try {
      await openCertificate(certificate.id, { download });
    } catch (requestError) {
      onFileError(requestError.response?.data?.message || 'Unable to open this certificate.');
    }
  }
  return (
    <>
      <button type="button" onClick={() => open(false)} className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 print:hidden">View certificate</button>
      <button type="button" onClick={() => open(true)} className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-stone-50 print:hidden">Download</button>
    </>
  );
}

function TopicCard({ topic, own, onFileError, onChanged }) {
  const [open, setOpen] = useState(false);
  const completed = topic.stage === 'completed';
  const firstName = topic.specialist?.split(' ')[0];
  const pre = topic.tests?.pre;
  const post = topic.tests?.post;
  const facts = [
    pre && `Pre-test ${pre.score}/${pre.total}${post ? ` → Post-test ${post.score}/${post.total}${post.score > pre.score ? ` (+${post.score - pre.score})` : ''}` : ''}`,
    !pre && post && `Post-test ${post.score}/${post.total}`,
    topic.activities.total > 0 && `Activities ${topic.activities.done}/${topic.activities.total}`,
    topic.onlineSessions > 0 && `${topic.onlineSessions} online session${topic.onlineSessions === 1 ? '' : 's'}`,
    topic.faceToFaceSessions > 0 && `${topic.faceToFaceSessions} face-to-face`,
  ].filter(Boolean);

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 print:rounded-none print:border-stone-400">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="print:hidden"><TopicTile slug={topic.slug} title={topic.title} phase={topic.phase} /></span>
          <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900">{topic.title}</h3>
          <p className="text-sm text-slate-500">
            {[topic.specialist && `with ${topic.specialist}`, topic.acceptedAt && `${longDate(topic.acceptedAt)}${completed ? ` – ${longDate(topic.completedAt)}` : ''}`, topic.hours && `${topic.hours} hours`].filter(Boolean).join(' · ')}
          </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${completed ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-600'}`}>
          {completed ? 'Completed' : 'In progress'}
        </span>
      </div>

      {facts.length > 0 && <p className="mt-3 text-sm font-medium text-slate-700">{facts.join(' · ')}</p>}

      {topic.certificate && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CertificateActions certificate={topic.certificate} onFileError={onFileError} />
          <span className="text-xs text-slate-500">Certificate issued {longDate(topic.completedAt)}{topic.certificate.issuedBy ? ` by ${topic.certificate.issuedBy}` : ''}</span>
        </div>
      )}

      {topic.work.length > 0 && (
        <div className="mt-4 border-t border-stone-100 pt-3">
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm font-semibold text-brand-600 hover:underline print:hidden">
            {open ? '▾' : '▸'} {own ? 'My work' : 'Work'} ({topic.work.length})
          </button>
          <p className="hidden text-sm font-semibold text-slate-800 print:block">Work ({topic.work.length})</p>
          {/* Printing always shows the work. */}
          <ul className={`mt-2 space-y-2 ${open ? '' : 'hidden print:block'}`}>
            {topic.work.map((item) => <WorkItem key={item.answerId} item={item} specialistFirstName={firstName} own={own} onChanged={onChanged} />)}
          </ul>
        </div>
      )}
    </article>
  );
}

// Adds or edits something the beneficiary adds themself.
export function ItemForm({ kind, item, onDone, onCancel }) {
  const copy = ITEM_COPY[kind];
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [itemDate, setItemDate] = useState(item?.itemDate || '');
  const [file, setFile] = useState(null);
  const [keepFile, setKeepFile] = useState(Boolean(item?.file));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasFile = Boolean(file) || keepFile;
  const canSave = title.trim() && (kind !== 'photo' || hasFile) && (!['project', 'letter'].includes(kind) || hasFile || description.trim());

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('kind', kind);
    form.append('title', title);
    form.append('description', description);
    form.append('itemDate', itemDate);
    if (file) form.append('file', file);
    else if (item?.file && !keepFile) form.append('removeFile', '1');
    try {
      if (item) await axiosClient.put(`/elevate/portfolio/items/${item.id}`, form);
      else await axiosClient.post('/elevate/portfolio/items', form);
      await onDone();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save this.');
      setBusy(false);
    }
  }

  const input = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';
  return (
    <form onSubmit={save} className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-4 print:hidden">
      <label className="block text-sm font-medium text-slate-700">
        {copy.title}
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={190} placeholder={copy.placeholder} className={input} />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        Date <span className="font-normal text-slate-500">(optional)</span>
        <input type="date" value={itemDate} onChange={(event) => setItemDate(event.target.value)} className={`${input} max-w-44`} />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700">
        {copy.notes}
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={1000} className={input} />
      </label>
      <div className="mt-3">
        <p className="mb-1 text-sm font-medium text-slate-700">{copy.file}</p>
        {keepFile && !file && item?.file && (
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-700">
            <span className="truncate">Current: {item.file.name}</span>
            <button type="button" onClick={() => setKeepFile(false)} aria-label={`Remove ${item.file.name}`} className="px-1 text-lg leading-none text-slate-400 hover:text-red-600">×</button>
          </div>
        )}
        <FilePicker
          file={file}
          onChange={setFile}
          buttonText={item?.file ? 'Replace file' : 'Choose file'}
          accept={kind === 'photo' ? PHOTO_ACCEPT : undefined}
          validate={kind === 'photo' ? photoError : undefined}
          hint={kind === 'photo' ? 'JPG or PNG. Up to 20 MB.' : ACTIVITY_FILE_HINT}
        />
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={!canSave || busy} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-40">
          {busy ? 'Saving…' : item ? 'Save changes' : 'Add to portfolio'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>
      </div>
    </form>
  );
}

// Add button + form, for a section the beneficiary can add to.
export function useItemEditor(onChanged) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(null); // 'new' or an item
  const [error, setError] = useState('');
  async function remove(item) {
    if (!await confirm({ title: 'Remove from your portfolio?', message: `"${item.title}" will no longer show in your portfolio.`, confirmLabel: 'Remove', danger: true })) return;
    setError('');
    try {
      await axiosClient.delete(`/elevate/portfolio/items/${item.id}`);
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove this.');
    }
  }
  async function done() {
    setEditing(null);
    await onChanged();
  }
  return { editing, setEditing, error, remove, done };
}

function ItemActions({ item, editor }) {
  return (
    <span className="flex shrink-0 gap-1 print:hidden">
      <button type="button" onClick={() => editor.setEditing(item)} className="rounded px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
      <button type="button" onClick={() => editor.remove(item)} className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">Remove</button>
    </span>
  );
}

export function ItemCard({ item, own, editor, addedLabel = ADDED_LABEL, onChanged }) {
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-4 print:break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-500">{[longDate(item.itemDate), addedLabel].filter(Boolean).join(' · ')}</p>
        </div>
        {own && <ItemActions item={item} editor={editor} />}
      </div>
      {item.description && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{item.description}</p>}
      {item.previewUrl && <img src={item.previewUrl} alt={item.title} className="mt-2 max-h-56 rounded-lg border border-stone-200 object-contain" />}
      {item.file && !item.previewUrl && <div className="mt-2 print:hidden"><ActivityFileLink kind="portfolio" id={item.id} file={item.file} /></div>}
      {item.file && !item.previewUrl && <p className="mt-1 hidden text-sm text-slate-700 print:block">File: {item.file.name}</p>}
    </li>
  );
}

export function AddButton({ label, onClick }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 print:hidden">{label}</button>;
}

export const itemAddLabel = (kind) => ITEM_COPY[kind].add;

// The learning portfolio, for the beneficiary (own = true) or an admin.
export default function PortfolioView({ data, own = true, onChanged }) {
  const [fileError, setFileError] = useState('');
  const projects = useItemEditor(onChanged);
  const awards = useItemEditor(onChanged);
  const photos = useItemEditor(onChanged);
  const { person, about, summary, skillProfile, topics, items } = data;
  const phases = [...new Set(topics.map((topic) => topic.phase))];
  const byKind = (kind) => items.filter((item) => item.kind === kind);
  const certificates = topics.filter((topic) => topic.certificate);
  const counts = [
    '',
    skillProfile.topics.length ? `${skillProfile.topics.length} topics` : '',
    `${topics.length} topic${topics.length === 1 ? '' : 's'}, ${byKind('project').length} project${byKind('project').length === 1 ? '' : 's'}`,
    `${certificates.length} certificate${certificates.length === 1 ? '' : 's'}, ${byKind('award').length} award${byKind('award').length === 1 ? '' : 's'}`,
    `${byKind('photo').length} photo${byKind('photo').length === 1 ? '' : 's'}`,
  ];
  const aboutRows = [
    ['School or organization', about.schoolOrOrg],
    ['Education', EDUCATION_LABELS[about.education]],
    ['Goal', about.goalLabel],
    ['Address', person.place],
    ['Joined iELEVATE', longDate(person.joinedAt)],
  ].filter(([, value]) => value);

  function jump(event, id) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div>
      {/* Cover: its own page on paper. */}
      <section className="mb-5 rounded-2xl border border-stone-200 bg-white px-6 py-10 text-center print:flex print:min-h-[85vh] print:flex-col print:items-center print:justify-center print:rounded-none print:border-0 break-after-page">
        <div className="mb-4 flex justify-center"><Avatar person={person} about={about} size="h-28 w-28" /></div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-600">ELEVATE Program · CTU-Tuburan</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{person.name}</h2>
        <p className="mt-1 text-lg text-slate-600">Learning Portfolio</p>
        {about.schoolOrOrg && <p className="mt-3 text-sm text-slate-600">{about.schoolOrOrg}</p>}
        {person.place && <p className="text-sm text-slate-500">{person.place}</p>}
        <p className="mt-3 hidden text-sm text-slate-500 print:block">Printed {new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </section>

      {/* Contents: its own page on paper. */}
      <nav aria-label="Contents" className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 print:rounded-none print:border-0 print:p-0 break-after-page">
        <h2 className="mb-2 text-lg font-bold text-slate-900">Contents</h2>
        <ol className="divide-y divide-stone-100">
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`} onClick={(event) => jump(event, section.id)} className="flex items-baseline justify-between gap-3 py-2 text-sm hover:text-brand-600">
                <span className="font-medium text-slate-800">{index + 1}. {section.title}</span>
                <span className="text-xs text-slate-500">{counts[index]}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {fileError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p>}

      <Section index={0}>
        <div className="flex flex-wrap items-start gap-5">
          <Avatar person={person} about={about} size="h-20 w-20 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-slate-900">{person.name}</p>
            {about.bio
              ? <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{about.bio}</p>
              : own && <p className="mt-1 text-sm text-slate-500 print:hidden">Add your photo and a short bio on your <Link to="/profile" className="font-medium text-brand-600 hover:underline">Profile</Link>.</p>}
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {aboutRows.map(([label, value]) => (
                <div key={label}>
                  <dt className="inline text-slate-500">{label}: </dt>
                  <dd className="inline text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Topics completed" value={summary.completed} />
          <Stat label="In progress" value={summary.ongoing} />
          <Stat label="Certificates" value={summary.certificates} />
          <Stat label="Training hours completed" value={summary.hoursCompleted} />
        </div>
      </Section>

      <Section index={1}>
        <p className="mb-3 text-sm text-slate-500">
          {skillProfile.topics.length
            ? `From the ELEVATE pre-assessment${skillProfile.firstTakenAt ? `, first taken ${longDate(skillProfile.firstTakenAt)}` : ''}${skillProfile.lastTakenAt && longDate(skillProfile.lastTakenAt) !== longDate(skillProfile.firstTakenAt) ? `, retaken ${longDate(skillProfile.lastTakenAt)}` : ''}.`
            : 'No pre-assessment yet.'}
          {own && <> <Link to="/learning-plan" className="font-medium text-brand-600 hover:underline print:hidden">See your learning plan</Link></>}
        </p>
        {skillProfile.topics.length > 0 && (
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {skillProfile.topics.map((item) => (
              <li key={item.moduleId} className="flex items-center justify-between gap-2 border-b border-stone-100 py-1 text-sm">
                <span className="min-w-0 truncate text-slate-800">{item.title}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Band band={item.startBand} />
                  {item.latestBand && <><span className="text-xs text-slate-400" aria-label="now">→</span><Band band={item.latestBand} /></>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section index={2} plain>
        <p className="-mt-2 mb-4 text-sm text-slate-500">
          Test scores, activities, {own ? 'your' : 'their'} work, reflections and the specialist&apos;s feedback, by topic.
        </p>
        {topics.length ? phases.map((phase) => (
          <div key={phase} className="mb-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{phase}</h3>
            <div className="space-y-4">
              {topics.filter((topic) => topic.phase === phase).map((topic) => <TopicCard key={topic.moduleId} topic={topic} own={own} onFileError={setFileError} onChanged={onChanged} />)}
            </div>
          </div>
        )) : (
          <div className="mb-5 rounded-2xl border border-stone-200 bg-white">
            {own
              ? <EmptyState icon="brand" primary title="Your portfolio fills up as you learn" action={{ to: '/modules', label: 'Go to Modules' }}>Once a specialist accepts you for a topic, it shows here with your scores, your work and, when you finish, your certificate.</EmptyState>
              : <EmptyState icon="book" title="No topics yet">Topics show here once a specialist accepts this beneficiary.</EmptyState>}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Projects and artworks</h3>
          {own && <AddButton label={ITEM_COPY.project.add} onClick={() => projects.setEditing('new')} />}
        </div>
        {projects.error && <p role="alert" className="mt-1 text-sm text-red-600">{projects.error}</p>}
        {projects.editing && <ItemForm key={projects.editing === 'new' ? 'new' : projects.editing.id} kind="project" item={projects.editing === 'new' ? null : projects.editing} onDone={projects.done} onCancel={() => projects.setEditing(null)} />}
        {byKind('project').length > 0
          ? <ul className="mt-3 space-y-3">{byKind('project').map((item) => <ItemCard key={item.id} item={item} own={own} editor={projects} onChanged={onChanged} />)}</ul>
          : <p className="mt-1 text-sm text-slate-500">{own ? 'Add anything you made on your own, like a website, a design or an artwork.' : 'None added.'}</p>}
      </Section>

      <Section index={3} action={own && <AddButton label={ITEM_COPY.award.add} onClick={() => awards.setEditing('new')} />}>
        {awards.error && <p role="alert" className="mb-2 text-sm text-red-600">{awards.error}</p>}
        {awards.editing && <ItemForm key={awards.editing === 'new' ? 'new' : awards.editing.id} kind="award" item={awards.editing === 'new' ? null : awards.editing} onDone={awards.done} onCancel={() => awards.setEditing(null)} />}
        {certificates.length > 0 && (
          <ul className="mt-3 space-y-3">
            {certificates.map((topic) => (
              <li key={topic.moduleId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 print:break-inside-avoid">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{topic.title}</p>
                  <p className="text-xs text-slate-500">Certificate · issued {longDate(topic.completedAt)}{topic.certificate.issuedBy ? ` by ${topic.certificate.issuedBy}` : ''}</p>
                </div>
                <div className="flex gap-2"><CertificateActions certificate={topic.certificate} onFileError={setFileError} /></div>
              </li>
            ))}
          </ul>
        )}
        {byKind('award').length > 0 && <ul className="mt-3 space-y-3">{byKind('award').map((item) => <ItemCard key={item.id} item={item} own={own} editor={awards} />)}</ul>}
        {!certificates.length && !byKind('award').length && <p className="text-sm text-slate-500">{own ? 'Certificates from your specialists appear here. You can also add awards and recognitions you received.' : 'None yet.'}</p>}
      </Section>

      <Section index={4} action={own && <AddButton label={ITEM_COPY.photo.add} onClick={() => photos.setEditing('new')} />}>
        {photos.error && <p role="alert" className="mb-2 text-sm text-red-600">{photos.error}</p>}
        {photos.editing && <ItemForm key={photos.editing === 'new' ? 'new' : photos.editing.id} kind="photo" item={photos.editing === 'new' ? null : photos.editing} onDone={photos.done} onCancel={() => photos.setEditing(null)} />}
        {byKind('photo').length > 0 ? (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            {byKind('photo').map((item) => (
              <li key={item.id} className="print:break-inside-avoid">
                <figure className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <img src={item.previewUrl} alt={item.title} className="h-48 w-full bg-stone-100 object-cover" />
                  <figcaption className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold text-slate-900">{item.title}</p>
                      {own && <ItemActions item={item} editor={photos} />}
                    </div>
                    {item.description && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-700">{item.description}</p>}
                    <p className="mt-0.5 text-xs text-slate-500">{[longDate(item.itemDate), ADDED_LABEL].filter(Boolean).join(' · ')}</p>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">{own ? 'Add photos of training events, group work or performance tasks.' : 'None added.'}</p>}
      </Section>
    </div>
  );
}
