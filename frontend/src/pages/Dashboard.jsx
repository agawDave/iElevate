import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import LearnerDashboard from '../components/dashboard/LearnerDashboard';
import SpecialistDashboard from '../components/dashboard/SpecialistDashboard';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Beneficiaries and specialists each get their own dashboard: one next step,
// their numbers and their progress. Staff accounts use the admin overview.
export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0];
  let content;
  if (user?.role === 'moderator') {
    content = (
      <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-slate-600">
        Staff accounts use the <Link to="/admin" className="font-semibold text-brand-600 hover:underline">admin overview</Link>.
      </p>
    );
  } else if (user?.userType === 'specialist') {
    content = <SpecialistDashboard greeting={greeting()} firstName={firstName} />;
  } else {
    content = <LearnerDashboard greeting={greeting()} firstName={firstName} />;
  }
  return <AppLayout>{content}</AppLayout>;
}
