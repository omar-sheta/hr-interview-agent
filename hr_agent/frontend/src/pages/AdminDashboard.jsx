import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AdminInterviewForm from './AdminInterviewForm.jsx';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [editingInterview, setEditingInterview] = useState(null);
  const [candidateInputs, setCandidateInputs] = useState({});

  const loadInterviews = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data } = await api.get('/api/admin/interviews', {
        params: { admin_id: user.user_id },
      });
      setInterviews(data.interviews || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load interviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterviews();
  }, [user]);

  const handleSaveInterview = async (payload, isUpdate) => {
    const { id, ...body } = payload;
    if (isUpdate && id) {
      await api.put(`/api/admin/interviews/${id}`, {
        admin_id: user.user_id,
        ...body,
      });
    } else {
      await api.post('/api/admin/interviews', {
        admin_id: user.user_id,
        ...body,
      });
    }
    await loadInterviews();
    setEditingInterview(null);
  };

  const handleToggleActive = async (interview) => {
    await api.put(`/api/admin/interviews/${interview.id}`, {
      admin_id: user.user_id,
      active: !interview.active,
    });
    await loadInterviews();
  };

  const updateAllowedCandidates = async (interviewId, allowedIds) => {
    await api.put(`/api/admin/interviews/${interviewId}`, {
      admin_id: user.user_id,
      allowed_candidate_ids: allowedIds,
    });
    await loadInterviews();
  };

  const handleCandidateAdd = async (interview) => {
    const value = candidateInputs[interview.id]?.trim();
    if (!value) return;
    const updated = Array.from(new Set([...(interview.allowed_candidate_ids || []), value]));
    await updateAllowedCandidates(interview.id, updated);
    setCandidateInputs((prev) => ({ ...prev, [interview.id]: '' }));
  };

  const handleCandidateRemove = async (interview, candidateId) => {
    const updated = (interview.allowed_candidate_ids || []).filter((id) => id !== candidateId);
    await updateAllowedCandidates(interview.id, updated);
  };

  return (
    <>
      <Navbar subtitle="Admin Control Center" />
      <main className="container admin-grid">
        <section className="card">
          <div className="section-header">
            <div>
              <h2>Interviews</h2>
              <p className="muted">Manage interview templates and candidate access.</p>
            </div>
            <button className="ghost" onClick={() => navigate('/admin/results')}>
              View Results
            </button>
          </div>
          {loading && <p>Loading interviews...</p>}
          {error && <div className="error-banner">{error}</div>}
          <div className="list">
            {interviews.map((interview) => (
              <article className="list-item" key={interview.id}>
                <div>
                  <h3>{interview.title}</h3>
                  <p className="muted">{interview.description}</p>
                  <p className="meta">
                    Allowed candidates: {interview.allowed_candidate_ids?.join(', ') || '—'}
                  </p>
                  <div className="candidate-chips">
                    {(interview.allowed_candidate_ids || []).map((candidateId) => (
                      <span key={candidateId} className="chip">
                        {candidateId}
                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => handleCandidateRemove(interview, candidateId)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="candidate-add">
                    <input
                      type="text"
                      placeholder="Add candidate ID"
                      value={candidateInputs[interview.id] || ''}
                      onChange={(event) =>
                        setCandidateInputs((prev) => ({ ...prev, [interview.id]: event.target.value }))
                      }
                    />
                    <button type="button" className="ghost" onClick={() => handleCandidateAdd(interview)}>
                      Add
                    </button>
                  </div>
                </div>
                <div className="list-item__actions">
                  <span className={interview.active ? 'status active' : 'status inactive'}>
                    {interview.active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="ghost" onClick={() => setEditingInterview(interview)}>
                    Edit
                  </button>
                  <button className="ghost" onClick={() => handleToggleActive(interview)}>
                    {interview.active ? 'Pause' : 'Activate'}
                  </button>
                </div>
              </article>
            ))}
            {!loading && !interviews.length && <p className="muted">No interviews yet.</p>}
          </div>
        </section>
        <section className="card">
          <h2>{editingInterview ? 'Edit Interview' : 'Create Interview'}</h2>
          <p className="muted">
            {editingInterview
              ? 'Update questions, ordering, and candidate access for this template.'
              : 'Define the questions, context, and candidates who can access it.'}
          </p>
          <AdminInterviewForm
            initialInterview={editingInterview}
            onSave={handleSaveInterview}
            onCancelEdit={() => setEditingInterview(null)}
          />
        </section>
      </main>
    </>
  );
};

export default AdminDashboard;
