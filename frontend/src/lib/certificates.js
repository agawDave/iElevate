import axiosClient from '../api/axiosClient';

export const CERTIFICATE_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';
export const MAX_CERTIFICATE_MB = 10;

const EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

// Same rules as the server, so mistakes show before uploading.
export function certificateFileError(file) {
  if (!file) return 'Choose the certificate file you made.';
  const name = file.name.toLowerCase();
  if (!EXTENSIONS.some((extension) => name.endsWith(extension))) return 'Choose a PDF, PNG or JPG file.';
  if (file.size > MAX_CERTIFICATE_MB * 1024 * 1024) return `The certificate can be up to ${MAX_CERTIFICATE_MB} MB.`;
  if (!file.size) return 'That file is empty.';
  return '';
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Opens (or downloads) a certificate file. The tab is opened inside the click,
// before the link is fetched, so pop-up blockers allow it.
export async function openCertificate(certificateId, { download = false } = {}) {
  const tab = download ? null : window.open('', '_blank');
  try {
    const response = await axiosClient.get(`/certificates/${certificateId}/link`);
    const { url, downloadUrl } = response.data.data;
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
      return;
    }
    const link = document.createElement('a');
    link.href = download ? downloadUrl : url;
    link.target = download ? '_self' : '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    tab?.close();
    throw error;
  }
}
