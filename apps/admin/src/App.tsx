import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuthStore } from './stores/auth';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/toaster';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import JobsPage from './pages/JobsPage';
import QueuePage from './pages/QueuePage';
import TicketsPage from './pages/TicketsPage';
import FinOpsPage from './pages/FinOpsPage';
import ConfigPage from './pages/ConfigPage';
import PricingPage from './pages/PricingPage';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <Layout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/users/:id" element={<UserDetailPage />} />
                  <Route path="/jobs" element={<JobsPage />} />
                  <Route path="/queue" element={<QueuePage />} />
                  <Route path="/tickets" element={<TicketsPage />} />
                  <Route path="/finops" element={<FinOpsPage />} />
                  <Route path="/config" element={<ConfigPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                </Routes>
              </Layout>
            </AuthGuard>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
