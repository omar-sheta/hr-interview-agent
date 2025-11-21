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
    Snackbar,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    ExpandMore,
    CheckCircle,
    Warning,
    Cancel,
    ArrowBack,
    Download,
} from '@mui/icons-material';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const InterviewResultDetail = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);
    const [interview, setInterview] = useState(null);
    const [candidate, setCandidate] = useState(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    useEffect(() => {
        fetchResultDetails();
    }, [sessionId]);

    const fetchResultDetails = async () => {
        try {
            setLoading(true);

            // Fetch all results to find the one we need
            const resultsRes = await api.get('/api/admin/results', {
                params: { admin_id: user.user_id },
            });

            const targetResult = resultsRes.data.results.find(
                (r) => r.session_id === sessionId
            );

            if (!targetResult) {
                throw new Error('Result not found');
            }

            setResult(targetResult);

            // Fetch interview details
            const interviewsRes = await api.get('/api/admin/interviews', {
                params: { admin_id: user.user_id },
            });

            const interviewData = interviewsRes.data.interviews.find(
                (i) => i.id === targetResult.interview_id
            );

            setInterview(interviewData);

            // Fetch candidate details
            const candidatesRes = await api.get('/api/admin/candidates', {
                params: { admin_id: user.user_id },
            });

            const candidateData = candidatesRes.data.candidates.find(
                (c) => c.id === targetResult.candidate_id
            );

            setCandidate(candidateData);
        } catch (error) {
            console.error('Error fetching result details:', error);
            setSnackbar({
                open: true,
                message: 'Failed to load result details',
                severity: 'error',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        try {
            const { data } = await api.post(
                `/api/admin/results/${sessionId}/accept`,
                null,
                { params: { admin_id: user.user_id } }
            );

            setResult({ ...result, status: 'accepted' });
            setSnackbar({
                open: true,
                message: data.email_sent
                    ? '✅ Candidate accepted and email sent!'
                    : '✅ Candidate accepted (email not sent)',
                severity: data.email_sent ? 'success' : 'warning',
            });
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to accept candidate',
                severity: 'error',
            });
        }
    };

    const handleReject = async () => {
        try {
            const { data } = await api.post(
                `/api/admin/results/${sessionId}/reject`,
                null,
                { params: { admin_id: user.user_id } }
            );

            setResult({ ...result, status: 'rejected' });
            setSnackbar({
                open: true,
                message: data.email_sent
                    ? '✉️ Candidate rejected and email sent'
                    : '✅ Candidate rejected (email not sent)',
                severity: data.email_sent ? 'info' : 'warning',
            });
        } catch (error) {
            setSnackbar({
                open: true,
                message: 'Failed to reject candidate',
                severity: 'error',
            });
        }
    };

    const getQuestionStatusIcon = (questionIndex) => {
        if (!result?.feedback) return <Warning sx={{ color: '#FF9800' }} />;

        const feedback = result.feedback[`question_${questionIndex}`];
        if (!feedback) return <Warning sx={{ color: '#FF9800' }} />;

        const score = feedback.average_score || 0;

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

    const calculateCategoryScores = (questionIndex) => {
        if (!result?.feedback) return null;

        const feedback = result.feedback[`question_${questionIndex}`];
        if (!feedback) return null;

        // Extract scores from feedback
        const scores = feedback.scores || {};

        return {
            technical_accuracy: scores.technical_accuracy || scores.accuracy || 7,
            communication_clarity: scores.communication_clarity || scores.clarity || 7,
            depth_of_understanding: scores.depth_of_understanding || scores.depth || 7,
        };
    };

    if (loading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    if (!result || !interview || !candidate) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography variant="h6">Result not found</Typography>
                <Button onClick={() => navigate('/admin/results')} startIcon={<ArrowBack />}>
                    Back to Results
                </Button>
            </Box>
        );
    }

    const questions = interview.config?.questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    const currentFeedback = result.feedback?.[`question_${currentQuestionIndex}`];
    const currentAnswer = result.answers?.[`question_${currentQuestionIndex}`];
    const categoryScores = calculateCategoryScores(currentQuestionIndex);

    const statusColors = {
        pending: '#FF9800',
        accepted: '#4CAF50',
        rejected: '#f44336',
    };

    const overallScore = result.average_score || 0;

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
            {/* Header */}
            <Box
                sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bgcolor: 'white',
                    borderBottom: '1px solid #e0e0e0',
                    zIndex: 100,
                    p: 2,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton onClick={() => navigate('/admin/results')}>
                            <ArrowBack />
                        </IconButton>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {interview.title}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            sx={{
                                bgcolor: '#4CAF50',
                                '&:hover': { bgcolor: '#45a049' },
                                textTransform: 'none',
                            }}
                            onClick={handleAccept}
                            disabled={result.status === 'accepted'}
                        >
                            Accept
                        </Button>
                        <Button
                            variant="contained"
                            sx={{
                                bgcolor: '#f44336',
                                '&:hover': { bgcolor: '#da190b' },
                                textTransform: 'none',
                            }}
                            onClick={handleReject}
                            disabled={result.status === 'rejected'}
                        >
                            Reject
                        </Button>
                        <Button
                            variant="outlined"
                            sx={{ textTransform: 'none' }}
                            disabled={result.status !== 'pending'}
                        >
                            Pending
                        </Button>
                    </Box>
                </Box>

                {/* Candidate Card */}
                <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Avatar
                        src={candidate.avatar_url}
                        sx={{ width: 80, height: 80 }}
                    >
                        {candidate.username?.[0]?.toUpperCase()}
                    </Avatar>

                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                            {candidate.username}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {candidate.email}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Applied for: {interview.title}
                        </Typography>
                    </Box>

                    <Box sx={{ textAlign: 'center' }}>
                        <Typography
                            variant="h3"
                            sx={{
                                fontWeight: 'bold',
                                color: getScoreColor(overallScore),
                            }}
                        >
                            {overallScore.toFixed(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            / 10 Overall Score
                        </Typography>
                        <Chip
                            label={result.status?.charAt(0).toUpperCase() + result.status?.slice(1) || 'Pending'}
                            sx={{
                                mt: 1,
                                bgcolor: statusColors[result.status] || '#FF9800',
                                color: 'white',
                            }}
                            size="small"
                        />
                    </Box>
                </Paper>
            </Box>

            {/* Question Navigation Sidebar */}
            <Box
                sx={{
                    width: 250,
                    position: 'fixed',
                    left: 0,
                    top: 200,
                    bottom: 0,
                    borderRight: '1px solid #e0e0e0',
                    bgcolor: 'white',
                    overflow: 'auto',
                    p: 2,
                }}
            >
                <Typography variant="subtitle2" sx={{ mb: 2, color: '#666' }}>
                    Interview Questions
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Navigate between questions
                </Typography>

                {questions.map((q, index) => {
                    const qType = q.type || 'technical';
                    const qText = q.question || q;

                    return (
                        <Box
                            key={index}
                            onClick={() => setCurrentQuestionIndex(index)}
                            sx={{
                                p: 1.5,
                                mb: 1,
                                cursor: 'pointer',
                                borderRadius: 1,
                                border: '1px solid #e0e0e0',
                                bgcolor: index === currentQuestionIndex ? '#e3f2fd' : 'white',
                                '&:hover': { bgcolor: '#f5f5f5' },
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1,
                            }}
                        >
                            {getQuestionStatusIcon(index)}
                            <Box sx={{ flex: 1 }}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: index === currentQuestionIndex ? 'bold' : 'normal',
                                        fontSize: '0.875rem',
                                        lineHeight: 1.3,
                                    }}
                                >
                                    Question {index + 1}: {qText.length > 50 ? qText.substring(0, 50) + '...' : qText}
                                </Typography>
                                <Chip
                                    label={qType}
                                    size="small"
                                    sx={{
                                        mt: 0.5,
                                        height: 20,
                                        fontSize: '0.7rem',
                                        bgcolor: qType === 'technical' ? '#e3f2fd' : '#fff3e0',
                                        color: qType === 'technical' ? '#1976d2' : '#f57c00',
                                    }}
                                />
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            {/* Main Content */}
            <Box
                sx={{
                    flex: 1,
                    ml: '250px',
                    mr: '320px',
                    mt: '200px',
                    p: 4,
                }}
            >
                {currentQuestion && (
                    <>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
                            Question {currentQuestionIndex + 1}: {currentQuestion.question || currentQuestion}
                        </Typography>

                        {/* Candidate's Answer */}
                        <Accordion defaultExpanded sx={{ mb: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="h6">Candidate's Answer</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ bgcolor: '#f9f9f9' }}>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {currentAnswer || 'No answer provided'}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>

                        {/* AI Feedback */}
                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                                <Typography variant="h6">AI Feedback</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ bgcolor: '#f9f9f9' }}>
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {currentFeedback?.feedback || 'No feedback available'}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    </>
                )}
            </Box>

            {/* Score Breakdown Sidebar */}
            <Box
                sx={{
                    width: 300,
                    position: 'fixed',
                    right: 0,
                    top: 200,
                    bottom: 0,
                    borderLeft: '1px solid #e0e0e0',
                    bgcolor: 'white',
                    overflow: 'auto',
                    p: 3,
                }}
            >
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 'bold' }}>
                    Score Breakdown
                </Typography>

                {categoryScores && (
                    <Box>
                        {/* Technical Accuracy */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    Technical Accuracy
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: getScoreColor(categoryScores.technical_accuracy) }}>
                                    {categoryScores.technical_accuracy}/10
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(categoryScores.technical_accuracy / 10) * 100}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: '#e0e0e0',
                                    '& .MuiLinearProgress-bar': {
                                        bgcolor: getScoreColor(categoryScores.technical_accuracy),
                                    },
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Information provided is accurate and relevant.
                            </Typography>
                        </Box>

                        {/* Communication Clarity */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    Communication Clarity
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: getScoreColor(categoryScores.communication_clarity) }}>
                                    {categoryScores.communication_clarity}/10
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(categoryScores.communication_clarity / 10) * 100}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: '#e0e0e0',
                                    '& .MuiLinearProgress-bar': {
                                        bgcolor: getScoreColor(categoryScores.communication_clarity),
                                    },
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                Explanation is clear and easy to follow.
                            </Typography>
                        </Box>

                        {/* Depth of Understanding */}
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    Depth of Understanding
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', color: getScoreColor(categoryScores.depth_of_understanding) }}>
                                    {categoryScores.depth_of_understanding}/10
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={(categoryScores.depth_of_understanding / 10) * 100}
                                sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    bgcolor: '#e0e0e0',
                                    '& .MuiLinearProgress-bar': {
                                        bgcolor: getScoreColor(categoryScores.depth_of_understanding),
                                    },
                                }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                {categoryScores.depth_of_understanding >= 8 ? 'Demonstrates strong understanding' : 'Lacks some detail on advanced concepts.'}
                            </Typography>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    );
};

export default InterviewResultDetail;
