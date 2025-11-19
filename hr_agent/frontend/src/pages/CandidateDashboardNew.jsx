import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';
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
  useTheme,
  alpha,
} from '@mui/material';

const CandidateDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

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

  const getDeadlineStatus = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diff = deadlineDate - now;

    if (diff < 0) {
      return { expired: true, text: 'Expired', color: 'error' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return { expired: false, text: `Expires in ${days}d ${hours}h`, color: 'info' };
    }
    return { expired: false, text: `Expires in ${hours}h`, color: 'warning' };
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };

  return (
    <>
      <Navbar />
      <Box
        sx={{
          minHeight: '100vh',
          background: theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #121212 0%, #1e1e1e 100%)'
            : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          pt: 4,
          pb: 8,
        }}
      >
        <Container component="main" maxWidth="lg">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ mb: 5 }}>
              <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800, letterSpacing: '-0.5px' }}>
                Welcome, {user?.username || 'Candidate'}!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Here are your assigned and completed interviews.
              </Typography>
            </Box>
          </motion.div>

          {initialLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', m: 3 }}>
              <CircularProgress />
            </Box>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
            </motion.div>
          )}

          {!initialLoading && (
            <Grid container spacing={4}>
              <Grid item xs={12} md={7}>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    Assigned Interviews
                  </Typography>
                  {assignmentsLoading && <CircularProgress size={20} sx={{ mb: 2 }} />}
                  {!interviews.length ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>You have no pending interviews at this time.</Alert>
                  ) : (
                    <Grid container spacing={3}>
                      {interviews.map((interview) => (
                        <Grid item xs={12} key={interview.id}>
                          <motion.div variants={itemVariants}>
                            <Card
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: 4,
                                backdropFilter: 'blur(10px)',
                                backgroundColor: alpha(theme.palette.background.paper, 0.6),
                                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                                '&:hover': {
                                  transform: 'translateY(-4px)',
                                  boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.15)',
                                },
                              }}
                            >
                              <CardContent sx={{ flexGrow: 1, p: 3 }}>
                                <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
                                  {interview.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                  {interview.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip label="AI-Powered" size="small" color="primary" variant="outlined" />
                                  <Chip label="~15 mins" size="small" variant="outlined" />
                                  {(() => {
                                    const status = getDeadlineStatus(interview.deadline);
                                    if (status) {
                                      return (
                                        <Chip
                                          label={status.text}
                                          size="small"
                                          color={status.color}
                                          variant={status.expired ? 'filled' : 'outlined'}
                                        />
                                      );
                                    }
                                    return null;
                                  })()}
                                </Box>
                              </CardContent>
                              <CardActions sx={{ p: 3, pt: 0 }}>
                                <Button
                                  size="large"
                                  variant="contained"
                                  fullWidth
                                  onClick={() => handleStart(interview)}
                                  disabled={startingInterviewId === interview.id || (getDeadlineStatus(interview.deadline)?.expired)}
                                  sx={{
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    boxShadow: '0 4px 14px 0 rgba(0,118,255,0.39)',
                                  }}
                                >
                                  {startingInterviewId === interview.id ? <CircularProgress size={24} color="inherit" /> : 'Start Interview'}
                                </Button>
                              </CardActions>
                            </Card>
                          </motion.div>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </motion.div>
              </Grid>

              <Grid item xs={12} md={5}>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
                    Interview History
                  </Typography>
                  <Card
                    sx={{
                      borderRadius: 4,
                      backdropFilter: 'blur(10px)',
                      backgroundColor: alpha(theme.palette.background.paper, 0.6),
                      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    }}
                  >
                    {historyLoading && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', m: 4 }}>
                        <CircularProgress size={20} />
                      </Box>
                    )}
                    {!history.length ? (
                      <CardContent sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No interviews completed yet.</Typography>
                      </CardContent>
                    ) : (
                      <List disablePadding>
                        {history.map((result, index) => (
                          <React.Fragment key={result.session_id || index}>
                            <ListItem sx={{ p: 2 }}>
                              <ListItemText
                                primary={
                                  <Typography variant="subtitle1" fontWeight="600">
                                    {result.interview_title || result.interview_id}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary">
                                    {result.timestamp ? new Date(result.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date: N/A'}
                                  </Typography>
                                }
                              />
                              <Chip
                                label={result.status || 'pending'}
                                color={getStatusChipColor(result.status)}
                                size="small"
                                sx={{ fontWeight: 600, borderRadius: 1 }}
                              />
                            </ListItem>
                            {index < history.length - 1 && <Divider variant="middle" />}
                          </React.Fragment>
                        ))}
                      </List>
                    )}
                  </Card>
                </motion.div>
              </Grid>
            </Grid>
          )}
        </Container>
      </Box>
    </>
  );
};

export default CandidateDashboard;
