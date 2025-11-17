import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_OPTIONS = ['pending', 'accepted', 'rejected'];

const AdminResultsPage = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ candidateId: '', interviewId: '' });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadResults = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const params = { admin_id: user.user_id };
      if (filters.candidateId) params.candidate_id = filters.candidateId;
      if (filters.interviewId) params.interview_id = filters.interviewId;
      const { data } = await api.get('/api/admin/results', { params });
      setResults(data.results || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to fetch results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const updateStatus = async (sessionId, status, resultId) => {
    if (!user) return;
    await api.put(`/api/admin/results/${sessionId}`, null, {
      params: { admin_id: user.user_id, status, result_id: resultId },
    });
    setResults((prev) =>
      prev.map((result) =>
        result.session_id === sessionId ? { ...result, status } : result
      )
    );
  };

  return (
    <>
      <Navbar subtitle="Admin • Results" />
      <main className="container results-layout">
        <section className="card full-width">
          <div className="section-header centered">
            <div>
              <h2>Completed Interviews</h2>
              <p className="muted">Use filters to quickly find the runs you need.</p>
            </div>
            <div className="filter-row">
              <input
                name="candidateId"
                value={filters.candidateId}
                onChange={handleChange}
                placeholder="Candidate ID"
              />
              <input
                name="interviewId"
                value={filters.interviewId}
                onChange={handleChange}
                placeholder="Interview ID"
              />
              <button onClick={loadResults}>Apply</button>
            </div>
          </div>
          {loading && <p>Loading results...</p>}
          {error && <div className="error-banner">{error}</div>}
          <div className="results-stack">
            {results.map((result) => (
              <article className="result-card" key={result.session_id}>
                <header className="result-card__header">
                  <div>
                    <h3>{result.interview_title || result.interview_id}</h3>
                    <p className="muted">
                      {result.candidate_username || result.candidate_id} ·{' '}
                      {new Date(result.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="result-card__actions">
                    <div className="status-toggle">
                      {STATUS_OPTIONS.map((label) => (
                        <button
                          key={label}
                          type="button"
                        className={`pill-button ${result.status === label ? 'pill-active' : ''}`}
                          onClick={() => updateStatus(result.session_id, label, result.id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="status active score-pill">{result.scores?.average ?? '—'}</span>
                  </div>
                </header>
                <div className="responses">
                  {result.feedback?.map((item) => (
                    <article key={item.question_index} className="response-card">
                      <h4>
                        Q{item.question_index + 1}:{' '}
                        {result.answers?.[item.question_index]?.question || 'Question'}
                      </h4>
                      <p className="muted">
                        Candidate answer: {result.answers?.[item.question_index]?.transcript || 'N/A'}
                      </p>
                      <p>
                        <strong>Feedback:</strong> {item.feedback}
                      </p>
                      <p className="strengths">Strengths: {item.strengths}</p>
                      <p className="areas">Areas: {item.areas_for_improvement}</p>
                      <p className="score">Score: {item.score}</p>
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
};

export default AdminResultsPage;
