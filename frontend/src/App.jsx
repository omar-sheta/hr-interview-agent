import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import CandidateDashboard from './pages/CandidateDashboardNew.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminResultsPage from './pages/AdminResultsPage.jsx';
import WorkspacePage from './pages/WorkspacePage.jsx';
import NotFound from './pages/NotFound.jsx';
import LogoutPage from './pages/LogoutPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route
        path="/candidate"
        element={(
          <ProtectedRoute allowedRoles={['candidate']}>
            <CandidateDashboard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/workspace"
        element={(
          <ProtectedRoute allowedRoles={['candidate']}>
            <WorkspacePage />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin"
        element={(
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/admin/results"
        element={(
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminResultsPage />
          </ProtectedRoute>
        )}
      />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/unauthorized" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
