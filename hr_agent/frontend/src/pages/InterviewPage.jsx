import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const InterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const session = location.state?.session;
  const interview = location.state?.interview;

  if (!session || !interview) {
    return (
      <div className="auth-layout">
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="muted">No interview session found. Start from your dashboard.</p>
          <button onClick={() => navigate('/candidate')}>Go back</button>
        </div>
      </div>
    );
  }

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001';
  const apiUrl = new URL(apiBase);
  const apiPort = apiUrl.port || (apiUrl.protocol === 'https:' ? '443' : '80');
  const workspaceBase =
    import.meta.env.VITE_WORKSPACE_BASE_URL ||
    `${window.location.protocol}//${window.location.hostname}:8080/hr_agent/client/index.html`;
  const workspaceUrl = new URL(workspaceBase, window.location.origin);
  workspaceUrl.searchParams.set('api_host', apiUrl.hostname);
  workspaceUrl.searchParams.set('api_port', apiPort);
  workspaceUrl.searchParams.set('session_id', session.session_id);
  workspaceUrl.searchParams.set('candidate_id', user?.user_id || '');
  workspaceUrl.searchParams.set('candidate_name', user?.username || '');
  workspaceUrl.searchParams.set('interview_id', interview.id);
  workspaceUrl.searchParams.set('interview_title', interview.title);

  return (
    <>
      <Navbar subtitle="Interview Session" />
      <main className="container">
        <section className="card">
          <h2>{interview.title}</h2>
          <p className="muted">Session ID: {session.session_id}</p>
          <p>
            Use the button below to launch the full voice-enabled experience. The existing microphone
            workflow will open in a new tab and still talks to the same FastAPI server.
          </p>
          <div className="cta-row">
            <button onClick={() => window.open(workspaceUrl.toString(), '_blank')}>Launch Interview Workspace</button>
            <button className="ghost" onClick={() => navigate('/candidate')}>
              Done
            </button>
          </div>
          <div className="info-box">
            <p>
              Once you finish every question, the interview will be evaluated by our AI pipeline. You will
              only see a confirmation, while admins can review the detailed scores.
            </p>
          </div>
        </section>
      </main>
    </>
  );
};

export default InterviewPage;
