import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';

const CandidateDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [interviews, setInterviews] = useState([]);
  const [history, setHistory] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [startingInterviewId, setStartingInterviewId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setAssignmentsLoading(true);
      setHistoryLoading(true);
      setError('');
      try {
        const assignmentsPromise = api.get('/api/candidate/interviews', { params: { candidate_id: user.user_id } });
        const historyPromise = api.get('/api/candidate/results', { params: { candidate_id: user.user_id, candidate_username: user.username } });
        const [assignmentsResponse, historyResponse] = await Promise.all([assignmentsPromise, historyPromise]);
        setInterviews(assignmentsResponse.data.interviews || []);
        setHistory(historyResponse.data.results || []);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Unable to fetch candidate data');
      } finally {
        setAssignmentsLoading(false);
        setHistoryLoading(false);
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    // Accept optimistic pending result when navigating back from workspace
    if (!location?.state) return;
    const pending = location.state.pendingResult;
    if (pending) setHistory((prev) => [pending, ...(prev || [])]);
  }, [location]);

  const handleStart = async (interview) => {
    setStartingInterviewId(interview.id);
    setError('');
    try {
      const { data } = await api.post(`/api/candidate/interviews/${interview.id}/start`, { candidate_id: user.user_id });
      navigate('/workspace', { state: { session: data.session, interview: data.interview } });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not start the interview session.');
      setStartingInterviewId(null);
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
        <Box sx={{ mb: 5 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome, {user?.username || 'Candidate'}!
          </Typography>
          <Typography variant="body1" color="text.secondary">Here are your assigned and completed interviews.</Typography>
        </Box>

        {initialLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', m: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!initialLoading && (
          <Grid container spacing={4}>
            <Grid item xs={12} md={7}>
              <Typography variant="h5" component="h2" gutterBottom>Assigned Interviews</Typography>
              {assignmentsLoading && <CircularProgress size={20} sx={{ mb: 2 }} />}
              {!interviews.length ? (
                <Alert severity="info">You have no pending interviews at this time.</Alert>
              ) : (
                <Grid container spacing={3}>
                  {interviews.map((interview) => (
                    <Grid item xs={12} sm={6} key={interview.id}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" component="h3">{interview.title}</Typography>
                          <Typography variant="body2" color="text.secondary">{interview.description}</Typography>
                        </CardContent>
                        <CardActions>
                          <Button size="small" variant="contained" onClick={() => handleStart(interview)} disabled={startingInterviewId === interview.id}>
                            {startingInterviewId === interview.id ? <CircularProgress size={20} color="inherit" /> : 'Start Interview'}
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Grid>

            <Grid item xs={12} md={5}>
              <Typography variant="h5" component="h2" gutterBottom>Interview History</Typography>
              <Card>
                {historyLoading && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', m: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                )}
                {!history.length ? (
                  <CardContent>
                    <Typography color="text.secondary">No interviews completed yet.</Typography>
                  </CardContent>
                ) : (
                  <List disablePadding>
                    {history.map((result, index) => (
                      <React.Fragment key={result.session_id || index}>
                        <ListItem>
                          <ListItemText
                            primary={result.interview_title || result.interview_id}
                            secondary={result.timestamp ? `Completed: ${new Date(result.timestamp).toLocaleString()}` : 'Completed: N/A'}
                          />
                          <Chip label={result.status || 'pending'} color={getStatusChipColor(result.status)} size="small" />
                        </ListItem>
                        {index < history.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                )}
              </Card>
            </Grid>
          </Grid>
        )}
      </Container>
    </>
  );
};

export default CandidateDashboard;
