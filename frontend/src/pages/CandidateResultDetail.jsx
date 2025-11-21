import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    Avatar,
    Chip,
    LinearProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Paper,
    IconButton,
    CircularProgress,
    Grid,
    useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    ExpandMore,
    CheckCircle,
    Warning,
    Cancel,
    ArrowBack,
    Logout,
    Brightness4,
    Brightness7,
} from '@mui/icons-material';
import { useTheme as useAppTheme } from '../context/ThemeContext';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const CandidateResultDetail = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const theme = useTheme();
    const { mode, toggleTheme } = useAppTheme();

    const handleLogout = async () => {
        await logout();
    };

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);
    const [interview, setInterview] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    useEffect(() => {
        fetchResultDetails();
    }, [sessionId]);

    const fetchResultDetails = async () => {
        try {
            setLoading(true);

            // Fetch results for this candidate
            const resultsRes = await api.get('/api/candidate/results', {
                params: { candidate_id: user.user_id },
            });

            const targetResult = resultsRes.data.results.find(
                (r) => r.session_id === sessionId
            );

            if (!targetResult) {
                throw new Error('Result not found');
            }

            setResult(targetResult);

            // Fetch interviews to get title/description
            const interviewsRes = await api.get('/api/candidate/interviews', {
                params: { candidate_id: user.user_id },
            });

            // Note: The interview might be filtered out if completed, so we might rely on result data
            // But let's try to find it. If not, we use data from result.
            const interviewData = interviewsRes.data.interviews.find(
                (i) => i.id === targetResult.interview_id
            );

            setInterview(interviewData || {
                title: targetResult.interview_title,
                description: 'Interview Completed'
            });

        } catch (error) {
            console.error('Error fetching result details:', error);
        } finally {
            setLoading(false);
        }
    };

    const getQuestionStatusIcon = (questionIndex) => {
        if (!result?.answers || !result.answers[questionIndex]) return <Warning sx={{ color: '#FF9800' }} />;

        const feedbackItem = result?.feedback?.find(f => f.question_index === questionIndex);
        const score = feedbackItem?.score || feedbackItem?.overall || 0;

        if (score >= 8) {
            return <CheckCircle sx={{ color: '#4CAF50' }} />;
        } else if (score >= 5) {
            return <Warning sx={{ color: '#FF9800' }} />;
        } else {
            return <Cancel sx={{ color: '#f44336' }} />;
        }
    };

    const getScoreColor = (score) => {
        if (score >= 8) return '#4CAF50';
        if (score >= 5) return '#FF9800';
        return '#f44336';
    };

    const currentAnswer = result?.answers?.[currentQuestionIndex];
    const currentQuestion = currentAnswer?.question || '';
    const currentQuestionFeedback = result?.feedback?.find(f => f.question_index === currentQuestionIndex);

    const scoreBreakdown = currentQuestionFeedback?.technical
        ? [
            { label: 'Technical Accuracy', value: currentQuestionFeedback.technical || 0 },
            { label: 'Communication Clarity', value: currentQuestionFeedback.communication || 0 },
            { label: 'Depth of Understanding', value: currentQuestionFeedback.depth || 0 },
        ]
        : [
            { label: 'Overall Quality', value: currentQuestionFeedback?.score || 0 },
        ];

    const getScoreSummary = (score) => {
        if (score >= 8) {
            return { text: 'Excellent', color: '#4CAF50' };
        } else if (score >= 6) {
            return { text: 'Good', color: '#2196F3' };
        } else if (score >= 4) {
            return { text: 'Fair', color: '#FF9800' };
        } else {
            return { text: 'Needs Improvement', color: '#f44336' };
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!result) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h5">Result not found</Typography>
                <Button onClick={() => navigate('/candidate')} sx={{ mt: 2 }}>
                    Back to Dashboard
                </Button>
            </Box>
        );
    }

    const questions = result.answers || [];

    const calculateOverallScore = () => {
        if (result?.overall_score && result.overall_score > 0) return result.overall_score;
        if (result?.score && result.score > 0) return result.score;
        if (result?.scores?.average) return result.scores.average;

        if (result?.feedback && result.feedback.length > 0) {
            const total = result.feedback.reduce((acc, item) => acc + (item.score || item.overall || 0), 0);
            return (total / result.feedback.length).toFixed(1);
        }
        return '0.0';
    };

    const overallScore = calculateOverallScore();

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
            {/* Header */}
            <Box
                sx={{
                    height: 64,
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 3,
                    flexShrink: 0,
                    zIndex: 1200,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => navigate('/candidate')}>
                        <ArrowBack />
                    </IconButton>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {interview?.title || 'Interview Results'}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={toggleTheme} color="inherit">
                        {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                    </IconButton>
                    <IconButton onClick={handleLogout} color="inherit">
                        <Logout />
                    </IconButton>
                    <Avatar src={user?.avatar_url} />
                </Box>
            </Box>

            {/* Main Layout */}
            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar */}
                <Box
                    sx={{
                        width: 320,
                        bgcolor: 'background.paper',
                        borderRight: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                    }}
                >
                    <Box sx={{ p: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                            Interview Questions
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Navigate between questions
                        </Typography>
                    </Box>

                    {questions.map((item, index) => (
                        <Box
                            key={index}
                            onClick={() => setCurrentQuestionIndex(index)}
                            sx={{
                                p: 2,
                                cursor: 'pointer',
                                bgcolor: currentQuestionIndex === index ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                                borderLeft: `4px solid ${currentQuestionIndex === index ? theme.palette.primary.main : 'transparent'}`,
                                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                                display: 'flex',
                                gap: 2,
                            }}
                        >
                            {getQuestionStatusIcon(index)}
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: currentQuestionIndex === index ? 600 : 400,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    Question {index + 1}: {item.question}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>

                {/* Content Area */}
                <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
                    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
                        {/* Score Card */}
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                mb: 4,
                                borderRadius: 3,
                                borderRadius: 3,
                                border: 1,
                                borderColor: 'divider',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                <Avatar
                                    sx={{ width: 64, height: 64, bgcolor: 'action.hover' }}
                                    src={user?.avatar_url}
                                />
                                <Box>
                                    <Typography variant="h6" fontWeight="bold">
                                        {user?.username || 'Candidate'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {user?.email || 'No Email'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Applied for: {interview?.job_role || interview?.title}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="h3" fontWeight="bold" sx={{ color: getScoreColor(overallScore) }}>
                                    {overallScore}
                                    <Typography component="span" variant="h6" color="text.secondary">
                                        / 10 Overall Score
                                    </Typography>
                                </Typography>
                                <Chip
                                    label={result.status}
                                    size="small"
                                    sx={{
                                        mt: 1,
                                        bgcolor: alpha(
                                            result.status === 'accepted' ? '#4CAF50' :
                                                result.status === 'rejected' ? '#f44336' : '#FF9800',
                                            0.1
                                        ),
                                        color: result.status === 'accepted' ? '#4CAF50' :
                                            result.status === 'rejected' ? '#f44336' : '#FF9800',
                                        fontWeight: 'bold',
                                        textTransform: 'capitalize',
                                    }}
                                />
                            </Box>
                        </Paper>

                        {/* Question Detail */}
                        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
                            Question {currentQuestionIndex + 1}: {currentQuestion}
                        </Typography>

                        {/* Answer Section */}
                        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: 1, borderColor: 'divider' }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                                Your Answer
                            </Typography>
                            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                                {currentAnswer?.transcript || 'No answer recorded.'}
                            </Typography>
                        </Paper>

                        {/* Feedback Section */}
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={8}>
                                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                                        AI Feedback
                                    </Typography>
                                    <Typography variant="body1" sx={{ mb: 3 }}>
                                        {currentQuestionFeedback?.feedback || 'No feedback available.'}
                                    </Typography>

                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle2" sx={{ color: '#4CAF50', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CheckCircle fontSize="small" /> Key Strengths
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {currentQuestionFeedback?.strengths || 'None noted.'}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography variant="subtitle2" sx={{ color: '#FF9800', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Warning fontSize="small" /> Areas for Improvement
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {currentQuestionFeedback?.areas_for_improvement || 'None noted.'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: 1, borderColor: 'divider', height: '100%' }}>
                                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                                        Score Breakdown
                                    </Typography>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        {scoreBreakdown.map((item, index) => (
                                            <Box key={index}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {item.label}
                                                    </Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {item.value}/10
                                                    </Typography>
                                                </Box>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={item.value * 10}
                                                    sx={{
                                                        height: 8,
                                                        borderRadius: 4,
                                                        bgcolor: alpha(getScoreColor(item.value), 0.1),
                                                        '& .MuiLinearProgress-bar': {
                                                            bgcolor: getScoreColor(item.value),
                                                            borderRadius: 4,
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        ))}
                                    </Box>

                                    <Box sx={{ mt: 4, p: 2, bgcolor: alpha(getScoreSummary(currentQuestionFeedback?.score || 0).color, 0.1), borderRadius: 2, textAlign: 'center' }}>
                                        <Typography variant="h4" fontWeight="bold" sx={{ color: getScoreSummary(currentQuestionFeedback?.score || 0).color }}>
                                            {currentQuestionFeedback?.score || 0}
                                        </Typography>
                                        <Typography variant="caption" fontWeight="bold" sx={{ color: getScoreSummary(currentQuestionFeedback?.score || 0).color }}>
                                            {getScoreSummary(currentQuestionFeedback?.score || 0).text}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default CandidateResultDetail;
