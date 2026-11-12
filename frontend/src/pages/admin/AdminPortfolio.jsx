import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../../components/layout/AppLayout';
import axiosClient from '../../api/axiosClient';
import PortfolioView from '../../components/portfolio/PortfolioView';
import CareerPortfolioView from '../../components/portfolio/CareerPortfolioView';
import PortfolioTabs from '../../components/portfolio/PortfolioTabs';
import { AdminHeader } from '../../components/admin/Directory';
import { headerPrimaryClass } from '../../components/layout/PageHeader';
import { SkeletonLines } from '../../components/ui/Skeleton';

// An admin views (and can print) a beneficiary's portfolio, read-only.
export default function AdminPortfolio() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const tab = searchParams.get('tab') === 'career' ? 'career' : 'learning';

  useEffect(() => {
    setData(null);
    axiosClient.get(`/admin/beneficiaries/${id}/portfolio`)
      .then((response) => setData(response.data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Unable to load this portfolio.'));
  }, [id]);

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <Link to="/admin/beneficiaries" className="mb-2 inline-block text-sm text-slate-500 hover:text-brand-600 print:hidden">← Back to Beneficiaries</Link>
        <AdminHeader
          title={data ? `Portfolio: ${data.person.name}` : 'Portfolio'}
          tabs={<PortfolioTabs onNavy tab={tab} onChange={(value) => setSearchParams(value === 'career' ? { tab: 'career' } : {}, { replace: true })} />}
          actions={<button type="button" onClick={() => window.print()} disabled={!data} className={headerPrimaryClass}>Print / Save as PDF</button>}
        />
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!data && !error && <SkeletonLines lines={10} label="Loading this portfolio…" className="rounded-2xl border border-stone-200 bg-white p-6" />}
        {data && (tab === 'career' ? <CareerPortfolioView data={data} own={false} /> : <PortfolioView data={data} own={false} />)}
      </div>
    </AppLayout>
  );
}
