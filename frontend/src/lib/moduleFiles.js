import axiosClient from '../api/axiosClient';

// Adds a short-lived link to each uploaded material of a module so it can be
// opened in a new tab (external links are used as they are).
export async function withFileLinks(module) {
  return Promise.all((module.resources || []).map(async (resource) => {
    if (resource.type === 'link') return resource;
    try {
      const access = await axiosClient.get(`/modules/${module.id}/resources/${resource.id}/token`);
      return { ...resource, fileUrl: access.data.data.url };
    } catch {
      return { ...resource, accessError: 'Unable to open this file. Reload the page to try again.' };
    }
  }));
}
