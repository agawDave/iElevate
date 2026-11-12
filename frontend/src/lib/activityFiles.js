import axiosClient from '../api/axiosClient';

// File tasks: the specialist's worksheet and the learner's answer file.
// Same rules as the server (activityFileUpload.js), so mistakes show early.
export const ACTIVITY_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png';
export const MAX_ACTIVITY_FILE_MB = 20;
export const ACTIVITY_FILE_HINT = `PDF, Word, Excel or PowerPoint, or a JPG or PNG photo. Up to ${MAX_ACTIVITY_FILE_MB} MB.`;
const EXTENSIONS = ACTIVITY_FILE_ACCEPT.split(',');

export function activityFileError(file) {
  if (!file) return '';
  const name = file.name.toLowerCase();
  if (!EXTENSIONS.some((extension) => name.endsWith(extension))) return 'Choose a PDF, Word, Excel or PowerPoint file, or a JPG or PNG photo.';
  if (file.size > MAX_ACTIVITY_FILE_MB * 1024 * 1024) return `The file can be up to ${MAX_ACTIVITY_FILE_MB} MB.`;
  if (!file.size) return 'That file is empty.';
  return '';
}

// "DOCX", "PDF", "JPG"…
export function fileBadge(name = '') {
  const extension = name.split('.').pop().toUpperCase();
  return extension === 'JPEG' ? 'JPG' : extension.slice(0, 4);
}

// PDFs and photos open in a new tab; Office files download.
export const opensInBrowser = (mimeType) => /^(application\/pdf|image\/)/.test(mimeType || '');

const LINK_PATHS = {
  task: (id) => `/elevate/activities/${id}/file/link`,
  answer: (id) => `/elevate/activities/answers/${id}/file/link`,
  portfolio: (id) => `/elevate/portfolio/items/${id}/file/link`,
  resume: (id) => `/elevate/portfolio/career/resume/${id}/file/link`,
};

// kind: 'task' (the worksheet, by activity id), 'answer' (by answer id) or
// 'portfolio' (something the beneficiary added, by item id).
// The tab is opened inside the click, before the link is fetched, so pop-up
// blockers allow it.
export async function openActivityFile(kind, id, mimeType) {
  const tab = opensInBrowser(mimeType) ? window.open('', '_blank') : null;
  try {
    const { url, downloadUrl } = (await axiosClient.get(LINK_PATHS[kind](id))).data.data;
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
      return;
    }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    tab?.close();
    throw error;
  }
}
