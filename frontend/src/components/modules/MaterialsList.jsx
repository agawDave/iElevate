import EmptyState from '../ui/EmptyState';

const RESOURCE_LABEL = { link: 'External link', video: 'Video', pdf: 'PDF', docx: 'Word document', excel: 'Excel spreadsheet' };
const OPEN_LABEL = { video: 'Open video', pdf: 'Open PDF', docx: 'Download Word file', excel: 'Download Excel file' };

// A topic's materials: the official program document plus any the
// specialist added. A specialist can remove the ones they added.
export default function MaterialsList({ resources, onRemove, error }) {
  if (!resources?.length) {
    return <div className="rounded-xl border border-stone-200 bg-white"><EmptyState icon="doc" compact title="No materials for this topic yet" /></div>;
  }
  return (
    <>
      <ul className="space-y-3">
        {resources.map((resource) => (
          <li key={resource.id} className="rounded-xl border border-stone-200 bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{resource.title}</p>
                <p className="text-xs text-slate-500">
                  <span className="uppercase">{RESOURCE_LABEL[resource.type] || resource.type}</span>
                  {resource.fileName ? ` · ${resource.fileName}` : ''}
                  {resource.uploadedByMe
                    ? ' · Added by you'
                    : !resource.official && resource.uploaderName ? ` · From your specialist, ${resource.uploaderName}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {resource.type === 'link' ? (
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-600 px-3.5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">Open link</a>
                ) : resource.fileUrl ? (
                  <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-600 px-3.5 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
                    {OPEN_LABEL[resource.type] || 'Open file'}
                  </a>
                ) : (
                  <p role="alert" className="text-xs text-red-600">{resource.accessError || 'Resource unavailable'}</p>
                )}
                {resource.uploadedByMe && onRemove && (
                  <button type="button" onClick={() => onRemove(resource)} aria-label={`Remove ${resource.title}`} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-red-50 hover:text-red-600">
                    Remove
                  </button>
                )}
              </div>
            </div>
            {resource.type === 'video' && resource.fileUrl && (
              <video controls preload="metadata" className="mt-3 max-h-[20rem] w-full rounded-lg bg-black" aria-label={resource.title}>
                <source src={resource.fileUrl} type={resource.mimeType} />
                Your browser does not support embedded video. Use the Open video link.
              </video>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    </>
  );
}
