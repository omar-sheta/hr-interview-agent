import { useEffect, useState } from 'react';
import api from '../api/client.js';
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Checkbox,
  FormControlLabel,
  IconButton,
  Alert,
  CircularProgress,
  Backdrop,
  Autocomplete,
  Chip,
} from '@mui/material';
import {
  ArrowUpward,
  ArrowDownward,
  Delete,
  Add,
  AutoFixHigh,
  Edit,
} from '@mui/icons-material';

const defaultForm = {
  title: '',
  description: '',
  jobRole: '',
  jobDescription: '',
  numQuestions: 5,
  allowedCandidateIds: [],
  active: true,
};

const AdminInterviewForm = ({ onSave, initialInterview = null, onCancelEdit }) => {
  const [form, setForm] = useState(defaultForm);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [busyMessage, setBusyMessage] = useState('');
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    // Load all candidates
    const loadCandidates = async () => {
      try {
        const { data } = await api.get('/api/candidates');
        setCandidates(data.candidates || []);
      } catch (err) {
        console.error('Failed to load candidates:', err);
      }
    };
    loadCandidates();
  }, []);

  useEffect(() => {
    if (initialInterview) {
      const allowedCandidates = initialInterview.allowed_candidate_ids || [];
      setForm({
        title: initialInterview.title || '',
        description: initialInterview.description || '',
        jobRole: initialInterview.config?.job_role || '',
        jobDescription: initialInterview.config?.job_description || '',
        numQuestions: initialInterview.config?.num_questions || 5,
        allowedCandidateIds: allowedCandidates,
        active: initialInterview.active !== undefined ? initialInterview.active : true,
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

  const handleAddQuestion = () => setQuestions((prev) => [...prev, '']);
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
  const removeQuestion = (index) => setQuestions((prev) => prev.filter((_, i) => i !== index));

  const generateQuestionsWithAI = async () => {
    if (!form.jobRole && !form.jobDescription) {
      setError('Provide a job role or description before generating questions.');
      return;
    }
    setBusyMessage('Generating questions with AI…');
    setError('');
    try {
      const { data } = await api.post('/generate', {
        job_role: form.jobRole,
        job_description: form.jobDescription,
        num_questions: Number(form.numQuestions) || 5,
      });
      if (data?.questions?.length) setQuestions(data.questions);
      else throw new Error('No questions returned from AI.');
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
      if (data?.edited_question) handleQuestionTextChange(index, data.edited_question);
      else throw new Error('AI edit response was empty.');
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
        allowed_candidate_ids: form.allowedCandidateIds,
        active: form.active,
      };
      if (initialInterview?.id) payload.id = initialInterview.id;
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
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Backdrop open={Boolean(busyMessage)} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, color: '#fff' }}>
        <CircularProgress color="inherit" />
        <Typography sx={{ ml: 2 }}>{busyMessage}</Typography>
      </Backdrop>
      <Stack spacing={3}>
        <TextField name="title" label="Title" value={form.title} onChange={handleChange} required fullWidth />
        <TextField name="description" label="Description" value={form.description} onChange={handleChange} multiline rows={2} fullWidth />
        <TextField name="jobRole" label="Job Role" value={form.jobRole} onChange={handleChange} placeholder="e.g., Backend Engineer" fullWidth />
        <TextField name="jobDescription" label="Job Description / Context" value={form.jobDescription} onChange={handleChange} multiline rows={3} fullWidth placeholder="Paste job description for better AI generation" />
        <TextField type="number" name="numQuestions" label="Number of Questions to Generate" value={form.numQuestions} onChange={handleChange} inputProps={{ min: 1, max: 20 }} fullWidth />

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Interview Questions</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<AutoFixHigh />} onClick={generateQuestionsWithAI} disabled={Boolean(busyMessage)}>
                Generate
              </Button>
              <Button variant="outlined" startIcon={<Add />} onClick={handleAddQuestion}>
                Add
              </Button>
            </Stack>
          </Stack>
          <Typography variant="body2" color="text.secondary">Generate with AI, then reorder or fine-tune.</Typography>
          
          <Stack spacing={2} sx={{ mt: 2 }}>
            {!questions.length && <Typography color="text.secondary">No questions yet.</Typography>}
            {questions.map((question, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="center">
                <TextField
                  label={`Question ${index + 1}`}
                  value={question}
                  onChange={(e) => handleQuestionTextChange(index, e.target.value)}
                  multiline
                  fullWidth
                  variant="filled"
                />
                <IconButton onClick={() => moveQuestion(index, -1)} disabled={index === 0}><ArrowUpward /></IconButton>
                <IconButton onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1}><ArrowDownward /></IconButton>
                <IconButton onClick={() => rewriteQuestionWithAI(index)}><Edit /></IconButton>
                <IconButton onClick={() => removeQuestion(index)} color="error"><Delete /></IconButton>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>Assign Candidates</Typography>
          <Autocomplete
            multiple
            options={candidates}
            getOptionLabel={(option) => `${option.username} (${option.id})`}
            value={candidates.filter(c => form.allowedCandidateIds.includes(c.id))}
            onChange={(event, newValue) => {
              setForm((prev) => ({
                ...prev,
                allowedCandidateIds: newValue.map(c => c.id),
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Select Candidates"
                placeholder="Search by username or ID..."
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option.username}
                  {...getTagProps({ index })}
                  key={option.id}
                />
              ))
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Select which candidates can access this interview template.
          </Typography>
        </Box>

        <FormControlLabel control={<Checkbox name="active" checked={form.active} onChange={handleChange} />} label="Interview is Active" />

        {error && <Alert severity="error">{error}</Alert>}
        
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {initialInterview && onCancelEdit && (
            <Button variant="text" onClick={onCancelEdit}>
              Cancel Edit
            </Button>
          )}
          <Button type="submit" variant="contained">
            {initialInterview ? 'Update Interview' : 'Save Interview'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default AdminInterviewForm;
