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
} from '@mui/material';
import {
  ExpandMore,
  CheckCircleOutline,
  HighlightOff,
  StarBorder,
  ThumbUpOutlined,
  ThumbDownOutlined,
} from '@mui/icons-material';

const AdminResultsPage = () => {
  const { user } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupBy, setGroupBy] = useState('interview'); // 'interview' | 'user'

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

  const groupedResults = (results || []).reduce((acc, r) => {
    const key = groupBy === 'interview' ? (r.interview_title || 'Unknown Interview') : (r.candidate_username || r.candidate_id || 'Unknown Candidate');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groups = Object.keys(groupedResults).sort().map((title) => ({ title, results: groupedResults[title] }));

  const handleUpdateStatus = async (sessionId, newStatus) => {
    if (!user) return;
    try {
      await api.put(`/api/admin/results/${sessionId}`, null, {
        params: { admin_id: user.user_id, status: newStatus },
      });
      setResults((prevResults) =>
        prevResults.map((r) => (r.session_id === sessionId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
      setError(err.response?.data?.detail || 'Could not update status.');
    }
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
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(result.session_id, 'accepted'); }}
                              disabled={result.status === 'accepted'}
                            >
                              Accept
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<HighlightOff />}
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(result.session_id, 'rejected'); }}
                              disabled={result.status === 'rejected'}
                            >
                              Reject
                            </Button>
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
    </>
  );
};

export default AdminResultsPage;
