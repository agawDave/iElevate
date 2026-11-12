import { useRef, useState } from 'react';
import { formatFileSize } from '../../lib/certificates';
import { ACTIVITY_FILE_ACCEPT, activityFileError, fileBadge, openActivityFile, opensInBrowser } from '../../lib/activityFiles';

// A file-task file (the worksheet or a learner's answer) with Open / Download.
export function ActivityFileLink({ kind, id, file, note }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!file) return null;
  const inline = opensInBrowser(file.mimeType);

  async function open() {
    setBusy(true);
    setError('');
    try {
      await openActivityFile(kind, id, file.mimeType);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not open the file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
        <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-[10px] font-bold tracking-wide text-brand-700" aria-hidden="true">
          {fileBadge(file.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">{file.name}</span>
          <span className="text-xs text-slate-500">{formatFileSize(file.size)}{note ? ` · ${note}` : ''}</span>
        </span>
        <button type="button" onClick={open} disabled={busy} className="shrink-0 rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
          {busy ? 'Opening…' : inline ? 'Open' : 'Download'}
        </button>
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Picks one file, checked against the same rules as the server.
// accept and validate narrow it further (for example, photos only).
export function FilePicker({ file, onChange, buttonText = 'Choose file', hint, id, accept = ACTIVITY_FILE_ACCEPT, validate }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');

  function pick(event) {
    const chosen = event.target.files?.[0];
    event.target.value = ''; // so the same file can be picked again after removing it
    if (!chosen) return;
    const problem = validate?.(chosen) || activityFileError(chosen);
    setError(problem);
    if (!problem) onChange(chosen);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50">
          {buttonText}
        </button>
        {file && (
          <span className="flex min-w-0 items-center gap-1 text-sm text-slate-700">
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-xs text-slate-500">({formatFileSize(file.size)})</span>
            <button type="button" onClick={() => onChange(null)} aria-label={`Remove ${file.name}`} className="px-1 text-lg leading-none text-slate-400 hover:text-red-600">×</button>
          </span>
        )}
      </div>
      <input ref={inputRef} id={id} type="file" accept={accept} onChange={pick} className="sr-only" tabIndex={-1} aria-hidden="true" />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
