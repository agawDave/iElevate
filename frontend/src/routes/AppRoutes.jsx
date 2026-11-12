import { Navigate, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import BeneficiaryLearningGoalGate from '../components/BeneficiaryLearningGoalGate';

import LandingPage from '../pages/LandingPage';
import Login from '../pages/Login';
import Signup from '../pages/Signup';
import Dashboard from '../pages/Dashboard';
import LearningGoalsOnboarding from '../pages/LearningGoalsOnboarding';
import Profile from '../pages/Profile';
import LearningPlan from '../pages/LearningPlan';
import Modules from '../pages/Modules';
import { MessagesRedirect, ModuleRedirect } from '../pages/ModuleRedirect';
import ModulePage from '../pages/ModulePage';
import Sessions from '../pages/Sessions';
import Portfolio from '../pages/Portfolio';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminBeneficiaries from '../pages/admin/AdminBeneficiaries';
import AdminSpecialists from '../pages/admin/AdminSpecialists';
import AdminModules from '../pages/admin/AdminModules';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminReports from '../pages/admin/AdminReports';
import AdminActivityLog from '../pages/admin/AdminActivityLog';
import AdminPortfolio from '../pages/admin/AdminPortfolio';
import NotFound from '../pages/NotFound';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute nonAdminOnly />}>
        <Route path="/onboarding/learning-goals" element={<LearningGoalsOnboarding />} />
        <Route element={<BeneficiaryLearningGoalGate />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/learning-plan" element={<LearningPlan />} />
          <Route path="/messages" element={<MessagesRedirect />} />
          <Route path="/modules" element={<Modules />} />
          <Route path="/modules/create" element={<Navigate to="/modules" replace />} />
          <Route path="/modules/:moduleId/chat" element={<ModuleRedirect />} />
          <Route path="/modules/:moduleId" element={<ModulePage />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/credentials" element={<Navigate to="/portfolio" replace />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requireRole="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/beneficiaries" element={<AdminBeneficiaries />} />
        <Route path="/admin/beneficiaries/:id/portfolio" element={<AdminPortfolio />} />
        <Route path="/admin/specialists" element={<AdminSpecialists />} />
        <Route path="/admin/modules" element={<AdminModules />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/activity" element={<AdminActivityLog />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
