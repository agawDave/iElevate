import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { AdminHeader, DetailPanel, SearchBox } from '../../components/admin/Directory';
import ModulesTabs from '../../components/admin/ModulesTabs';
import { headerButtonClass, headerPrimaryClass } from '../../components/layout/PageHeader';
import { SkeletonLines } from '../../components/ui/Skeleton';
import { useConfirm } from '../../context/ConfirmContext';

// Training design: the project leader manages the ELEVATE phases (each with the
// year it was created) and the modules made for each phase. Every visible module
// is offered: the pre-assessment asks its task, beneficiaries are matched for
// it, and specialists can pick it and make their own module for it.

const EMPTY_MODULE = { title: '', hours: 8, description: '', task: '', goals: [], needs: [], usesComputer: false, foundation: false, note: '' };
const input = 'mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function ModuleRow({ module, goalLabels, onEdit, onMove, first, last }) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-stone-100 px-3 py-2.5 first:border-t-0">
      <div className="flex flex-col items-center">
        <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label={`Move ${module.title} up`} className="px-1 text-[11px] leading-tight text-slate-400 hover:text-brand-600 disabled:opacity-30">▲</button>
        <button type="button" onClick={() => onMove(1)} disabled={last} aria-label={`Move ${module.title} down`} className="px-1 text-[11px] leading-tight text-slate-400 hover:text-brand-600 disabled:opacity-30">▼</button>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{module.title}<span className="ml-2 text-xs font-medium tabular-nums text-slate-400">{module.hours} h</span></p>
        {module.task && <p className="text-xs text-slate-600"><span className="text-slate-400">Pre-assessment:</span> {module.task}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          {module.goals.map((goal) => <span key={goal} title={goalLabels.get(goal)} className="max-w-[14rem] truncate rounded-full bg-brand-50 px-2 text-[11px] font-semibold text-brand-600">{goalLabels.get(goal) || goal}</span>)}
          {module.hidden && <span className="rounded-full bg-amber-50 px-2 text-[11px] font-semibold text-amber-800">Hidden</span>}
          {module.learners > 0 && <span className="rounded-full bg-stone-100 px-2 text-[11px] font-semibold text-slate-600">{plural(module.learners, 'learner', 'learners')}</span>}
        </div>
      </div>
      <button type="button" onClick={onEdit} className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-stone-50">Edit</button>
    </li>
  );
}

function PhaseCard({ phase, modules = phase.modules, goalLabels, searching = false, open, onToggle, onAddModule, onEditModule, onMove, onEditPhase, onDeletePhase }) {
  const visible = phase.modules.filter((module) => !module.hidden);
  const hours = visible.reduce((sum, module) => sum + module.hours, 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-left">
          <span className="w-3 text-xs text-slate-400" aria-hidden="true">{open ? '▾' : '▸'}</span>
          <h2 className="text-base font-extrabold text-brand-800">Phase {phase.number} · {phase.name}</h2>
          {phase.year
            ? <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-700">{phase.year}</span>
            : <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">Year not set</span>}
        </button>
        <span className="ml-auto text-xs tabular-nums text-slate-500">
          {plural(visible.length, 'module', 'modules')}{phase.modules.length > visible.length ? ` · ${phase.modules.length - visible.length} hidden` : ''} · {hours} hours
        </span>
        <button type="button" onClick={onEditPhase} className="text-xs font-semibold text-brand-600 hover:underline">Edit phase</button>
      </div>
      {open && (
        <div className="border-t border-stone-100 px-5 pb-5">
          {modules.length ? (
            <ul className="mt-4 rounded-xl border border-stone-200">
              {modules.map((module, index) => (
                <ModuleRow
                  key={module.id}
                  module={module}
                  goalLabels={goalLabels}
                  // Moving swaps with the real neighbour, so it's off while a search hides some modules.
                  first={searching || index === 0}
                  last={searching || index === modules.length - 1}
                  onEdit={() => onEditModule(module)}
                  onMove={(direction) => onMove(module, direction)}
                />
              ))}
            </ul>
          ) : <p className="mt-4 rounded-xl border border-dashed border-stone-300 p-4 text-sm text-slate-500">No modules yet. Add the first module for this phase; specialists can then pick it and make their module for it.</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onAddModule} className="rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">+ Add module</button>
            {!phase.modules.length && <button type="button" onClick={onDeletePhase} className="text-sm font-semibold text-red-600 hover:underline">Delete this phase</button>}
          </div>
        </div>
      )}
    </section>
  );
}

// Add or edit a module: its details, and how it appears in the pre-assessment.
function ModulePanel({ module, phaseNumber, phases, allModules, goals, onClose, onSaved }) {
  const confirm = useConfirm();
  const [form, setForm] = useState(() => ({ ...EMPTY_MODULE, phase: phaseNumber, ...(module || {}) }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const others = allModules.filter((other) => other.id !== module?.id && !other.hidden);
  const update = (changes) => setForm((previous) => ({ ...previous, ...changes }));
  const toggleIn = (list, value) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const body = {
      title: form.title, phase: Number(form.phase), hours: Number(form.hours), description: form.description, task: form.task,
      goals: form.goals, needs: form.needs, usesComputer: form.usesComputer, foundation: form.foundation, note: form.note,
    };
    try {
      const response = module
        ? await axiosClient.put(`/admin/training-design/modules/${module.id}`, body)
        : await axiosClient.post('/admin/training-design/modules', body);
      onSaved(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the module.');
      setSaving(false);
    }
  }

  async function hideOrRemove() {
    if (!module) return;
    setError('');
    try {
      if (module.hidden) {
        const response = await axiosClient.patch(`/admin/training-design/modules/${module.id}`, { hidden: false });
        return onSaved(response.data.message);
      }
      if (module.inUse) {
        if (!await confirm({ title: `Hide “${module.title}”?`, message: 'Beneficiaries won’t be asked about it or matched for it any more, and specialists can’t pick it. Anyone already learning it keeps their specialist, progress and certificate.', confirmLabel: 'Hide module', danger: true })) return;
        const response = await axiosClient.patch(`/admin/training-design/modules/${module.id}`, { hidden: true });
        return onSaved(response.data.message);
      }
      if (!await confirm({ title: `Delete “${module.title}”?`, message: 'No one is using it, so nothing else is lost.', confirmLabel: 'Delete module', danger: true })) return;
      const response = await axiosClient.delete(`/admin/training-design/modules/${module.id}`);
      return onSaved(response.data.message);
    } catch (requestError) {
      return setError(requestError.response?.data?.message || 'Could not change the module.');
    }
  }

  return (
    <DetailPanel open title={module ? 'Edit module' : `Add a module · Phase ${phaseNumber}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Module title
          <input value={form.title} onChange={(event) => update({ title: event.target.value })} maxLength={190} placeholder="e.g. Canva for Small Businesses" className={input} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block text-sm font-medium text-slate-700">
            Phase
            <select value={form.phase} onChange={(event) => update({ phase: Number(event.target.value) })} className={input}>
              {phases.map((phase) => <option key={phase.number} value={phase.number}>Phase {phase.number} · {phase.name}{phase.year ? ` (${phase.year})` : ''}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Hours
            <input type="number" min="1" max="200" value={form.hours} onChange={(event) => update({ hours: event.target.value })} className={input} />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-500">(optional)</span>
          <textarea value={form.description} onChange={(event) => update({ description: event.target.value })} rows={2} maxLength={500} placeholder="What learners do in this module" className={input} />
        </label>

        <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <h3 className="text-sm font-bold text-brand-800">In the pre-assessment</h3>
          <label className="block text-sm font-medium text-slate-700">
            Task beneficiaries rate
            <input value={form.task} onChange={(event) => update({ task: event.target.value })} maxLength={200} placeholder="e.g. Make a poster or social media graphic in Canva" className={input} />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Goals that need it</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {goals.filter((goal) => goal.startPhase === null).map((goal) => (
                <label key={goal.value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.goals.includes(goal.value)} onChange={() => update({ goals: toggleIn(form.goals, goal.value) })} className="h-4 w-4 rounded border-stone-300 text-brand-600" />
                  {goal.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Needs first <span className="font-normal text-slate-500">(optional)</span></legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {others.map((other) => {
                const on = form.needs.includes(other.id);
                return (
                  <button key={other.id} type="button" aria-pressed={on} onClick={() => update({ needs: toggleIn(form.needs, other.id) })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300 bg-white text-slate-600 hover:bg-stone-50'}`}>
                    <span className="opacity-70">P{other.phase} · </span>{other.title}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-brand-600">More options</summary>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.usesComputer} onChange={(event) => update({ usesComputer: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600" />
                <span>Uses a computer</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.foundation} onChange={(event) => update({ foundation: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-stone-300 text-brand-600" />
                <span>Recommend it even when rated “On my own”</span>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Note for beneficiaries <span className="font-normal text-slate-500">(optional)</span>
                <input value={form.note} onChange={(event) => update({ note: event.target.value })} maxLength={255} placeholder="e.g. Your specialist will confirm your level in a short spoken check." className={input} />
              </label>
            </div>
          </details>
        </section>

        {module?.learners > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {plural(module.learners, 'beneficiary is', 'beneficiaries are')} learning this module. Changes apply to everyone; hiding it keeps their progress and certificates.
          </p>
        )}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" disabled={saving} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50">{saving ? 'Saving…' : module ? 'Save changes' : 'Add module'}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-stone-50">Cancel</button>
          {module && (
            <button type="button" onClick={hideOrRemove} className={`ml-auto text-sm font-semibold ${module.hidden ? 'text-brand-600' : 'text-red-600'} hover:underline`}>
              {module.hidden ? 'Show this module again' : module.inUse ? 'Hide this module' : 'Delete this module'}
            </button>
          )}
        </div>
      </form>
    </DetailPanel>
  );
}

// Add a phase (it gets the next number) or edit one's name and year.
function PhaseDialog({ phase, nextNumber, onClose, onSaved }) {
  const [name, setName] = useState(phase?.name || '');
  const [year, setYear] = useState(phase ? (phase.year ?? '') : new Date().getFullYear());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const number = phase ? phase.number : nextNumber;

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    const body = { name, year: year === '' ? null : Number(year) };
    try {
      const response = phase
        ? await axiosClient.patch(`/admin/training-design/phases/${phase.number}`, body)
        : await axiosClient.post('/admin/training-design/phases', body);
      onSaved(response.data.message, phase ? phase.number : response.data.data.number);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the phase.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="phase-dialog-title">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={onClose} className="fade-enter absolute inset-0 cursor-default bg-slate-900/40" />
      <form onSubmit={save} className="pop-enter relative w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div>
          <h2 id="phase-dialog-title" className="text-lg font-bold text-slate-900">{phase ? `Edit Phase ${number}` : `Add Phase ${number}`}</h2>
          {!phase && <p className="text-sm text-slate-500">A new phase of ELEVATE. Add its modules next, and specialists can pick them and make their own module for each.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
          <label className="block text-sm font-medium text-slate-700">Phase name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="e.g. E-commerce and Online Selling" className={input} autoFocus /></label>
          <label className="block text-sm font-medium text-slate-700">Year<input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} placeholder="e.g. 2026" className={input} /></label>
        </div>
        <p className="-mt-2 text-xs text-slate-500">The year the phase was created. Leave it empty if you don’t know it yet.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-stone-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50">{saving ? 'Saving…' : phase ? 'Save phase' : `Add Phase ${number}`}</button>
        </div>
      </form>
    </div>
  );
}

// The answers to "What is your main goal in joining ELEVATE?" in the
// pre-assessment: rename, add or remove them, then save them together.
function GoalsDialog({ goals, phases, onClose, onSaved }) {
  const [rows, setRows] = useState(() => goals.map((goal) => ({ ...goal, key: goal.value })));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setLabel = (key, label) => setRows((current) => current.map((row) => (row.key === key ? { ...row, label } : row)));
  // New goals go before “Not sure yet” (it has a start phase), which stays last.
  const addRow = () => setRows((current) => [
    ...current.filter((row) => row.startPhase === null),
    { key: `new-${Date.now()}`, value: null, label: '', startPhase: null },
    ...current.filter((row) => row.startPhase !== null),
  ]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await axiosClient.put('/admin/training-design/goals', { goals: rows.map(({ value, label, startPhase }) => ({ value, label, startPhase })) });
      onSaved(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save the goals.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="goals-dialog-title">
      <button type="button" tabIndex={-1} aria-label="Close" onClick={onClose} className="fade-enter absolute inset-0 cursor-default bg-slate-900/40" />
      <form onSubmit={save} className="pop-enter relative flex max-h-[90vh] w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div>
          <h2 id="goals-dialog-title" className="text-lg font-bold text-slate-900">Main goals</h2>
          <p className="text-sm text-slate-500">The answers to “What is your main goal in joining ELEVATE?” in the pre-assessment. Each module lists the goals that need it, and beneficiaries are asked only about their goal’s modules.</p>
        </div>
        <ol className="space-y-2 overflow-y-auto">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{index + 1}</span>
              <input value={row.label} onChange={(event) => setLabel(row.key, event.target.value)} maxLength={150} aria-label={`Goal ${index + 1}`} placeholder="e.g. Get a government job" className={input.replace("mt-1 ", "")} autoFocus={!row.value} />
              {row.startPhase !== null
                ? (
                  <select value={row.startPhase} onChange={(event) => setRows((current) => current.map((item) => (item.key === row.key ? { ...item, startPhase: Number(event.target.value) } : item)))} aria-label={`What “${row.label || `goal ${index + 1}`}” is asked about`} className="w-32 shrink-0 rounded-lg border border-stone-300 px-2 py-2 text-xs text-slate-700">
                    {phases.map((phase) => <option key={phase.number} value={phase.number}>From Phase {phase.number}</option>)}
                    <option value={0}>All phases</option>
                  </select>
                )
                : <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} aria-label={`Remove goal ${index + 1}`} className="w-32 shrink-0 text-left text-xs font-semibold text-red-600 hover:underline">Remove</button>}
            </li>
          ))}
        </ol>
        <button type="button" onClick={addRow} className="self-start rounded-lg border border-brand-600 bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">+ Add a goal</button>
        <p className="text-xs text-slate-500">After adding a goal, tick it under “Goals that need it” in each module it needs. A goal can be removed only when no module needs it and no beneficiary chose it; you can always rename it. The last goal is for beneficiaries without a goal yet: choose the phase it starts from (they move on to the next phase once they finish it), or All phases to ask about every module.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-stone-50">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50">{saving ? 'Saving…' : 'Save goals'}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminTrainingDesign() {
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openPhases, setOpenPhases] = useState(null);
  const [panel, setPanel] = useState(null); // { phase, moduleId | null }
  const [phaseDialog, setPhaseDialog] = useState(null); // { phase | null }
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await axiosClient.get('/admin/training-design');
      setData(response.data.data);
      // The newest phase starts open.
      setOpenPhases((current) => current || new Set(response.data.data.phases.slice(-1).map((phase) => phase.number)));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load the training design.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saved(message, openNumber) {
    setPanel(null);
    setPhaseDialog(null);
    setGoalsOpen(false);
    setNotice(message);
    setError('');
    if (openNumber) setOpenPhases((current) => new Set([...(current || []), openNumber]));
    await load();
    window.dispatchEvent(new Event('admin-counts-changed'));
  }

  async function move(module, direction) {
    try {
      await axiosClient.post(`/admin/training-design/modules/${module.id}/move`, { direction });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not move the module.');
    }
  }

  async function deletePhase(phase) {
    if (!await confirm({ title: `Delete Phase ${phase.number}?`, message: `“${phase.name}” has no modules, so nothing else is lost.`, confirmLabel: 'Delete phase', danger: true })) return;
    try {
      const response = await axiosClient.delete(`/admin/training-design/phases/${phase.number}`);
      await saved(response.data.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete the phase.');
    }
  }

  const phases = data?.phases || [];
  const goals = data?.goals || [];
  const goalLabels = new Map(goals.map((goal) => [goal.value, goal.label]));
  const allModules = phases.flatMap((phase) => phase.modules);
  const panelModule = panel?.moduleId ? allModules.find((module) => module.id === panel.moduleId) : null;
  const nextNumber = (phases.length ? Math.max(...phases.map((phase) => phase.number)) : 0) + 1;
  const offered = allModules.filter((module) => !module.hidden).length;
  const words = query.toLowerCase();
  const has = (texts) => texts.some((text) => String(text ?? '').toLowerCase().includes(words));
  // A phase that matches (name, "Phase 4", year) shows all its modules; otherwise only the matching ones.
  const phaseMatches = (phase) => has([`Phase ${phase.number}`, phase.name, phase.year]);
  const shown = phases
    .map((phase) => ({ phase, modules: phaseMatches(phase) ? phase.modules : phase.modules.filter((module) => has([module.title, module.task, module.description])) }))
    .filter(({ phase, modules }) => modules.length || phaseMatches(phase));

  return (
    <>
      <AdminHeader
        title="Modules"
        below={<ModulesTabs />}
        meta={`The ELEVATE phases and their modules. All ${offered} visible modules are offered to beneficiaries and specialists.`}
      >
        <SearchBox value={query} onChange={setQuery} placeholder="Phase, module or task…" label="Search phases and modules" />
        <button type="button" onClick={() => { setNotice(''); setGoalsOpen(true); }} disabled={!data} className={headerButtonClass}>Main goals</button>
        <button type="button" onClick={() => { setNotice(''); setPhaseDialog({ phase: null }); }} disabled={!data} className={headerPrimaryClass}>+ Add phase</button>
      </AdminHeader>
      {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <SkeletonLines lines={8} label="Loading the training design…" className="rounded-2xl border border-stone-200 bg-white p-6" />}
      {data && !phases.length && <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-slate-500">No phases yet. Add the first phase to start the training design.</p>}
      <div className="space-y-3">
        {words && !shown.length && <p className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-sm text-slate-500">No phase or module matches “{query}”.</p>}
        {shown.map(({ phase, modules }) => (
          <PhaseCard
            key={phase.number}
            phase={phase}
            modules={modules}
            goalLabels={goalLabels}
            searching={modules.length < phase.modules.length}
            open={Boolean(words || openPhases?.has(phase.number))}
            onToggle={() => setOpenPhases((current) => {
              const next = new Set(current);
              if (next.has(phase.number)) next.delete(phase.number); else next.add(phase.number);
              return next;
            })}
            onAddModule={() => { setNotice(''); setPanel({ phase: phase.number, moduleId: null }); }}
            onEditModule={(module) => { setNotice(''); setPanel({ phase: phase.number, moduleId: module.id }); }}
            onMove={move}
            onEditPhase={() => { setNotice(''); setPhaseDialog({ phase }); }}
            onDeletePhase={() => deletePhase(phase)}
          />
        ))}
      </div>
      {panel && (panel.moduleId === null || panelModule) && (
        <ModulePanel key={`${panel.phase}:${panel.moduleId}`} module={panelModule} phaseNumber={panel.phase} phases={phases} allModules={allModules} goals={goals} onClose={() => setPanel(null)} onSaved={(message) => saved(message, panel.phase)} />
      )}
      {goalsOpen && <GoalsDialog goals={goals} phases={phases} onClose={() => setGoalsOpen(false)} onSaved={saved} />}
      {phaseDialog && <PhaseDialog phase={phaseDialog.phase} nextNumber={nextNumber} onClose={() => setPhaseDialog(null)} onSaved={saved} />}
    </>
  );
}
