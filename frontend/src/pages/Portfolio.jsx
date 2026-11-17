import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import axiosClient from '../api/axiosClient';
import PortfolioView from '../components/portfolio/PortfolioView';
import CareerPortfolioView from '../components/portfolio/CareerPortfolioView';
import PortfolioTabs from '../components/portfolio/PortfolioTabs';
import PageHeader, { headerPrimaryClass } from '../components/layout/PageHeader';
import { SkeletonLines } from '../components/ui/Skeleton';

// "My Portfolio": a Learning tab (the full record: cover, contents, About Me,
// skill profile, sample works, certificates, photos) and a Career tab (short,
// for job applications). Each prints on its own. Replaces the old Credentials page.
export default function Portfolio() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const tab = searchParams.get('tab') === 'career' ? 'career' : 'learning';

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
          subtitle={tab === 'career' ? 'A short version for job applications. Print it or save it as a PDF to send to employers.' : 'Your skills, the topics you learned, your scores, your work and your certificates, all in one place.'}
          actions={<button type="button" onClick={() => window.print()} disabled={!data} className={headerPrimaryClass}>Print / Save as PDF</button>}
        >
          <PortfolioTabs onNavy tab={tab} onChange={(value) => setSearchParams(value === 'career' ? { tab: 'career' } : {}, { replace: true })} />
        </PageHeader>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!data && !error && <SkeletonLines lines={10} label="Loading your portfolio…" className="rounded-2xl border border-stone-200 bg-white p-6" />}
        {data && (tab === 'career'
          ? <CareerPortfolioView data={data} own onChanged={load} />
          : <PortfolioView data={data} own onChanged={load} />)}
      </div>
    </AppLayout>
  );
}
