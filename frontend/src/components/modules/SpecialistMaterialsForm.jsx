import { useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';

const ACCEPT = [
  '.pdf', '.docx', '.xlsx', '.xls', '.mp4', '.m4v', '.webm', '.ogv', '.ogg', '.mov',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
].join(',');
const MAX_FILES = 5;
const MAX_FILE_MB = 100;

function formatSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Lets a specialist attach files and links to a topic they teach. Only the
// beneficiaries matched to this specialist see these materials.
export default function SpecialistMaterialsForm({ moduleId, onAdded }) {
  const fileInput = useRef(null);
  const [files, setFiles] = useState([]);
  const [link, setLink] = useState({ title: '', url: '' });
  const [progress, setProgress] = useState(null);
  const [savingLink, setSavingLink] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function chooseFiles(event) {
    const chosen = Array.from(event.target.files || []);
    const tooBig = chosen.find((file) => file.size > MAX_FILE_MB * 1024 * 1024);
    setMessage('');
    if (tooBig) {
      setError(`${tooBig.name} is larger than ${MAX_FILE_MB} MB.`);
      setFiles([]);
    } else if (chosen.length > MAX_FILES) {
      setError(`Choose up to ${MAX_FILES} files at a time.`);
      setFiles([]);
    } else {
      setError('');
      setFiles(chosen);
    }
  }

  async function uploadFiles(event) {
    event.preventDefault();
    if (!files.length) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    setError('');
    setMessage('');
    setProgress(0);
    try {
      await axiosClient.post(`/modules/${moduleId}/resources/files`, formData, {
        onUploadProgress: (upload) => {
          if (upload.total) setProgress(Math.round((upload.loaded / upload.total) * 100));
        },
      });
      setMessage(`${files.length} file${files.length === 1 ? '' : 's'} added for your learners.`);
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
      onAdded?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to upload these files.');
    } finally {
      setProgress(null);
    }
  }

  async function addLink(event) {
    event.preventDefault();
    const title = link.title.trim();
    const url = link.url.trim();
    if (!title) return setError('Give the link a title.');
    try {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('protocol');
    } catch {
      return setError('Enter a valid link starting with http:// or https://.');
    }
    setSavingLink(true);
    setError('');
    setMessage('');
    try {
      await axiosClient.post(`/modules/${moduleId}/resources/links`, { title, url });
      setLink({ title: '', url: '' });
      setMessage('Link added for your learners.');
      onAdded?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to add this link.');
    } finally {
      setSavingLink(false);
    }
  }

  const uploading = progress !== null;

  return (
    <section className="mb-8 rounded-xl border border-stone-200 bg-stone-50 p-5">
      <h2 className="font-semibold text-slate-900">Add materials for your learners</h2>
      <p className="mt-1 text-sm text-slate-600">
        Upload PDF, Word, Excel, or video files, or add links. Only the beneficiaries matched to you for this topic can see them, and they’re available right away.
      </p>

      <form onSubmit={uploadFiles} className="mt-4">
        <label htmlFor={`material-files-${moduleId}`} className="block text-sm font-medium text-slate-700">
          Files <span className="font-normal text-slate-500">(up to {MAX_FILES} at a time, {MAX_FILE_MB} MB each)</span>
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id={`material-files-${moduleId}`}
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            disabled={uploading}
            onChange={chooseFiles}
            className="block w-full max-w-md rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!files.length || uploading}
            className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50"
          >
            {uploading ? `Uploading… ${progress}%` : 'Upload'}
          </button>
        </div>
        {files.length > 0 && !uploading && (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} · {formatSize(file.size)}</li>)}
          </ul>
        )}
        {uploading && (
          <div className="mt-3 h-2 w-full max-w-md overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </form>

      <form onSubmit={addLink} className="mt-5">
        <p className="text-sm font-medium text-slate-700">Link</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <input
            value={link.title}
            onChange={(event) => setLink((current) => ({ ...current, title: event.target.value }))}
            maxLength={190}
            placeholder="Title, e.g. Google Slides basics video"
            aria-label="Link title"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          />
          <input
            type="url"
            value={link.url}
            onChange={(event) => setLink((current) => ({ ...current, url: event.target.value }))}
            maxLength={2048}
            placeholder="https://…"
            aria-label="Link address"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingLink}
            className="rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
          >
            {savingLink ? 'Adding…' : 'Add link'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
    </section>
  );
}
