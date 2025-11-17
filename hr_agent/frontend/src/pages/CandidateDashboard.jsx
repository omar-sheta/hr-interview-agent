import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import InterviewCard from '../components/InterviewCard.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const CandidateDashboard = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [activeInterviewId, setActiveInterviewId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchAssignments = async () => {
      try {
        setLoadingAssignments(true);
        const { data } = await api.get('/api/candidate/interviews', {
          params: { candidate_id: user.user_id },
        });
        setInterviews(data.interviews || []);
        setError('');
      } catch (err) {
        const detail = err.response?.data?.detail;
        if (detail === 'Not Found') {
          setInterviews([]);
          setError('');
        } else {
          setError(detail || 'Unable to fetch interviews');
        }
      } finally {
        setLoadingAssignments(false);
      }
    };

    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const completion = await api.get('/api/candidate/results', {
          params: { candidate_id: user.user_id, candidate_username: user.username },
        });
        const results = completion.data.results || [];
        const doneIds = new Set(results.map((result) => result.interview_id));
        setCompletedIds(doneIds);
        setHistory(results);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchAssignments();
    fetchHistory();
  }, [user]);

  const handleStart = async (interview) => {
    try {
      setActiveInterviewId(interview.id);
      const { data } = await api.post(`/api/candidate/interviews/${interview.id}/start`, {
        candidate_id: user.user_id,
      });
      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001';
      const apiUrl = new URL(apiBase);
      const apiPort = apiUrl.port || (apiUrl.protocol === 'https:' ? '443' : '80');
      const workspaceBase =
        import.meta.env.VITE_WORKSPACE_BASE_URL ||
        `${window.location.protocol}//${window.location.hostname}:8080/hr_agent/client/index.html`;
      const workspaceUrl = new URL(workspaceBase, window.location.origin);
      workspaceUrl.searchParams.set('api_host', apiUrl.hostname);
      workspaceUrl.searchParams.set('api_port', apiPort);
      workspaceUrl.searchParams.set('session_id', data.session.session_id);
      workspaceUrl.searchParams.set('candidate_id', user.user_id);
      workspaceUrl.searchParams.set('candidate_name', user.username);
      workspaceUrl.searchParams.set('interview_id', interview.id);
      workspaceUrl.searchParams.set('interview_title', interview.title);
      window.open(workspaceUrl.toString(), '_blank', 'noopener');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to start interview');
    } finally {
      setActiveInterviewId(null);
    }
  };

  return (
    <>
      <Navbar subtitle="Candidate Workspace" />
      <main className="container">
        <section className="card">
          <h2>Assigned Interviews</h2>
          <p className="muted">You will only see interviews that are currently active for your account.</p>
          {loadingAssignments && <p>Loading interviews...</p>}
          {error && <div className="error-banner">{error}</div>}
          <div className="grid">
            {interviews.map((interview) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                onStart={handleStart}
                isStarting={activeInterviewId === interview.id}
                status={completedIds.has(interview.id) ? 'done' : 'pending'}
              />
            ))}
          </div>
          {!loadingAssignments && !interviews.length && (
            <p className="muted">Your admin has not assigned any interviews yet.</p>
          )}
        </section>
        <section className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Previous Interviews</h2>
          {loadingHistory && <p>Loading history...</p>}
          {!loadingHistory && history.length === 0 && (
            <p className="muted">No interviews completed yet.</p>
          )}
          {!loadingHistory && history.length > 0 && (
            <div className="list">
              {history.map((result) => (
                <article className="list-item" key={result.session_id}>
                  <div>
                    <h4>{result.interview_title || result.interview_id}</h4>
                    <p className="muted">
                      {new Date(result.timestamp).toLocaleString()} · Avg Score:{' '}
                      {result.scores?.average ?? '—'}
                    </p>
                  </div>
                  <div className="list-item__actions">
                    <span className={`status ${result.status || 'pending'}`}>
                      {result.status || 'pending'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default CandidateDashboard;
