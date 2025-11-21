import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Container,
  Typography,
  Button,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Snackbar,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircleOutline,
  HighlightOff,
  StarBorder,
  ThumbUpOutlined,
  ThumbDownOutlined,
  Search,
  Delete,
} from '@mui/icons-material';

const AdminResultsPage = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState('interview'); // 'interview' | 'user'
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resultToDelete, setResultToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const loadResults = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const params = { admin_id: user.user_id };
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
  }, [user]);

  const filteredResults = results.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (r.interview_title || '').toLowerCase().includes(query) ||
      (r.candidate_username || '').toLowerCase().includes(query) ||
      (r.candidate_id || '').toLowerCase().includes(query)
    );
  });

  const groupedResults = (filteredResults || []).reduce((acc, r) => {
    const key = groupBy === 'interview' ? (r.interview_title || 'Unknown Interview') : (r.candidate_username || r.candidate_id || 'Unknown Candidate');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groups = Object.keys(groupedResults).sort().map((title) => ({ title, results: groupedResults[title] }));

  const handleAccept = async (sessionId) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/api/admin/results/${sessionId}/accept`, null, {
        params: { admin_id: user.user_id },
      });
      setResults((prevResults) =>
        prevResults.map((r) => (r.session_id === sessionId ? { ...r, status: 'accepted' } : r))
      );
      setSnackbar({
        open: true,
        message: data.email_sent
          ? '✅ Candidate accepted and email sent!'
          : '✅ Candidate accepted (email not sent)',
        severity: data.email_sent ? 'success' : 'warning',
      });
    } catch (err) {
      console.error('Failed to accept:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to accept candidate',
        severity: 'error',
      });
    }
  };

  const handleReject = async (sessionId) => {
    if (!user) return;
    try {
      const { data } = await api.post(`/api/admin/results/${sessionId}/reject`, null, {
        params: { admin_id: user.user_id },
      });
      setResults((prevResults) =>
        prevResults.map((r) => (r.session_id === sessionId ? { ...r, status: 'rejected' } : r))
      );
      setSnackbar({
        open: true,
        message: data.email_sent
          ? '✅ Candidate rejected and email sent!'
          : '✅ Candidate rejected (email not sent)',
        severity: data.email_sent ? 'success' : 'warning',
      });
    } catch (err) {
      console.error('Failed to reject:', err);
      setSnackbar({
        open: true,
        message: err.response?.data?.detail || 'Failed to reject candidate',
        severity: 'error',
      });
    }
  };

  const handleDeleteClick = (result) => {
    setResultToDelete(result);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!resultToDelete) return;
    try {
      await api.delete(`/api/admin/results/${resultToDelete.session_id}`, {
        params: { admin_id: user.user_id },
      });
      await loadResults();
      setDeleteConfirmOpen(false);
      setResultToDelete(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete result');
      setDeleteConfirmOpen(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setResultToDelete(null);
  };

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'warning';
    }
  };

  return (
    <>
      <Navbar />
      <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1">
            Interview Results
          </Typography>
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel id="group-by-label">Group By</InputLabel>
            <Select
              labelId="group-by-label"
              value={groupBy}
              label="Group By"
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <MenuItem value="interview">Interview</MenuItem>
              <MenuItem value="user">User</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Search results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <Button component={Link} to="/admin" variant="outlined">
            Back to Dashboard
          </Button>
        </Box>

        {loading && <CircularProgress />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>
          {!loading && results.length === 0 && <Alert severity="info">No interview results found.</Alert>}
          {groups.map((group) => (
            <Accordion key={group.title} defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <Typography sx={{ fontWeight: 'bold' }}>{group.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{group.results.length} result(s)</Typography>
                  </Grid>
                </Grid>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Stack spacing={1} sx={{ p: 2 }}>
                  {group.results.map((result) => (
                    <Accordion key={result.session_id} defaultExpanded={false}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Grid container spacing={2} alignItems="center">
                          <Grid item xs={12} md={4}>
                            <Typography sx={{ fontWeight: 'bold' }}>{result.candidate_username || result.candidate_id}</Typography>
                            <Typography variant="body2" color="text.secondary">{result.interview_title}</Typography>
                          </Grid>
                          <Grid item xs={4} md={2}>
                            <Chip label={result.status || 'pending'} color={getStatusChipColor(result.status)} size="small" />
                          </Grid>
                          <Grid item xs={8} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Chip icon={<StarBorder />} label={`Avg. ${result.scores?.average || 'N/A'}`} variant="outlined" />
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              startIcon={<CheckCircleOutline />}
                              onClick={(e) => { e.stopPropagation(); handleAccept(result.session_id); }}
                              disabled={result.status === 'accepted'}
                            >
                              Accept
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<HighlightOff />}
                              onClick={(e) => { e.stopPropagation(); handleReject(result.session_id); }}
                              disabled={result.status === 'rejected'}
                            >
                              Reject
                            </Button>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => { e.stopPropagation(); handleDeleteClick(result); }}
                              title="Delete result"
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Grid>
                        </Grid>
                      </AccordionSummary>
                      <AccordionDetails sx={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
                        <Grid container spacing={3} sx={{ p: 2 }}>
                          <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom>Question-by-Question Evaluation</Typography>
                            <Stack spacing={2}>
                              {result.answers?.map((answer, index) => {
                                const feedback = result.feedback?.[index] || {};
                                return (
                                  <Paper variant="outlined" key={answer.question_index} sx={{ p: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flex: 1 }}>
                                        Q{answer.question_index + 1}: {answer.question}
                                      </Typography>
                                      <Chip
                                        label={`Score: ${feedback.score || 'N/A'}`}
                                        size="small"
                                        color={feedback.score >= 7 ? 'success' : feedback.score >= 5 ? 'warning' : 'error'}
                                      />
                                    </Box>

                                    <Typography variant="body2" color="text.secondary" sx={{ my: 1.5, fontStyle: 'italic', pl: 2, borderLeft: '3px solid #e0e0e0' }}>
                                      "{answer.transcript}"
                                    </Typography>

                                    <Divider sx={{ my: 2 }} />

                                    <Stack spacing={1.5}>
                                      {feedback.feedback && (
                                        <Box>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            Feedback
                                          </Typography>
                                          <Typography variant="body2">{feedback.feedback}</Typography>
                                        </Box>
                                      )}

                                      {feedback.strengths && (
                                        <Box>
                                          <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            ✓ Strengths
                                          </Typography>
                                          <Typography variant="body2">{feedback.strengths}</Typography>
                                        </Box>
                                      )}

                                      {feedback.areas_for_improvement && (
                                        <Box>
                                          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                                            ⚠ Areas for Improvement
                                          </Typography>
                                          <Typography variant="body2">{feedback.areas_for_improvement}</Typography>
                                        </Box>
                                      )}
                                    </Stack>
                                  </Paper>
                                );
                              })}
                            </Stack>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </Container>

      <Dialog open={deleteConfirmOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the result for {resultToDelete?.candidate_username}? This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button onClick={handleCancelDelete}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AdminResultsPage;
