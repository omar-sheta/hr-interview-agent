import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, Grid, Chip, Button,
    CircularProgress, Alert, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Avatar, IconButton,
    Card, CardContent, useTheme, alpha, Dialog, DialogTitle,
    DialogContent, DialogActions
} from '@mui/material';
import {
    ArrowBack, Visibility, CheckCircle, Pending,
    Group, AssignmentTurnedIn, Star, Psychology
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const InterviewDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const theme = useTheme();

    const [interview, setInterview] = useState(null);
    const [stats, setStats] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // AI Recommendation Dialog State
    const [recommendDialog, setRecommendDialog] = useState(false);
    const [recommendation, setRecommendation] = useState(null);
    const [loadingRecommendation, setLoadingRecommendation] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!user) return;
            try {
                setLoading(true);
                const { data } = await api.get(`/api/admin/interviews/${id}/stats`, {
                    params: { admin_id: user.user_id }
                });
                setInterview(data.interview);
                setStats(data.stats);
                setCandidates(data.candidates || []);
            } catch (err) {
                setError(err.response?.data?.detail || 'Failed to load interview details');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id, user]);

    const getScoreColor = (score) => {
        if (!score) return 'default';
        if (score >= 8) return 'success.main';
        if (score >= 5) return 'warning.main';
        return 'error.main';
    };

    const handleGetRecommendation = async (sessionId) => {
        if (!user || !sessionId) return;
        try {
            setLoadingRecommendation(true);
            const { data } = await api.post(
                `/api/admin/results/${sessionId}/recommend`,
                null,
                { params: { admin_id: user.user_id } }
            );
            setRecommendation(data);
            setRecommendDialog(true);
        } catch (err) {
            console.error('Failed to get recommendation:', err);
            alert(err.response?.data?.detail || 'Failed to get AI recommendation');
        } finally {
            setLoadingRecommendation(false);
        }
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
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/interviews')} sx={{ mt: 2 }}>
                    Back to Interviews
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
                onClick={() => navigate('/admin/interviews')}
                sx={{ mb: 3, color: 'text.secondary' }}
            >
                Back to Interviews
            </Button>

            {/* Header & Stats */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="800" gutterBottom>
                    {interview?.title}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {interview?.description}
                </Typography>

                <Grid container spacing={3}>
                    <Grid item xs={12} sm={4}>
                        <Card sx={{ borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: 'primary.main' }}><Group /></Avatar>
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">{stats?.total_assigned}</Typography>
                                    <Typography variant="body2" color="text.secondary">Assigned Candidates</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card sx={{ borderRadius: 3, bgcolor: alpha(theme.palette.success.main, 0.05) }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: 'success.main' }}><AssignmentTurnedIn /></Avatar>
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">{stats?.completed}</Typography>
                                    <Typography variant="body2" color="text.secondary">Completed Sessions</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card sx={{ borderRadius: 3, bgcolor: alpha(theme.palette.warning.main, 0.05) }}>
                            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Avatar sx={{ bgcolor: 'warning.main' }}><Star /></Avatar>
                                <Box>
                                    <Typography variant="h4" fontWeight="bold">{stats?.avg_score}</Typography>
                                    <Typography variant="body2" color="text.secondary">Average Score</Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>

            {/* Candidates List */}
            <Paper sx={{ borderRadius: 4, overflow: 'hidden' }}>
                <Box sx={{ p: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="h6" fontWeight="bold">Candidate Performance</Typography>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Candidate</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Score</TableCell>
                                <TableCell>Completed At</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {candidates.map((candidate) => (
                                <TableRow key={candidate.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar src={candidate.avatar_url}>{candidate.username?.[0]}</Avatar>
                                            <Box>
                                                <Typography variant="subtitle2" fontWeight="600">{candidate.username}</Typography>
                                                <Typography variant="caption" color="text.secondary">{candidate.email}</Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={candidate.status}
                                            size="small"
                                            color={candidate.status === 'Completed' ? 'success' : candidate.status === 'Pending' ? 'warning' : 'default'}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {candidate.score ? (
                                            <Typography fontWeight="bold" color={getScoreColor(candidate.score)}>
                                                {candidate.score.toFixed(1)}
                                            </Typography>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {candidate.completed_at ? new Date(candidate.completed_at).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                        {candidate.session_id && (
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="secondary"
                                                    startIcon={<Psychology />}
                                                    onClick={() => handleGetRecommendation(candidate.session_id)}
                                                    disabled={loadingRecommendation}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    AI Recommend
                                                </Button>
                                                <Button
                                                    size="small"
                                                    endIcon={<Visibility />}
                                                    onClick={() => navigate(`/admin/results/${candidate.session_id}`)}
                                                    sx={{ textTransform: 'none' }}
                                                >
                                                    View Report
                                                </Button>
                                            </Box>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {candidates.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        No candidates assigned yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* AI Recommendation Dialog */}
            <Dialog
                open={recommendDialog}
                onClose={() => setRecommendDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Psychology color="secondary" />
                        <Typography variant="h6" fontWeight="bold">AI Hiring Recommendation</Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {recommendation && (
                        <Box sx={{ mt: 2 }}>
                            <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: recommendation.decision === 'ACCEPT' ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1), border: 1, borderColor: recommendation.decision === 'ACCEPT' ? 'success.main' : 'error.main' }}>
                                <Typography variant="overline" color="text.secondary">Decision</Typography>
                                <Typography variant="h5" fontWeight="bold" color={recommendation.decision === 'ACCEPT' ? 'success.main' : 'error.main'}>
                                    {recommendation.decision}
                                </Typography>
                            </Box>

                            <Box sx={{ mb: 2 }}>
                                <Typography variant="overline" color="text.secondary">AI Reasoning</Typography>
                                <Typography variant="body1" sx={{ mt: 1 }}>
                                    {recommendation.reasoning}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                                    <Typography variant="caption" color="text.secondary">Candidate Score</Typography>
                                    <Typography variant="h6" fontWeight="bold" color={getScoreColor(recommendation.score)}>
                                        {recommendation.score.toFixed(1)}/10
                                    </Typography>
                                </Box>
                                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
                                    <Typography variant="caption" color="text.secondary">AI Confidence</Typography>
                                    <Typography variant="h6" fontWeight="bold">
                                        {recommendation.confidence.charAt(0).toUpperCase() + recommendation.confidence.slice(1)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRecommendDialog(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </motion.div>
    );
};

export default InterviewDetail;
