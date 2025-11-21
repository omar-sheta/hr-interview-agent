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
import AdminInterviews from './pages/AdminInterviews.jsx'; // New import
import CreateInterview from './pages/CreateInterview.jsx'; // New import
import AdminCandidates from './pages/AdminCandidates.jsx'; // New import
import AdminAnalytics from './pages/AdminAnalytics.jsx'; // New import
import AdminLayout from './layouts/AdminLayout.jsx'; // Corrected import path

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} /> {/* Changed SignupPage to SignUpPage to match import */}

      {/* Candidate Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['candidate']}> {/* Added allowedRoles */}
            <CandidateDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview/:interviewId"
        element={
          <ProtectedRoute allowedRoles={['candidate']}> {/* Added allowedRoles */}
            <WorkspacePage />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}> {/* Changed requireAdmin to allowedRoles */}
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="interviews" element={<AdminInterviews />} />
        <Route path="interviews/create" element={<CreateInterview />} />
        <Route path="candidates" element={<AdminCandidates />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="results" element={<AdminResultsPage />} />
        {/* <Route path="settings" element={<AdminSettings />} /> */}
      </Route>

      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/unauthorized" element={<div>Unauthorized Access</div>} />
      <Route path="*" element={<div>Page Not Found</div>} /> {/* Added a generic Not Found for unmatched routes */}
    </Routes>
  );
}

export default App;
