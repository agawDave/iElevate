import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { SkeletonChart } from '../ui/Skeleton';
import {
  PIPELINE_SERIES,
  SeriesToggle,
  StackedTopicBars,
  StatTiles,
  WeeklyTrendChart,
  useVisibleSeries,
} from './PipelineCharts';

const TOP_SPECIALISTS = 10;

// Admin analytics: new (incoming), ongoing and completed learners for the whole
// program and per topic, plus each specialist's counts and weekly trend.
// showTiles=false when the overview already shows the totals above.
export default function AdminPipelineAnalytics({ showTiles = true }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [visible, setVisible] = useVisibleSeries('admin-topic-series');
  const [trendFor, setTrendFor] = useState('all');
  const [phase, setPhase] = useState('all');

  useEffect(() => {
    axiosClient.get('/admin/analytics')
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load analytics.'));
  }, []);

  const phases = useMemo(() => [...new Set((data?.byTopic || []).map((row) => row.phase))], [data]);
  const topicRows = (data?.byTopic || []).filter((row) => phase === 'all' || row.phase === phase);
  // Only the most active specialists here; everyone else is on the Specialists page.
  const topSpecialists = useMemo(() => (data?.specialists || [])
    .map((item) => ({
      ...item,
      recent: item.trend.reduce((sum, week) => sum + week.newMatches + week.completed, 0),
      learners: item.incoming + item.ongoing + item.completed,
    }))
    .filter((item) => item.recent || item.learners)
    .sort((a, b) => b.recent - a.recent || b.learners - a.learners || a.name.localeCompare(b.name))
    .slice(0, TOP_SPECIALISTS), [data]);
  const selectedSpecialist = data?.specialists.find((item) => String(item.id) === trendFor);
  const trend = selectedSpecialist ? selectedSpecialist.trend : data?.trend || [];

  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!data) return <SkeletonChart label="Loading analytics…" />;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{showTiles ? 'Learner analytics' : 'Program trends'}</h2>
        <p className="text-sm text-slate-500">
          Incoming = applied, waiting for the specialist to accept · Ongoing = accepted, doing the module · Completed = the specialist marked them completed and gave the certificate.
        </p>
      </div>
      {showTiles && <StatTiles summary={data.summary} />}

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Learners per module</h3>
            <p className="text-xs text-slate-500">Toggle categories to compare them.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Phase
              <select value={phase} onChange={(event) => setPhase(event.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs">
                <option value="all">All phases</option>
                {phases.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <SeriesToggle series={PIPELINE_SERIES} visible={visible} onChange={setVisible} />
          </div>
        </div>
        <StackedTopicBars rows={topicRows} visible={visible} />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Specialist trends</h3>
            <p className="text-xs text-slate-500">New applications and learners completed per week, last 8 weeks.</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            Show
            <select value={trendFor} onChange={(event) => setTrendFor(event.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs">
              <option value="all">All specialists combined</option>
              {topSpecialists.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <WeeklyTrendChart key={trendFor} trend={trend} />

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">Specialist</th>
                {PIPELINE_SERIES.map((item) => <th key={item.key} className="px-3 py-2 text-right font-medium">{item.key === 'incoming' ? 'New' : item.label}</th>)}
                <th className="px-3 py-2 text-right font-medium">Applications in last 8 weeks</th>
              </tr>
            </thead>
            <tbody>
              {!topSpecialists.length && (
                <tr><td colSpan={PIPELINE_SERIES.length + 2} className="py-4 text-center text-slate-500">No specialist has learners yet.</td></tr>
              )}
              {topSpecialists.map((item) => {
                const recent = item.trend.reduce((sum, week) => sum + week.newMatches, 0);
                return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50 ${String(item.id) === trendFor ? 'bg-brand-50' : ''}`}
                    onClick={() => setTrendFor(String(item.id))}
                  >
                    <td className="py-2 pr-3 font-medium text-slate-800">{item.name}</td>
                    {PIPELINE_SERIES.map((series) => <td key={series.key} className="px-3 py-2 text-right tabular-nums">{item[series.key]}</td>)}
                    <td className="px-3 py-2 text-right tabular-nums">{recent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Showing the {topSpecialists.length} most active. Click one to see their trend above.</span>
            <Link to="/admin/specialists?sort=learners" className="font-semibold text-brand-600 hover:underline">
              See all {data.specialists.length.toLocaleString()} specialists →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
