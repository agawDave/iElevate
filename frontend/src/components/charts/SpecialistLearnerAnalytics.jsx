import { useEffect, useState } from 'react';
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

// Specialist dashboard: how many learners are incoming, ongoing and completed,
// per topic, and the weekly trend of new matches and completions.
// showTiles=false when the dashboard already shows the totals above.
export default function SpecialistLearnerAnalytics({ showTiles = true }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [visible, setVisible] = useVisibleSeries('specialist-topic-series');

  useEffect(() => {
    axiosClient.get('/dashboard/specialist-analytics')
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load your learner analytics.'));
  }, []);

  if (error) return <p role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!data) return <div className="mb-6"><SkeletonChart label="Loading your learner analytics…" /></div>;

  return (
    <section className="mb-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{showTiles ? 'Your learners' : 'Learner trends'}</h2>
        {showTiles && <Link to="/modules" className="text-sm font-medium text-brand-600 hover:underline">Open your chats →</Link>}
      </div>
      {showTiles && <StatTiles summary={data.summary} />}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Learners per topic</h3>
              <p className="text-xs text-slate-500">Tap a category to show or hide it.</p>
            </div>
            <SeriesToggle series={PIPELINE_SERIES} visible={visible} onChange={setVisible} />
          </div>
          <StackedTopicBars rows={data.byTopic} visible={visible} emptyText="Add the topics you teach on My Teaching Plan." />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="font-semibold">Weekly trend</h3>
          <p className="mb-3 text-xs text-slate-500">New applications to you and learners you completed, last 8 weeks.</p>
          <WeeklyTrendChart trend={data.trend} />
        </div>
      </div>
    </section>
  );
}
