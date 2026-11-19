import { useCallback, useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import axiosClient from '../api/axiosClient';
import PortfolioView from '../components/portfolio/PortfolioView';
import PageHeader, { headerPrimaryClass } from '../components/layout/PageHeader';
import { SkeletonLines } from '../components/ui/Skeleton';

// "My Portfolio": the beneficiary's learning record (cover, contents, About Me,
// skill profile, sample works, certificates, photos). It prints on its own.
export default function Portfolio() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await axiosClient.get('/elevate/portfolio/me');
      setData(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load your portfolio.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <AppLayout>
      <div>
        {/* On paper the portfolio starts with its own first page (the header doesn't print). */}
        <PageHeader
          title="My Portfolio"
          subtitle="Your skills, the topics you learned, your scores, your work and your certificates, all in one place."
          actions={<button type="button" onClick={() => window.print()} disabled={!data} className={headerPrimaryClass}>Print / Save as PDF</button>}
        />
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!data && !error && <SkeletonLines lines={10} label="Loading your portfolio…" className="rounded-2xl border border-stone-200 bg-white p-6" />}
        {data && <PortfolioView data={data} own onChanged={load} />}
      </div>
    </AppLayout>
  );
}
