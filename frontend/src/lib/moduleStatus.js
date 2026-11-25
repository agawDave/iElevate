// Where a specialist's own module for a topic stands (specialist_modules.status).
// `none` = they haven't created one yet.
export const MODULE_STATUS = {
  none: { label: 'No module yet', style: 'bg-stone-100 text-slate-600' },
  draft: { label: 'Draft', style: 'bg-stone-100 text-slate-700' },
  pending: { label: 'Waiting for approval', style: 'bg-amber-50 text-amber-800' },
  approved: { label: 'Approved', style: 'bg-emerald-50 text-emerald-700', check: true },
  changes_requested: { label: 'Changes requested', style: 'bg-red-50 text-red-700' },
};

export function moduleStatusOf(module) {
  return MODULE_STATUS[module?.status] || MODULE_STATUS.none;
}

// The specialist's create / edit page for their module on a topic.
export const moduleEditorPath = (topicId) => `/teach/${topicId}`;

export function contentSummary({ materials = 0, testQuestions = 0, hours = 0 } = {}) {
  return [
    hours ? `${hours} hour${hours === 1 ? '' : 's'}` : null,
    `${materials} material${materials === 1 ? '' : 's'}`,
    testQuestions ? `pre/post-test: ${testQuestions} question${testQuestions === 1 ? '' : 's'}` : 'no pre/post-test',
  ].filter(Boolean).join(' · ');
}
