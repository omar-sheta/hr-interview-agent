import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardContent, useTheme, alpha, Button, CircularProgress, Alert } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { CalendarToday, Download } from '@mui/icons-material';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const AdminAnalytics = () => {
    const theme = useTheme();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState({
        metrics: [],
        funnel: [],
        completion_over_time: []
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            try {
                setLoading(true);
                const response = await api.get('/api/admin/analytics', {
                    params: { admin_id: user.user_id }
                });
                setData(response.data);
            } catch (err) {
                console.error("Failed to load analytics:", err);
                setError('Failed to load analytics data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [user]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="800" sx={{ letterSpacing: '-0.5px', mb: 1 }}>
                    Interview Analytics
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Visualize key metrics and performance of your interview process.
                </Typography>
            </Box>

            {/* Key Metrics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {data.metrics.map((metric, index) => (
                    <Grid item xs={12} sm={6} md={3} key={index}>
                        <Card sx={{ borderRadius: 3, height: '100%', boxShadow: 'none', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                            <CardContent>
                                <Typography variant="body2" color="text.secondary" gutterBottom>{metric.label}</Typography>
                                <Typography variant="h4" fontWeight="700" sx={{ mb: 1 }}>{metric.value}</Typography>
                                <Typography variant="caption" color={metric.trendUp ? 'success.main' : 'error.main'} fontWeight="600">
                                    {metric.trend} vs last month
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* Search placeholder */}
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" startIcon={<CalendarToday />} sx={{ borderRadius: 2, textTransform: 'none' }}>Last 30 Days</Button>
                    <Button variant="contained" startIcon={<Download />} sx={{ borderRadius: 2, textTransform: 'none' }}>Export Report</Button>
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Card sx={{ borderRadius: 4, p: 2 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="700" sx={{ mb: 3 }}>Candidate Funnel</Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                                {data.funnel.map((item, index) => (
                                    <Box key={index} sx={{ textAlign: 'center' }}>
                                        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
                                            <CircularProgress variant="determinate" value={100} size={80} sx={{ color: alpha(item.color, 0.1), position: 'absolute' }} />
                                            <CircularProgress variant="determinate" value={(item.value / (data.funnel[0].value || 1)) * 100} size={80} sx={{ color: item.color }} />
                                            <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Typography variant="caption" component="div" color="text.secondary" fontWeight="700">
                                                    {Math.round((item.value / (data.funnel[0].value || 1)) * 100)}%
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Typography variant="subtitle2" fontWeight="700">{item.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{item.value}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card sx={{ borderRadius: 4, p: 2, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight="700" sx={{ mb: 3 }}>Completion Rate Over Time</Typography>
                            <Box sx={{ height: 200 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.completion_over_time}>
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="value" fill="#2196F3" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </motion.div>
    );
};

export default AdminAnalytics;
