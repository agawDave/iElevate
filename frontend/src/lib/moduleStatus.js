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

// { pre, post } question counts → "pre-test 5 · post-test 4" (empty ones say so).
export function testsSummary({ pre = 0, post = 0 } = {}) {
  if (!pre && !post) return 'no pre-test or post-test yet';
  return [pre ? `pre-test ${pre}` : 'no pre-test', post ? `post-test ${post}` : 'no post-test'].join(' · ');
}

export function contentSummary({ materials = 0, testQuestions, hours = 0 } = {}) {
  return [
    hours ? `${hours} hour${hours === 1 ? '' : 's'}` : null,
    `${materials} material${materials === 1 ? '' : 's'}`,
    testsSummary(testQuestions),
  ].filter(Boolean).join(' · ');
}
