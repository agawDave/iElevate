import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import { HeaderStat, headerPrimaryClass } from '../../components/layout/PageHeader';
import { AdminHeader, MoreFilters, clearButtonClass, filterInputClass, filterLabelClass } from '../../components/admin/Directory';
import axiosClient from '../../api/axiosClient';
import { StackedTopicBars, WeeklyTrendChart } from '../../components/charts/PipelineCharts';
import { BAND_LABELS, SECTOR_LABELS, SEX_LABELS } from '../../lib/profileLabels';
import { csvDate, downloadCsv } from '../../lib/csv';

// Colors from the validated chart palette (CVD-safe; below 3:1 contrast on
// white, so every chart keeps direct labels and a table view).
const PARTICIPATION_SERIES = [
  { key: 'logins', label: 'Logins', color: '#6250d6' },
  { key: 'messages', label: 'Messages', color: '#eda100' },
  { key: 'activities', label: 'Module answers', color: '#e87ba4' },
  { key: 'sessions', label: 'Online sessions', color: '#2a78d6' },
  { key: 'faceToFace', label: 'Face-to-face attended', color: '#eb6834' },
  { key: 'certificates', label: 'Completed modules', color: '#1baf7a' },
];
const COMPLETED_SERIES = [
  { key: 'certificates', label: 'Certificates issued', color: '#1baf7a' },
  { key: 'sessions', label: 'Online sessions', color: '#6250d6' },
  { key: 'faceToFace', label: 'Face-to-face sessions', color: '#eda100' },
];
const PRESETS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: '90d', label: 'Last 3 months' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom dates' },
];
const STAGE_LABELS = { incoming: 'Incoming', ongoing: 'Ongoing', completed: 'Completed' };
// What happened with each topic in the period (the Progress chart).
const PERIOD_SERIES = [
  { key: 'applied', label: 'Applied', color: '#eb6834' },
  { key: 'accepted', label: 'Accepted', color: '#2a78d6' },
  { key: 'completed', label: 'Completed', color: '#1baf7a' },
  { key: 'preTests', label: 'Pre-test', color: '#eda100' },
  { key: 'postTests', label: 'Post-test', color: '#6250d6' },
];
const TEST_LABELS = { pre: 'Pre-test', post: 'Post-test' };
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const percent = (value) => (value === null || value === undefined ? '—' : `${value}%`);

// A learner's topic in the period, in a few words: "Accepted · 3 answers · Pre-test".
function periodText(period) {
  return [
    period.applied && 'Applied',
    period.accepted && 'Accepted',
    period.completed && 'Completed',
    period.answers && `${period.answers} answer${period.answers === 1 ? '' : 's'}`,
    ...period.tests.map((kind) => TEST_LABELS[kind]),
    period.sessions && `${period.sessions} online session${period.sessions === 1 ? '' : 's'}`,
    period.faceToFace && `${period.faceToFace} face-to-face`,
  ].filter(Boolean).join(' · ');
}

function TestStat({ label, value, note }) {
  return (
    <div className="rounded-xl border border-stone-200 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}
const AGE_ORDER = ['24 and under', '25–34', '35–44', '45 and over', 'Not given'];

function iso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function presetRange(key) {
  const today = new Date();
  const day = (offset) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  switch (key) {
    case '7d': return { from: iso(day(-6)), to: iso(today) };
    case 'month': return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) };
    case 'lastmonth': return { from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) };
    case '90d': return { from: iso(day(-89)), to: iso(today) };
    case 'year': return { from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) };
    default: return { from: iso(day(-29)), to: iso(today) };
  }
}

function longDate(value) {
  return value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '';
}

function shortDate(value) {
  return value ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

function Section({ title, subtitle, actions, children }) {
  return (
    <section className="mt-8 break-inside-avoid-page rounded-2xl border border-stone-200 bg-white p-5 print:mt-6 print:rounded-none print:border-0 print:p-0">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2 print:hidden">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function CsvButton({ onClick, children = 'Download CSV' }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">{children}</button>;
}

// A table that shows the first rows, with "Show all" (printing prints what's shown).
function ReportTable({ columns, rows, limit = 15, emptyText = 'Nothing in this period.' }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-slate-500">
              {columns.map((column) => <th key={column.label} className={`px-3 py-2 font-medium ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, index) => (
              <tr key={row.key ?? index} className="border-b border-stone-100 last:border-0">
                {columns.map((column) => (
                  <td key={column.label} className={`px-3 py-2 align-top ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs font-semibold text-brand-600 hover:underline print:hidden">
          {all ? `Show the first ${limit}` : `Show all ${rows.length.toLocaleString()}`}
        </button>
      )}
    </div>
  );
}

function Breakdown({ title, counts, order, labels }) {
  const keys = order || [...new Set([...Object.keys(counts.all), ...Object.keys(counts.active)])];
  const rows = keys.filter((key) => counts.all[key] || counts.active[key]);
  return (
    <div className="rounded-xl border border-stone-200 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[12px] text-slate-500">
            <th className="py-1 font-medium" />
            <th className="py-1 text-right font-medium">Active</th>
            <th className="py-1 text-right font-medium">All</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((key) => (
            <tr key={key} className="border-t border-stone-100">
              <td className="py-1 text-slate-700">{labels?.[key] || (key === 'not_given' ? 'Not given' : key)}</td>
              <td className="py-1 text-right font-semibold tabular-nums">{counts.active[key] || 0}</td>
              <td className="py-1 text-right tabular-nums text-slate-600">{counts.all[key] || 0}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="py-2 text-slate-500">No beneficiaries.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Tracking and reporting: participation, progress and completed engagements
// for a period, with filters, charts, tables, CSV downloads and printing.
export default function AdminReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const preset = PRESETS.some((item) => item.key === searchParams.get('range')) ? searchParams.get('range') : '30d';
  const range = preset === 'custom'
    ? { from: searchParams.get('from') || presetRange('30d').from, to: searchParams.get('to') || presetRange('30d').to }
    : presetRange(preset);
  const filters = {
    phase: searchParams.get('phase') || '',
    moduleId: searchParams.get('moduleId') || '',
    city: searchParams.get('city') || '',
    sex: searchParams.get('sex') || '',
    sector: searchParams.get('sector') || '',
  };
  const queryKey = JSON.stringify({ ...range, ...filters });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    axiosClient.get('/admin/reports', { params: JSON.parse(queryKey) })
      .then((response) => { if (active) setReport(response.data.data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to build the report.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryKey]);

  function setParams(changes) {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setSearchParams(next, { replace: true });
  }

  const options = report?.options || { phases: [], topics: [], cities: [] };
  const topicChoices = options.topics.filter((topic) => !filters.phase || topic.phase === filters.phase);
  const filterSummary = useMemo(() => [
    filters.phase,
    filters.moduleId && options.topics.find((topic) => String(topic.id) === filters.moduleId)?.title,
    filters.city,
    filters.sex && SEX_LABELS[filters.sex],
    filters.sector && SECTOR_LABELS[filters.sector],
  ].filter(Boolean).join(' · '), [filters.phase, filters.moduleId, filters.city, filters.sex, filters.sector, options.topics]);
  const fileStem = `ielevate-report-${range.from}-to-${range.to}`;

  const select = filterInputClass;
  const labelClass = filterLabelClass;
  const summary = report?.summary;
  const tiles = summary ? [
    { label: 'Active beneficiaries', value: summary.activeLearners, note: `${summary.newLearners} new` },
    { label: 'Active specialists', value: summary.activeSpecialists },
    { label: 'Applications', value: summary.applications },
    { label: 'Accepted', value: summary.accepted },
    { label: 'Completed (certificates)', value: summary.certificates },
    { label: 'Online sessions', value: summary.onlineSessions },
    { label: 'Face-to-face sessions', value: summary.faceToFaceHeld, note: `${count(summary.faceToFaceAttendance, 'attendee')}` },
  ] : [];

  return (
    <AppLayout>
      {/* The navy header doesn't print; the paper copy has its own heading and numbers below. */}
      <AdminHeader
        title="Reports"
        meta={`${longDate(range.from)} to ${longDate(range.to)}${filterSummary ? ` · ${filterSummary}` : ''}`}
        actions={<button type="button" onClick={() => window.print()} disabled={!report} className={headerPrimaryClass}>Print / Save as PDF</button>}
        below={tiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tiles.map((tile) => <HeaderStat key={tile.label} compact value={tile.value.toLocaleString()} label={tile.note ? `${tile.label} · ${tile.note}` : tile.label} />)}
          </div>
        )}
      >
        <label className={labelClass}>
          Period
          <select value={preset} onChange={(event) => setParams({ range: event.target.value === '30d' ? '' : event.target.value, ...(event.target.value === 'custom' ? range : { from: '', to: '' }) })} className={select}>
            {PRESETS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <input type="date" aria-label="From" value={range.from} max={range.to} onChange={(event) => setParams({ from: event.target.value })} className={select} />
            <span className="text-xs text-brand-100">to</span>
            <input type="date" aria-label="To" value={range.to} min={range.from} onChange={(event) => setParams({ to: event.target.value })} className={select} />
          </>
        )}
        <label className={labelClass}>
          Phase
          <select value={filters.phase} onChange={(event) => setParams({ phase: event.target.value, moduleId: '' })} className={select}>
            <option value="">All phases</option>
            {options.phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Topic
          <select value={filters.moduleId} onChange={(event) => setParams({ moduleId: event.target.value })} className={`${select} max-w-56`}>
            <option value="">All topics</option>
            {topicChoices.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
        <MoreFilters active={['city', 'sex', 'sector'].filter((key) => filters[key]).length}>
          <label className={labelClass}>
            City
            <select value={filters.city} onChange={(event) => setParams({ city: event.target.value })} className={select}>
              <option value="">Anywhere</option>
              {options.cities.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Sex
            <select value={filters.sex} onChange={(event) => setParams({ sex: event.target.value })} className={select}>
              <option value="">Any</option>
              {Object.entries(SEX_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Sector
            <select value={filters.sector} onChange={(event) => setParams({ sector: event.target.value })} className={select}>
              <option value="">Any</option>
              {Object.entries(SECTOR_LABELS).filter(([value]) => value !== 'none').map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
        </MoreFilters>
        {(filterSummary || preset !== '30d') && (
          <button type="button" onClick={() => setSearchParams(new URLSearchParams(), { replace: true })} className={clearButtonClass}>Reset</button>
        )}
      </AdminHeader>

      {/* Report heading on paper. */}
      <div className="mb-4 hidden print:block">
        <p className="text-xs font-semibold uppercase tracking-wider">iELEVATE · ELEVATE Program, CTU-Tuburan</p>
        <h1 className="text-2xl font-extrabold">Program report: {longDate(range.from)} to {longDate(range.to)}</h1>
        <p className="text-sm">{filterSummary || 'All beneficiaries and topics'} · Generated {new Date().toLocaleString()}</p>
      </div>

      {error &&<p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!report && loading && <p className="text-sm text-slate-500">Building the report…</p>}

      {report && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <div className="hidden grid-cols-3 gap-3 print:grid">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-xl border border-stone-200 bg-white p-4 print:border-stone-400">
                <p className="text-xs text-slate-500">{tile.label}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand-600">{tile.value.toLocaleString()}</p>
                {tile.note && <p className="text-xs text-slate-500">{tile.note}</p>}
              </div>
            ))}
          </div>

          <Section
            title="Participation"
            subtitle={`How actively beneficiaries took part in this period: ${count(summary.logins, 'login')}, ${count(summary.messages, 'chat message')} with their specialists (both sides), ${count(summary.activitiesAnswered, 'module answer')}, ${count(summary.onlineSessions, 'online session')}, ${count(summary.faceToFaceAttendance, 'face-to-face session')} attended, and ${count(summary.certificates, 'completed module')} (certificates).`}
            actions={(
              <CsvButton onClick={() => downloadCsv(`${fileStem}-participation.csv`, report.participation.learners, [
                { label: 'Beneficiary', value: (row) => row.name },
                { label: 'Email', value: (row) => row.email },
                { label: 'Barangay', value: (row) => row.barangay },
                { label: 'City', value: (row) => row.city },
                { label: 'Sex', value: (row) => SEX_LABELS[row.sex] || '' },
                { label: 'Age', value: (row) => row.age },
                { label: 'Sectors', value: (row) => row.sectors.map((sector) => SECTOR_LABELS[sector] || sector).join('; ') },
                { label: 'Logins', value: (row) => row.logins },
                { label: 'Messages sent', value: (row) => row.messages },
                { label: 'Module answers', value: (row) => row.activities },
                { label: 'Online sessions', value: (row) => row.sessions },
                { label: 'Face-to-face sessions attended', value: (row) => row.faceToFace },
                { label: 'Applications', value: (row) => row.applications },
                { label: 'Completed modules (certificates)', value: (row) => row.certificates },
                { label: 'Last active', value: (row) => csvDate(row.lastActiveAt) },
              ])}
              />
            )}
          >
            <WeeklyTrendChart trend={report.participation.trend.rows} series={PARTICIPATION_SERIES} unit={report.participation.trend.unit} />
            <p className="mt-2 text-xs text-slate-500">Logins are for beneficiaries and aren&apos;t tied to a topic, so the topic filter doesn&apos;t change them.</p>
            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Who took part</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <Breakdown title="Sex" counts={report.participation.demographics.sex} labels={SEX_LABELS} />
              <Breakdown title="Age group" counts={report.participation.demographics.age} order={AGE_ORDER} />
              <Breakdown title="Sector" counts={report.participation.demographics.sector} labels={SECTOR_LABELS} />
            </div>
            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Each beneficiary</h3>
            <ReportTable
              rows={report.participation.learners.map((row) => ({ ...row, key: row.id }))}
              emptyText="No beneficiaries match these filters."
              columns={[
                { label: 'Beneficiary', render: (row) => <><p className="font-medium text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{[row.barangay && `Brgy. ${row.barangay}`, row.city].filter(Boolean).join(', ')}</p></> },
                { label: 'Logins', align: 'right', render: (row) => row.logins },
                { label: 'Messages sent', align: 'right', render: (row) => row.messages },
                { label: 'Module answers', align: 'right', render: (row) => row.activities },
                { label: 'Online', align: 'right', render: (row) => row.sessions },
                { label: 'Face-to-face', align: 'right', render: (row) => row.faceToFace },
                { label: 'Completed modules', align: 'right', render: (row) => row.certificates },
                { label: 'Last active', render: (row) => shortDate(row.lastActiveAt) },
              ]}
            />
          </Section>

          <Section
            title={`Progress · ${longDate(range.from)} to ${longDate(range.to)}`}
            subtitle="What happened with each topic in this period: applications, acceptances, completions, pre-tests and post-tests, module answers, and online and face-to-face sessions. “Stage” is where the beneficiary stands today."
            actions={(
              <CsvButton onClick={() => downloadCsv(`${fileStem}-progress.csv`, report.progress.learners, [
                { label: 'Beneficiary', value: (row) => row.learner },
                { label: 'Topic', value: (row) => row.topic },
                { label: 'Phase', value: (row) => row.phase },
                { label: 'Specialist', value: (row) => row.specialist },
                { label: 'Stage', value: (row) => STAGE_LABELS[row.stage] },
                { label: 'In this period', value: (row) => periodText(row.period) },
                { label: 'Activities done', value: (row) => row.activitiesDone },
                { label: 'Activities total', value: (row) => row.activitiesTotal },
                { label: 'Pre-test score', value: (row) => (row.preTest ? `${row.preTest.score}/${row.preTest.total}` : '') },
                { label: 'Post-test score', value: (row) => (row.postTest ? `${row.postTest.score}/${row.postTest.total}` : '') },
                { label: 'Pre-assessment before', value: (row) => BAND_LABELS[row.preBand] || '' },
                { label: 'Pre-assessment after', value: (row) => BAND_LABELS[row.postBand] || '' },
                { label: 'Applied', value: (row) => csvDate(row.appliedAt) },
                { label: 'Accepted', value: (row) => csvDate(row.acceptedAt) },
                { label: 'Completed', value: (row) => csvDate(row.completedAt) },
              ])}
              />
            )}
          >
            <div className="mb-1 flex flex-wrap gap-4 text-xs text-slate-600">
              {PERIOD_SERIES.map((item) => (
                <span key={item.key} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
            <StackedTopicBars rows={report.progress.byTopic} series={PERIOD_SERIES} visible={PERIOD_SERIES.map((item) => item.key)} emptyText="No topics match these filters." />
            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Each beneficiary and topic</h3>
            <ReportTable
              rows={report.progress.learners.map((row) => ({ ...row, key: `${row.moduleId}-${row.learnerId}` }))}
              emptyText="No beneficiary did anything with a topic in this period."
              columns={[
                { label: 'Beneficiary', render: (row) => row.learner },
                { label: 'Topic', render: (row) => row.topic },
                { label: 'Specialist', render: (row) => row.specialist || '—' },
                { label: 'Stage', render: (row) => STAGE_LABELS[row.stage] },
                { label: 'In this period', render: (row) => <span className="text-xs text-slate-600">{periodText(row.period)}</span> },
                { label: 'Activities', align: 'right', render: (row) => (row.activitiesTotal ? `${row.activitiesDone}/${row.activitiesTotal}` : '—') },
                { label: 'Topic test', align: 'right', render: (row) => (row.preTest ? `${row.preTest.score}/${row.preTest.total} → ${row.postTest ? `${row.postTest.score}/${row.postTest.total}` : '—'}` : '—') },
                { label: 'Pre-assessment', render: (row) => (row.preBand ? `${BAND_LABELS[row.preBand]}${row.postBand ? ` → ${BAND_LABELS[row.postBand]}` : ''}` : '—') },
              ]}
            />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Pre-test and post-test</h3>
              <CsvButton onClick={() => downloadCsv(`${fileStem}-tests.csv`, report.progress.tests.attempts, [
                { label: 'Taken', value: (row) => csvDate(row.takenAt) },
                { label: 'Beneficiary', value: (row) => row.learner },
                { label: 'Topic', value: (row) => row.topic },
                { label: 'Test', value: (row) => TEST_LABELS[row.kind] },
                { label: 'Score', value: (row) => row.score },
                { label: 'Out of', value: (row) => row.total },
                { label: '% correct', value: (row) => row.percent },
              ])}
              >
                Tests CSV
              </CsvButton>
            </div>
            <p className="mb-3 mt-1 text-xs text-slate-500">Topic tests taken in this period, as % correct. “Took both” compares each post-test taken in this period with the same beneficiary’s pre-test.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TestStat label="Pre-tests taken" value={report.progress.tests.preTaken} note={`average ${percent(report.progress.tests.preAverage)}`} />
              <TestStat label="Post-tests taken" value={report.progress.tests.postTaken} note={`average ${percent(report.progress.tests.postAverage)}`} />
              <TestStat
                label="Took both: pre → post"
                value={report.progress.tests.both ? `${percent(report.progress.tests.bothPreAverage)} → ${percent(report.progress.tests.bothPostAverage)}` : '—'}
                note={report.progress.tests.both
                  ? `${report.progress.tests.both} ${report.progress.tests.both === 1 ? 'beneficiary' : 'beneficiaries'} · ${report.progress.tests.bothPostAverage - report.progress.tests.bothPreAverage >= 0 ? '+' : ''}${report.progress.tests.bothPostAverage - report.progress.tests.bothPreAverage} points`
                  : 'No post-tests in this period'}
              />
              <TestStat label="Improved" value={report.progress.tests.both ? `${report.progress.tests.improved} of ${report.progress.tests.both}` : '—'} note="scored higher on the post-test" />
            </div>
            <div className="mt-4">
              <ReportTable
                rows={report.progress.tests.byTopic.map((row) => ({ ...row, key: row.moduleId }))}
                emptyText="No topic tests were taken in this period."
                columns={[
                  { label: 'Topic', render: (row) => <><p className="text-slate-900">{row.title}</p><p className="text-xs text-slate-500">{row.phase}</p></> },
                  { label: 'Pre-tests', align: 'right', render: (row) => row.preTaken },
                  { label: 'Avg pre-test', align: 'right', render: (row) => percent(row.preAverage) },
                  { label: 'Post-tests', align: 'right', render: (row) => row.postTaken },
                  { label: 'Avg post-test', align: 'right', render: (row) => percent(row.postAverage) },
                  { label: 'Took both: pre → post', align: 'right', render: (row) => (row.both ? <><span className="font-semibold">{percent(row.bothPreAverage)} → {percent(row.bothPostAverage)}</span><span className="block text-xs text-slate-500">{row.both} took both · {row.improved} improved</span></> : '—') },
                ]}
              />
            </div>
          </Section>

          <Section
            title="Completed engagements"
            subtitle={`Finished work in this period: ${count(summary.certificates, 'module')} completed (certificates issued), ${count(summary.moduleAnswers, 'module answer')} sent, ${count(summary.onlineSessions, 'online session')}, and ${count(summary.faceToFaceHeld, 'face-to-face session')} held (${count(summary.faceToFaceAttendance, 'attendee')}). An online session is a day a beneficiary worked on a module online (answers, topic tests); face-to-face sessions are booked one-on-one or posted by a specialist for anyone who needs the topic.`}
            actions={(
              <>
                <CsvButton onClick={() => downloadCsv(`${fileStem}-certificates.csv`, report.completed.certificates, [
                  { label: 'Issued', value: (row) => csvDate(row.issuedAt) },
                  { label: 'Beneficiary', value: (row) => row.learner },
                  { label: 'Topic', value: (row) => row.topic },
                  { label: 'Specialist', value: (row) => row.specialist },
                  { label: 'Days from acceptance', value: (row) => row.daysToComplete },
                ])}
                >
                  Certificates CSV
                </CsvButton>
                <CsvButton onClick={() => downloadCsv(`${fileStem}-specialists.csv`, report.completed.bySpecialist, [
                  { label: 'Specialist', value: (row) => row.name },
                  { label: 'Learners accepted', value: (row) => row.accepted },
                  { label: 'Certificates issued', value: (row) => row.certificates },
                  { label: 'Online sessions', value: (row) => row.sessions },
                  { label: 'Face-to-face sessions held', value: (row) => row.faceToFace },
                  { label: 'Average days to complete', value: (row) => row.averageDays },
                ])}
                >
                  Specialists CSV
                </CsvButton>
              </>
            )}
          >
            <WeeklyTrendChart trend={report.completed.trend.rows} series={COMPLETED_SERIES} unit={report.completed.trend.unit} />
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">By topic</h3>
                <ReportTable
                  rows={report.completed.byTopic.map((row) => ({ ...row, key: row.moduleId }))}
                  columns={[
                    { label: 'Topic', render: (row) => row.title },
                    { label: 'Completed', align: 'right', render: (row) => row.certificates },
                    { label: 'Answers', align: 'right', render: (row) => row.answers },
                    { label: 'Online', align: 'right', render: (row) => row.sessions },
                    { label: 'Face-to-face', align: 'right', render: (row) => row.faceToFace },
                    { label: 'Avg days', align: 'right', render: (row) => (row.averageDays === null ? '—' : row.averageDays) },
                  ]}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">By specialist</h3>
                <ReportTable
                  rows={report.completed.bySpecialist.map((row) => ({ ...row, key: row.id }))}
                  columns={[
                    { label: 'Specialist', render: (row) => row.name },
                    { label: 'Accepted', align: 'right', render: (row) => row.accepted },
                    { label: 'Certificates', align: 'right', render: (row) => row.certificates },
                    { label: 'Online', align: 'right', render: (row) => row.sessions },
                    { label: 'Face-to-face', align: 'right', render: (row) => row.faceToFace },
                    { label: 'Avg days', align: 'right', render: (row) => (row.averageDays === null ? '—' : row.averageDays) },
                  ]}
                />
              </div>
            </div>
            <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">Certificates issued</h3>
            <ReportTable
              rows={report.completed.certificates.map((row, index) => ({ ...row, key: index }))}
              columns={[
                { label: 'Issued', render: (row) => shortDate(row.issuedAt) },
                { label: 'Beneficiary', render: (row) => row.learner },
                { label: 'Topic', render: (row) => row.topic },
                { label: 'Specialist', render: (row) => row.specialist || '—' },
                { label: 'Days from acceptance', align: 'right', render: (row) => (row.daysToComplete === null ? '—' : row.daysToComplete) },
              ]}
            />
            <p className="mt-3 text-xs text-slate-500">"Avg days" is the average time from the specialist accepting the beneficiary to issuing the certificate.</p>
          </Section>
        </div>
      )}
    </AppLayout>
  );
}
