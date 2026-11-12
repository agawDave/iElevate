import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { DetailPanel } from '../admin/Directory';
import MaterialsList from './MaterialsList';
import SpecialistMaterialsForm from './SpecialistMaterialsForm';
import { withFileLinks } from '../../lib/moduleFiles';
import { SkeletonLines } from '../ui/Skeleton';

// A topic's materials in a panel over the Modules page. Specialists can also
// add and remove their own materials, and switch between topics they teach.
export default function MaterialsPanel({ topicId, topics = [], onClose }) {
  const [currentId, setCurrentId] = useState(topicId);
  const [module, setModule] = useState(null);
  const [error, setError] = useState('');
  const [removeError, setRemoveError] = useState('');

  useEffect(() => { setCurrentId(topicId); }, [topicId]);

  const load = useCallback(async () => {
    if (!currentId) return;
    setError('');
    try {
      const response = await axiosClient.get('/modules', { params: { moduleId: currentId, limit: 1 } });
      const loaded = response.data.data[0];
      if (!loaded) {
        setError('This topic is not available.');
        return;
      }
      loaded.resources = await withFileLinks(loaded);
      setModule(loaded);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the materials.');
    }
  }, [currentId]);

  useEffect(() => {
    setModule(null);
    load();
  }, [load]);

  async function removeMaterial(resource) {
    if (!window.confirm(`Remove “${resource.title}” for your learners?`)) return;
    setRemoveError('');
    try {
      await axiosClient.delete(`/modules/${module.id}/resources/${resource.id}`);
      await load();
    } catch (requestError) {
      setRemoveError(requestError.response?.data?.message || 'Unable to remove this material.');
    }
  }

  return (
    <DetailPanel open={Boolean(topicId)} title={module ? `Materials · ${module.title}` : 'Materials'} onClose={onClose}>
      {topics.length > 1 && (
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Topic
          <select
            value={currentId || ''}
            onChange={(event) => setCurrentId(event.target.value)}
            className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
          >
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {!module && !error && <SkeletonLines lines={5} label="Loading materials…" />}
      {module && (
        <div className="space-y-6">
          <p className="text-sm leading-6 text-slate-600">
            {module.description} {module.hours ? `Part of the ${module.phase} training design (${module.hours} hours).` : ''}
          </p>
          <MaterialsList resources={module.resources} onRemove={removeMaterial} error={removeError} />
          {module.canAddMaterials && <SpecialistMaterialsForm moduleId={module.id} onAdded={load} />}
        </div>
      )}
    </DetailPanel>
  );
}
