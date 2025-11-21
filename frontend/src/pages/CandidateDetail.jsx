import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, Avatar, Chip, Button,
    CircularProgress, Alert, Divider, List, ListItem,
    ListItemText, ListItemAvatar, ListItemSecondaryAction,
    IconButton, Card, CardContent, useTheme, alpha
} from '@mui/material';
import {
    ArrowBack, Email, Assignment, History,
    CheckCircle, Pending, Visibility, PlayArrow
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const CandidateDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const theme = useTheme();

    const [candidate, setCandidate] = useState(null);
    const [assignedInterviews, setAssignedInterviews] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDetails = async () => {
            if (!user) return;
            try {
                setLoading(true);
                const { data } = await api.get(`/api/admin/candidates/${id}`, {
                    params: { admin_id: user.user_id }
                });
                setCandidate(data.candidate);
                setAssignedInterviews(data.assigned_interviews || []);
                setHistory(data.history || []);
            } catch (err) {
                setError(err.response?.data?.detail || 'Failed to load candidate details');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id, user]);

    const getScoreColor = (score) => {
        if (score >= 8) return 'success.main';
        if (score >= 5) return 'warning.main';
        return 'error.main';
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/candidates')} sx={{ mt: 2 }}>
                    Back to Candidates
                </Button>
            </Box>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Button
                startIcon={<ArrowBack />}
                onClick={() => navigate('/admin/candidates')}
                sx={{ mb: 3, color: 'text.secondary' }}
            >
                Back to Candidates
            </Button>

            {/* Profile Header */}
            <Paper
                sx={{
                    p: 4,
                    mb: 4,
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.8)} 100%)`,
                    backdropFilter: 'blur(10px)',
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Avatar
                        src={candidate?.avatar_url}
                        sx={{ width: 80, height: 80, fontSize: 32, bgcolor: 'primary.main' }}
                    >
                        {candidate?.username?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="h4" fontWeight="800" gutterBottom>
                            {candidate?.username}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Email fontSize="small" />
                                <Typography variant="body2">{candidate?.email}</Typography>
                            </Box>
                            <Chip label={candidate?.role || 'Candidate'} size="small" color="primary" variant="outlined" />
                        </Box>
                    </Box>
                </Box>
            </Paper>

            <Grid container spacing={4}>
                {/* Assigned Interviews */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Assignment color="primary" /> Assigned Interviews
                    </Typography>

                    {assignedInterviews.length === 0 ? (
                        <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center', color: 'text.secondary' }}>
                            No active assignments
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {assignedInterviews.map((interview) => (
                                <Card key={interview.id} sx={{ borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)' }}>
                                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                                        <Box>
                                            <Typography variant="subtitle1" fontWeight="bold">{interview.title}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Deadline: {interview.deadline || 'None'}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={interview.status}
                                            color={interview.status === 'Completed' ? 'success' : 'warning'}
                                            size="small"
                                            icon={interview.status === 'Completed' ? <CheckCircle /> : <Pending />}
                                        />
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    )}
                </Grid>

                {/* History */}
                <Grid item xs={12} md={6}>
                    <Typography variant="h6" fontWeight="bold" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <History color="secondary" /> Interview History
                    </Typography>

                    {history.length === 0 ? (
                        <Paper sx={{ p: 3, borderRadius: 3, textAlign: 'center', color: 'text.secondary' }}>
                            No completed interviews yet
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {history.map((result) => (
                                <Card
                                    key={result.session_id}
                                    sx={{
                                        borderRadius: 3,
                                        border: '1px solid rgba(0,0,0,0.08)',
                                        transition: 'transform 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 }
                                    }}
                                >
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                            <Box>
                                                <Typography variant="subtitle1" fontWeight="bold">
                                                    {result.interview_title || 'Interview Session'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(result.created_at).toLocaleDateString()} • {new Date(result.created_at).toLocaleTimeString()}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="h6" fontWeight="800" color={getScoreColor(result.overall_score)}>
                                                    {result.overall_score ? result.overall_score.toFixed(1) : 'N/A'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">Score</Typography>
                                            </Box>
                                        </Box>

                                        <Divider sx={{ my: 1.5 }} />

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Chip
                                                label={result.status || 'Completed'}
                                                size="small"
                                                variant="outlined"
                                                color={result.status === 'Accepted' ? 'success' : result.status === 'Rejected' ? 'error' : 'default'}
                                            />
                                            <Button
                                                size="small"
                                                endIcon={<Visibility />}
                                                onClick={() => navigate(`/admin/results/${result.session_id}`)}
                                            >
                                                View Report
                                            </Button>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    )}
                </Grid>
            </Grid>
        </motion.div>
    );
};

export default CandidateDetail;
