import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import AdminInterviewForm from './AdminInterviewForm.jsx';
import StatsCard from '../components/StatsCard.jsx';
import CandidatePipeline from '../components/CandidatePipeline.jsx';
import ActivityChart from '../components/ActivityChart.jsx';
import {
    Box,
    Grid,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    Card,
    CardContent,
    useTheme,
    alpha,
    CircularProgress,
} from '@mui/material';
import { motion } from 'framer-motion';

const AdminDashboard = () => {
    const { user } = useAuth();
    const [interviews, setInterviews] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [editingInterview, setEditingInterview] = useState(null);
    const [formDialogOpen, setFormDialogOpen] = useState(false);
    const theme = useTheme();

    const loadDashboardData = async () => {
        if (!user) return;
        try {
            setLoading(true);

            // Load all dashboard data in parallel
            const [interviewsRes, analyticsRes, candidatesRes] = await Promise.all([
                api.get('/api/admin/interviews', { params: { admin_id: user.user_id } }),
                api.get('/api/admin/analytics', { params: { admin_id: user.user_id } }),
                api.get('/api/admin/candidates', { params: { admin_id: user.user_id } })
            ]);

            setInterviews(interviewsRes.data.interviews || []);
            setAnalytics(analyticsRes.data || {});
            setCandidates(candidatesRes.data.candidates || []);
        } catch (err) {
            console.error('Dashboard load error:', err);
            setError(err.response?.data?.detail || 'Unable to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, [user]);

    const handleSaveInterview = async (payload, isUpdate) => {
        setFormSubmitting(true);
        try {
            const { id, ...body } = payload;
            const requestBody = { admin_id: user.user_id, ...body };
            if (isUpdate && id) {
                await api.put(`/api/admin/interviews/${id}`, requestBody);
            } else {
                await api.post('/api/admin/interviews', requestBody);
            }
            await loadDashboardData();
            setEditingInterview(null);
            setFormDialogOpen(false);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save interview');
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleCloseDialog = () => {
        setFormDialogOpen(false);
        setEditingInterview(null);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Extract metrics from analytics
    const metrics = analytics?.metrics || [];
    const getMetric = (label) => metrics.find(m => m.label === label) || { value: '0', trend: '+0', trendUp: true };

    const activeInterviewsMetric = getMetric('Total Interviews');
    const candidatesMetric = getMetric('Total Candidates');
    const completedMetric = getMetric('Completed Sessions');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Typography variant="h4" fontWeight="800" sx={{ mb: 4, letterSpacing: '-0.5px' }}>
                Administrator Dashboard
            </Typography>

            {/* Stats Row */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                    <StatsCard
                        title="Active Interviews"
                        value={activeInterviewsMetric.value}
                        trend={parseFloat(activeInterviewsMetric.trend) || 0}
                        trendLabel="this week"
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <StatsCard
                        title="Total Candidates"
                        value={candidatesMetric.value}
                        trend={parseFloat(candidatesMetric.trend) || 0}
                        trendLabel="this week"
                        color="success"
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <StatsCard
                        title="Completed Sessions"
                        value={completedMetric.value}
                        trend={parseFloat(completedMetric.trend) || 0}
                        trendLabel="this week"
                        color="info"
                    />
                </Grid>
            </Grid>

            {/* Main Content Grid */}
            <Grid container spacing={3}>
                {/* Left Column: Pipeline & Interviews */}
                <Grid item xs={12} lg={8}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <CandidatePipeline candidates={candidates} />
                        </Grid>
                        <Grid item xs={12}>
                            <ActivityChart data={analytics?.completion_over_time || []} />
                        </Grid>
                    </Grid>
                </Grid>

                {/* Right Column: Pending Reviews */}
                <Grid item xs={12} lg={4}>
                    <Card
                        sx={{
                            height: '100%',
                            borderRadius: 4,
                            backdropFilter: 'blur(10px)',
                            backgroundColor: alpha(theme.palette.background.paper, 0.6),
                            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        }}
                    >
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight="700" sx={{ mb: 3 }}>
                                Pending Reviews
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {analytics?.pending_reviews?.slice(0, 5).map((review, i) => (
                                    <Box
                                        key={i}
                                        sx={{
                                            p: 2,
                                            borderRadius: 2,
                                            bgcolor: alpha(theme.palette.background.paper, 0.4),
                                            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                            cursor: 'pointer',
                                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) }
                                        }}
                                        onClick={() => navigate(`/admin/results/${review.id}`)}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                            <Typography variant="subtitle2" fontWeight="600">{review.candidate}</Typography>
                                            <Typography variant="caption" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main, px: 1, py: 0.5, borderRadius: 1, fontWeight: 'bold' }}>
                                                {review.score}/10
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                            {review.interview}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Submitted: {new Date(review.submitted_at).toLocaleDateString()}
                                        </Typography>
                                    </Box>
                                ))}
                                {(!analytics?.pending_reviews || analytics.pending_reviews.length === 0) && (
                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                        No pending reviews
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Create Interview Dialog */}
            <Dialog
                open={formDialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3 }
                }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    {editingInterview ? 'Edit Interview' : 'Create New Interview'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <AdminInterviewForm
                            key={editingInterview?.id || 'new'}
                            initialInterview={editingInterview}
                            onSave={handleSaveInterview}
                            onCancelEdit={handleCloseDialog}
                            isSubmitting={formSubmitting}
                        />
                    </Box>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
};

export default AdminDashboard;
