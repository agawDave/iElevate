import { useEffect, useRef, useState } from 'react';
import { CERTIFICATE_ACCEPT, MAX_CERTIFICATE_MB, certificateFileError, formatFileSize } from '../../lib/certificates';

// The specialist uploads the certificate they made for a learner. "issue" also
// marks the topic completed; "replace" swaps the file of an issued certificate.
// notice: { text, warn } shown above the upload (test scores, unfinished work).
export default function CertificateUploadDialog({ open, mode = 'issue', learnerName, moduleTitle, notice, onCancel, onSubmit }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const chooseRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (!open) return undefined;
    setFile(null);
    setError('');
    setSaving(false);
    chooseRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') cancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  function choose(selected) {
    if (!selected) return;
    const problem = certificateFileError(selected);
    setError(problem);
    setFile(problem ? null : selected);
  }

  async function submit(event) {
    event.preventDefault();
    const problem = certificateFileError(file);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(file);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not upload the certificate. Please try again.');
      setSaving(false);
    }
  }

  const issuing = mode === 'issue';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" role="dialog" aria-modal="true" aria-labelledby="certificate-dialog-title">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{moduleTitle}</p>
            <h2 id="certificate-dialog-title" className="mt-1 text-xl font-semibold">
              {issuing ? `Issue ${learnerName}'s certificate` : `Replace ${learnerName}'s certificate`}
            </h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="text-xl leading-none text-slate-400 hover:text-slate-700">×</button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {issuing
            ? `Upload the certificate you made for ${learnerName}, for example one designed in Canva or Word and saved as a PDF or picture. This marks ${moduleTitle} as completed, and ${learnerName} can view and download the certificate from their Credentials page.`
            : `The new file takes the place of the one ${learnerName} has now.`}
        </p>
        {notice?.text && (
          <p role={notice.warn ? 'alert' : 'status'} className={`mt-3 rounded-lg border px-3 py-2 text-sm ${notice.warn ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            {notice.text}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={CERTIFICATE_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }}
        />
        <button
          ref={chooseRef}
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files?.[0]); }}
          className="mt-4 flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center hover:border-brand-400 hover:bg-brand-50/40 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          {file ? (
            <>
              {preview
                ? <img src={preview} alt="Certificate preview" className="mb-2 max-h-48 rounded border border-stone-200 object-contain" />
                : <span className="mb-1 rounded bg-red-50 px-2 py-1 text-xs font-bold text-red-700">PDF</span>}
              <span className="max-w-full truncate text-sm font-semibold text-slate-800">{file.name}</span>
              <span className="text-xs text-slate-500">{formatFileSize(file.size)} · Click to choose a different file</span>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold text-brand-600">Choose certificate file</span>
              <span className="text-xs text-slate-500">or drag it here · PDF, PNG or JPG, up to {MAX_CERTIFICATE_MB} MB</span>
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-slate-500">Check that {learnerName}&apos;s name is spelled correctly on the certificate.</p>
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-stone-50">Cancel</button>
          <button
            type="submit"
            disabled={!file || saving}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Uploading…' : issuing ? 'Issue certificate & mark completed' : 'Replace certificate'}
          </button>
        </div>
      </form>
    </div>
  );
}
