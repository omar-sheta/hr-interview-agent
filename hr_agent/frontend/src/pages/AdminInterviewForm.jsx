import { useEffect, useState } from 'react';
import api from '../api/client.js';

const defaultForm = {
  title: '',
  description: '',
  jobRole: '',
  jobDescription: '',
  numQuestions: 5,
  allowedCandidateIds: '',
  active: true,
};

const AdminInterviewForm = ({ onSave, initialInterview = null, onCancelEdit }) => {
  const [form, setForm] = useState(defaultForm);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [busyMessage, setBusyMessage] = useState('');

  useEffect(() => {
    if (initialInterview) {
      const allowedCandidates = (initialInterview.allowed_candidate_ids || []).join(', ');
      setForm({
        title: initialInterview.title || '',
        description: initialInterview.description || '',
        jobRole: initialInterview.config?.job_role || '',
        jobDescription: initialInterview.config?.job_description || '',
        numQuestions: initialInterview.config?.num_questions || 5,
        allowedCandidateIds: allowedCandidates,
        active: Boolean(initialInterview.active),
      });
      setQuestions(initialInterview.config?.questions || []);
    } else {
      setForm(defaultForm);
      setQuestions([]);
    }
    setError('');
  }, [initialInterview]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, 'New interview question?']);
  };

  const handleQuestionTextChange = (index, value) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const moveQuestion = (index, delta) => {
    setQuestions((prev) => {
      const next = [...prev];
      const targetIndex = index + delta;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const [removed] = next.splice(index, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  };

  const removeQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const generateQuestionsWithAI = async () => {
    if (!form.jobRole && !form.jobDescription) {
      setError('Provide a job role or description before generating questions.');
      return;
    }
    setBusyMessage('Generating questions with Gemma 3 27B…');
    setError('');
    try {
      const payload = {
        job_role: form.jobRole,
        job_description: form.jobDescription,
        num_questions: Number(form.numQuestions) || 5,
      };
      const { data } = await api.post('/generate', payload);
      if (data?.questions?.length) {
        setQuestions(data.questions);
      } else {
        throw new Error('No questions returned from AI.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to generate questions.');
    } finally {
      setBusyMessage('');
    }
  };

  const rewriteQuestionWithAI = async (index) => {
    const question = questions[index];
    const instruction = window.prompt('Describe how to refine this question with AI:', '');
    if (!instruction) return;
    setBusyMessage('Editing question with AI…');
    setError('');
    try {
      const { data } = await api.post('/questions/edit', {
        original_question: question,
        edit_instruction: instruction,
        job_role: form.jobRole,
        job_description: form.jobDescription,
      });
      if (data?.edited_question) {
        handleQuestionTextChange(index, data.edited_question);
      } else {
        throw new Error('AI edit response was empty.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to edit question.');
    } finally {
      setBusyMessage('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!questions.length) {
      setError('Please add at least one question.');
      return;
    }
    try {
      const payload = {
        title: form.title,
        description: form.description,
        config: {
          job_role: form.jobRole,
          job_description: form.jobDescription,
          num_questions: Number(form.numQuestions) || questions.length,
          questions,
        },
        allowed_candidate_ids: form.allowedCandidateIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
        active: form.active,
      };
      if (initialInterview?.id) {
        payload.id = initialInterview.id;
      }
      await onSave(payload, Boolean(initialInterview));
      if (!initialInterview) {
        setForm(defaultForm);
        setQuestions([]);
      }
    } catch (err) {
      setError(err.message || 'Unable to save interview.');
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        Title
        <input name="title" value={form.title} onChange={handleChange} required />
      </label>
      <label>
        Description
        <textarea name="description" rows={3} value={form.description} onChange={handleChange} />
      </label>
      <label>
        Job role
        <input name="jobRole" value={form.jobRole} onChange={handleChange} placeholder="e.g., Backend Engineer" />
      </label>
      <label>
        Job description / context
        <textarea
          name="jobDescription"
          rows={3}
          value={form.jobDescription}
          onChange={handleChange}
          placeholder="Paste the relevant job description for better AI generation."
        />
      </label>
      <label>
        Number of questions to generate
        <input
          type="number"
          name="numQuestions"
          value={form.numQuestions}
          onChange={handleChange}
          min={1}
          max={20}
        />
      </label>

      <div className="question-builder">
        <div className="section-header" style={{ alignItems: 'center' }}>
          <div>
            <h3>Interview Questions</h3>
            <p className="muted">Generate with AI, then reorder or fine-tune with contextual edits.</p>
          </div>
          <div className="button-cluster">
            <button type="button" className="primary" onClick={generateQuestionsWithAI} disabled={Boolean(busyMessage)}>
              Generate with AI
            </button>
            <button type="button" className="ghost" onClick={handleAddQuestion}>
              Add question
            </button>
          </div>
        </div>
        {busyMessage && <div className="status-banner info">{busyMessage}</div>}
        {!questions.length && <p className="muted">No questions yet. Generate them with AI or add manually.</p>}
        <div className="list">
          {questions.map((question, index) => (
            <article key={`${index}-${question.slice(0, 10)}`} className="list-item" style={{ flexDirection: 'column' }}>
              <label style={{ width: '100%' }}>
                Question {index + 1}
                <textarea
                  rows={2}
                  value={question}
                  onChange={(event) => handleQuestionTextChange(index, event.target.value)}
                  style={{ marginTop: '0.5rem' }}
                />
              </label>
              <div className="list-item__actions" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="ghost" onClick={() => moveQuestion(index, -1)} disabled={index === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => moveQuestion(index, 1)}
                  disabled={index === questions.length - 1}
                >
                  ↓
                </button>
                <button type="button" className="ghost" onClick={() => rewriteQuestionWithAI(index)}>
                  AI refine
                </button>
                <button type="button" className="danger" onClick={() => removeQuestion(index)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <label>
        Allowed candidate ids (comma separated)
        <input name="allowedCandidateIds" value={form.allowedCandidateIds} onChange={handleChange} />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="active" checked={form.active} onChange={handleChange} /> Active
      </label>
      {error && <div className="error-banner">{error}</div>}
      <div className="controls-grid">
        {initialInterview && onCancelEdit && (
          <button type="button" className="ghost" onClick={onCancelEdit}>
            Cancel edit
          </button>
        )}
        <button type="submit">{initialInterview ? 'Update interview' : 'Save interview'}</button>
      </div>
    </form>
  );
};

export default AdminInterviewForm;
