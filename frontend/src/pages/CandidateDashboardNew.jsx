import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Avatar,
  Container,
  Menu,
  MenuItem,
} from '@mui/material';
import { Person, Logout, Brightness4, Brightness7 } from '@mui/icons-material'; // Added Logout icon
import hiveLogo from '../assets/hive-logo.png';
import { useTheme } from '../context/ThemeContext.jsx';

const CandidateDashboard = () => {
  const { user, logout } = useAuth(); // Get logout from auth context
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [interviews, setInterviews] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingInterviewId, setStartingInterviewId] = useState(null);

  // Menu state
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
  };

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [interviewsRes, resultsRes] = await Promise.all([
          api.get('/api/candidate/interviews', { params: { candidate_id: user.user_id } }),
          api.get('/api/candidate/results', { params: { candidate_id: user.user_id } })
        ]);

        setInterviews(interviewsRes.data.interviews || []);
        setHistory(resultsRes.data.results || []);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Unable to fetch interviews');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleStart = async (interview) => {
    setStartingInterviewId(interview.id);
    setError('');
    try {
      const { data } = await api.post(
        `/api/candidate/interviews/${interview.id}/start`,
        { candidate_id: user.user_id }
      );
      navigate('/workspace', {
        state: { session: data.session, interview: data.interview }
      });
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not start interview');
      setStartingInterviewId(null);
    }
  };

  const getStatusInfo = (interview) => {
    // Check if interview has been completed
    if (interview.completed) {
      return {
        label: 'Completed',
        color: '#28A745',
        bgColor: 'rgba(40, 167, 69, 0.1)',
        borderColor: 'rgba(40, 167, 69, 0.2)',
        action: 'View Results',
        disabled: false,
      };
    }

    // Check deadline
    if (interview.deadline) {
      const now = new Date();
      const deadlineDate = new Date(interview.deadline);
      if (deadlineDate < now) {
        return {
          label: 'Expired',
          color: '#DC3545',
          bgColor: 'rgba(220, 53, 69, 0.1)',
          borderColor: 'rgba(220, 53, 69, 0.2)',
          action: 'View Details',
          disabled: true,
        };
      }
    }

    return {
      label: 'Pending',
      color: '#FFC107',
      bgColor: 'rgba(255, 193, 7, 0.1)',
      borderColor: 'rgba(255, 193, 7, 0.2)',
      action: 'Start Interview',
      disabled: false,
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <img src={hiveLogo} alt="Hive Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}
              >
                Hive
              </Typography>
            </Box>

            <Typography
              variant="body2"
              sx={{
                display: { xs: 'none', md: 'block' },
                fontWeight: 500,
                color: 'text.secondary',
              }}
            >
              Hive Internship Interview
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={toggleTheme} color="inherit">
                {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
              <IconButton
                onClick={handleMenuOpen}
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
              >
                <Person />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={openMenu}
                onClose={handleMenuClose}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                    mt: 1.5,
                    '& .MuiAvatar-root': {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                    '&:before': {
                      content: '""',
                      display: 'block',
                      position: 'absolute',
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: 'background.paper',
                      transform: 'translateY(-50%) rotate(45deg)',
                      zIndex: 0,
                    },
                  },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <MenuItem onClick={handleLogout}>
                  <Logout fontSize="small" sx={{ mr: 1.5 }} />
                  Logout
                </MenuItem>
              </Menu>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Box component="main" sx={{ flex: 1, py: { xs: 4, md: 8 } }}>
        <Container maxWidth="md">
          {/* Welcome Header */}
          <Box sx={{ mb: { xs: 4, md: 6 } }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                letterSpacing: '-1px',
                color: 'text.primary',
                mb: 1,
              }}
            >
              Welcome, {user?.username || 'Candidate'}!
            </Typography>
            <Typography variant="body1" sx={{ fontSize: '1.125rem', color: 'text.secondary' }}>
              Your assigned interviews are listed below. Good luck!
            </Typography>
          </Box>

          {/* Loading */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Interview Cards */}
          {!loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {interviews.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  No interviews assigned at this time.
                </Alert>
              ) : (
                interviews.map((interview) => {
                  const statusInfo = getStatusInfo(interview);
                  const isStarting = startingInterviewId === interview.id;

                  return (
                    <Box
                      key={interview.id}
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'stretch', md: 'center' },
                        justifyContent: 'space-between',
                        gap: { xs: 3, md: 4 },
                        p: 3,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        boxShadow: 1,
                        opacity: interview.expired ? 0.6 : 1,
                      }}
                    >
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              lineHeight: 1.4,
                              color: 'text.primary',
                            }}
                          >
                            {interview.title}
                          </Typography>
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 1.25,
                              py: 0.5,
                              borderRadius: '9999px',
                              bgcolor: statusInfo.bgColor,
                              border: `1px solid ${statusInfo.borderColor}`,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 500,
                                color: statusInfo.color,
                                fontSize: '0.75rem',
                              }}
                            >
                              {statusInfo.label}
                            </Typography>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: { xs: 0.5, md: 2 },
                            fontSize: '0.875rem',
                            color: 'text.secondary',
                          }}
                        >
                          <Typography variant="body2" color="inherit">
                            {interview.company || 'Hive Corporation'}
                          </Typography>
                          <Box
                            component="span"
                            sx={{ display: { xs: 'none', md: 'inline' } }}
                          >
                            •
                          </Box>
                          <Typography variant="body2" color="inherit">
                            {interview.deadline
                              ? `Due: ${formatDate(interview.deadline)}`
                              : interview.completed
                                ? `Completed: ${formatDate(interview.completed_at)}`
                                : 'No deadline'}
                          </Typography>
                          <Box
                            component="span"
                            sx={{ display: { xs: 'none', md: 'inline' } }}
                          >
                            •
                          </Box>
                          <Typography variant="body2" color="inherit">
                            Duration: {interview.duration || '90'} minutes
                          </Typography>
                        </Box>
                      </Box>

                      <Button
                        variant={statusInfo.label === 'Pending' ? 'contained' : 'outlined'}
                        disabled={statusInfo.disabled || isStarting}
                        onClick={() => handleStart(interview)}
                        sx={{
                          minWidth: { xs: '100%', md: 150 },
                          height: 48,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '1rem',
                          ...(statusInfo.label === 'Pending' && {
                            bgcolor: 'primary.main',
                            boxShadow: 3,
                            '&:hover': {
                              bgcolor: 'primary.dark',
                              transform: 'scale(1.02)',
                            },
                            transition: 'all 0.2s',
                          }),
                          ...(statusInfo.label === 'Completed' && {
                            bgcolor: 'transparent',
                            color: 'text.secondary',
                            borderColor: 'divider',
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }),
                          ...(statusInfo.label === 'Expired' && {
                            bgcolor: 'transparent',
                            color: 'text.disabled',
                            borderColor: 'divider',
                            cursor: 'not-allowed',
                          }),
                        }}
                      >
                        {isStarting ? (
                          <CircularProgress size={24} color="inherit" />
                        ) : (
                          statusInfo.action
                        )}
                      </Button>
                    </Box>
                  );
                })
              )}
            </Box>
          )}

          {/* Interview History */}
          {!loading && history.length > 0 && (
            <Box sx={{ mt: 8 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.5px',
                  color: 'text.primary',
                  mb: 4,
                }}
              >
                Interview History
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {history.map((result) => {
                  const statusColor =
                    result.status === 'accepted' ? '#28A745' :
                      result.status === 'rejected' ? '#DC3545' :
                        '#FFC107'; // pending/review

                  const statusLabel =
                    result.status === 'accepted' ? 'Accepted' :
                      result.status === 'rejected' ? 'Rejected' :
                        'In Review';

                  return (
                    <Box
                      key={result.id}
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'stretch', md: 'center' },
                        justifyContent: 'space-between',
                        gap: { xs: 3, md: 4 },
                        p: 3,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        boxShadow: 1,
                      }}
                    >
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography
                            variant="h6"
                            sx={{
                              fontWeight: 700,
                              lineHeight: 1.4,
                              color: 'text.primary',
                            }}
                          >
                            {result.interview_title}
                          </Typography>
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              px: 1.25,
                              py: 0.5,
                              borderRadius: '9999px',
                              bgcolor: `${statusColor}1A`, // 10% opacity
                              border: `1px solid ${statusColor}33`, // 20% opacity
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 500,
                                color: statusColor,
                                fontSize: '0.75rem',
                              }}
                            >
                              {statusLabel}
                            </Typography>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            gap: { xs: 0.5, md: 2 },
                            fontSize: '0.875rem',
                            color: 'text.secondary',
                          }}
                        >
                          <Typography variant="body2" color="inherit">
                            Completed: {formatDate(result.timestamp)}
                          </Typography>
                          <Box
                            component="span"
                            sx={{ display: { xs: 'none', md: 'inline' } }}
                          >
                            •
                          </Box>
                          <Typography variant="body2" color="inherit">
                            Score: {result.scores?.average || 'N/A'}/10
                          </Typography>
                        </Box>
                      </Box>

                      <Button
                        variant="outlined"
                        onClick={() => navigate(`/candidate/results/${result.session_id}`)}
                        sx={{
                          minWidth: { xs: '100%', md: 150 },
                          height: 48,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '1rem',
                        }}
                      >
                        View Details
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}


        </Container>
      </Box >

      {/* Footer */}
      < Box
        component="footer"
        sx={{
          mt: 'auto',
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
            }}
          >
            <Typography
              component="a"
              href="#"
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Help Center
            </Typography>
            <Typography
              component="a"
              href="#"
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { color: 'primary.main' },
              }}
            >
              Privacy Policy
            </Typography>
          </Box>
        </Container>
      </Box >
    </Box >
  );
};

export default CandidateDashboard;
