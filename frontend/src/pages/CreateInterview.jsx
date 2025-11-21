import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    Paper,
    TextField,
    Container,
    FormControlLabel,
    Switch,
    Slider,
    Stack,
    Chip,
    CircularProgress,
    Alert,
    IconButton,
    Divider,
    Grid,
    InputAdornment,
    Checkbox,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    DialogContentText,
    MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    AutoAwesome,
    Delete,
    Add,
    Edit,
    CheckCircle,
    Warning,
    ArrowUpward,
    ArrowDownward,
} from '@mui/icons-material';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const steps = ['Job Details & AI Config', 'Review Questions', 'Assign Candidates', 'Finalize'];

const CreateInterview = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const theme = useTheme();

    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidates, setSelectedCandidates] = useState([]);

    // Refine Dialog State
    const [refineDialogOpen, setRefineDialogOpen] = useState(false);
    const [refinePrompt, setRefinePrompt] = useState('');
    const [currentRefineIndex, setCurrentRefineIndex] = useState(null);
    const [refiningQuestion, setRefiningQuestion] = useState(null); // Track loading state

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        job_role: '',
        job_description: '',
        use_ai_generation: true,
        num_questions: 5,
        questions: [],
        deadline: '',
        difficulty_level: 'moderate',  // Add difficulty level
    });

    // Fetch candidates when component mounts
    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                const response = await api.get('/api/admin/candidates', { params: { admin_id: user.user_id } });
                setCandidates(response.data.candidates || []);
            } catch (err) {
                console.error('Failed to fetch candidates:', err);
            }
        };
        fetchCandidates();
    }, [user.user_id]);

    const handleChange = (e) => {
        const { name, value, checked } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'use_ai_generation' ? checked : value,
        });
    };

    const handleSliderChange = (event, newValue) => {
        setFormData({ ...formData, num_questions: newValue });
    };

    const handleQuestionChange = (index, field, value) => {
        const updatedQuestions = [...formData.questions];
        updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
        setFormData({ ...formData, questions: updatedQuestions });
    };

    const handleDeleteQuestion = (index) => {
        const updatedQuestions = formData.questions.filter((_, i) => i !== index);
        // Re-index
        const reindexed = updatedQuestions.map((q, i) => ({ ...q, index: i }));
        setFormData({ ...formData, questions: reindexed });
    };

    const handleMoveQuestion = (index, direction) => {
        const newQuestions = [...formData.questions];
        if (direction === 'up' && index > 0) {
            [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];
        } else if (direction === 'down' && index < newQuestions.length - 1) {
            [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
        }
        // Re-index
        const reindexed = newQuestions.map((q, i) => ({ ...q, index: i }));
        setFormData({ ...formData, questions: reindexed });
    };

    const handleAddQuestion = () => {
        const newQuestion = {
            id: Date.now(),
            question: '',
            index: formData.questions.length,
            type: 'technical',
            scoring_criteria: 'Evaluate based on clarity and depth.',
        };
        setFormData({ ...formData, questions: [...formData.questions, newQuestion] });
    };

    const handleToggleCandidate = (candidateId) => {
        setSelectedCandidates((prev) =>
            prev.includes(candidateId)
                ? prev.filter((id) => id !== candidateId)
                : [...prev, candidateId]
        );
    };

    const handleRefineClick = (index) => {
        setCurrentRefineIndex(index);
        setRefinePrompt('Refine this question to make it more specific and clear.');
        setRefineDialogOpen(true);
    };

    const handleConfirmRefine = async () => {
        if (currentRefineIndex === null) return;

        const index = currentRefineIndex;
        setRefineDialogOpen(false);
        setRefiningQuestion(index);
        setError('');

        try {
            const currentQuestion = formData.questions[index];

            const response = await api.post('/api/admin/refine-question', null, {
                params: {
                    admin_id: user.user_id,
                    question: currentQuestion.question,
                    job_role: formData.job_role,
                    job_description: formData.job_description,
                    instruction: refinePrompt
                }
            });

            const refined = response.data.refined_question;
            if (refined) {
                // Update state atomically to avoid race conditions
                setFormData(prev => {
                    const updatedQuestions = [...prev.questions];
                    updatedQuestions[index] = {
                        ...updatedQuestions[index],
                        question: refined.question,
                        scoring_criteria: refined.scoring_criteria || updatedQuestions[index].scoring_criteria
                    };
                    return { ...prev, questions: updatedQuestions };
                });
            }
        } catch (err) {
            console.error('Refine error:', err);
            setError(err.response?.data?.detail || 'Failed to refine question. Please try again.');
        } finally {
            setRefiningQuestion(null);
            setCurrentRefineIndex(null);
        }
    };

    const generateQuestions = async () => {
        setLoading(true);
        setError('');
        try {
            // We'll use the admin interview creation endpoint which handles generation
            // But since we want to preview, we might need a dedicated generation endpoint
            // OR we can simulate it by calling the generation service if exposed, 
            // but currently it's bundled in create_interview.

            // Workaround: We'll use a temporary "dry run" or just create the interview and then edit?
            // No, better to have a generation endpoint. 
            // Since we don't have a dedicated public generation endpoint, we'll use the 
            // existing logic in the backend. 

            // Actually, looking at the backend code, the creation endpoint does everything.
            // To support "Review Questions", we should ideally have a generate endpoint.
            // For now, I'll implement a client-side placeholder or if I can, I'll add a generation endpoint.
            // But I shouldn't modify backend if not strictly needed.

            // Wait, I can use the `create_interview` endpoint but maybe I can't preview?
            // The user wants to "Enhance interview creation form".

            // Let's assume for this step we will just create the interview directly if AI is on,
            // OR we can add a backend endpoint for generation.

            // Let's add a simple generation endpoint to the backend first?
            // Or I can just mock it for now if I can't change backend easily.
            // But I CAN change backend.

            // Let's try to use the existing creation flow but maybe pause at step 2?
            // Actually, the prompt says "Generate questions via AI when enabled" and "Allow manual question editing".
            // This implies a generation step BEFORE saving.

            // I will add a generation endpoint to `admin.py`.

            const response = await api.post('/api/admin/generate-questions', {
                job_role: formData.job_role,
                job_description: formData.job_description,
                num_questions: formData.num_questions,
                difficulty_level: formData.difficulty_level,
                model: "gemma3:27b"
            });

            if (response.data.questions) {
                // Add IDs to questions for animation
                const questionsWithIds = response.data.questions.map((q, i) => ({
                    ...q,
                    id: Date.now() + i,
                    index: i
                }));
                setFormData({ ...formData, questions: questionsWithIds });
                setActiveStep(1);
            }
        } catch (err) {
            console.error('Generation failed:', err);
            setError('Failed to generate questions. Please try again or add manually.');
            // Fallback to manual entry
            setActiveStep(1);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = async () => {
        if (activeStep === 0) {
            if (!formData.title) {
                setError('Please enter an interview title');
                return;
            }

            if (formData.use_ai_generation) {
                if (!formData.job_role && !formData.job_description) {
                    setError('Please provide a Job Role or Description for AI generation');
                    return;
                }
                await generateQuestions();
            } else {
                setActiveStep(1);
            }
        } else if (activeStep === 1) {
            setActiveStep(2); // Move to candidate assignment
        } else if (activeStep === 2) {
            setActiveStep(3); // Move to finalize
        } else {
            // Submit
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');
        try {
            const payload = {
                admin_id: user.user_id,
                title: formData.title,
                description: formData.description || formData.job_description,
                job_role: formData.job_role,
                job_description: formData.job_description,
                num_questions: formData.questions.length,
                use_ai_generation: false, // We already generated them
                active: true,
                allowed_candidate_ids: selectedCandidates,
                deadline: formData.deadline || null,
                config: {
                    questions: formData.questions,
                    ai_generated: formData.use_ai_generation,
                    difficulty_level: formData.difficulty_level,
                    source: 'web-ui'
                }
            };

            await api.post('/api/admin/interviews', payload);
            setSuccess('Interview created successfully!');
            setTimeout(() => navigate('/admin/interviews'), 1500);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create interview');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ width: '100%', mt: 4, mb: 8 }}>
                <Typography variant="h4" fontWeight="800" sx={{ mb: 4 }}>
                    Create New Interview
                </Typography>

                <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

                <Paper sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                    {activeStep === 0 && (
                        <Box>
                            <Typography variant="h6" gutterBottom fontWeight="bold">
                                Basic Information
                            </Typography>
                            <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Interview Title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        placeholder="e.g., Senior React Developer"
                                        required
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.use_ai_generation}
                                                onChange={handleChange}
                                                name="use_ai_generation"
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <AutoAwesome color="primary" />
                                                <Typography fontWeight="bold">Use AI Generation</Typography>
                                            </Box>
                                        }
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={2}
                                        label="Internal Description (Optional)"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        type="datetime-local"
                                        label="Deadline"
                                        name="deadline"
                                        value={formData.deadline}
                                        onChange={handleChange}
                                        InputLabelProps={{ shrink: true }}
                                        helperText="Optional deadline for candidate submissions"
                                    />
                                </Grid>
                            </Grid>

                            {formData.use_ai_generation && (
                                <>
                                    <Divider sx={{ mb: 4 }}>
                                        <Chip label="AI Configuration" color="primary" variant="outlined" />
                                    </Divider>

                                    <Grid container spacing={3}>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Job Role"
                                                name="job_role"
                                                value={formData.job_role}
                                                onChange={handleChange}
                                                placeholder="e.g., Backend Engineer"
                                                helperText="The specific role title helps AI tailor questions"
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Typography gutterBottom>Number of Questions: {formData.num_questions}</Typography>
                                            <Slider
                                                value={formData.num_questions}
                                                onChange={handleSliderChange}
                                                min={3}
                                                max={15}
                                                step={1}
                                                marks
                                                valueLabelDisplay="auto"
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                select
                                                fullWidth
                                                label="Assessment Level"
                                                name="difficulty_level"
                                                value={formData.difficulty_level}
                                                onChange={handleChange}
                                                helperText="Adjust scoring strictness and question complexity"
                                            >
                                                <MenuItem value="easy">Easy - Entry Level</MenuItem>
                                                <MenuItem value="moderate">Moderate - Standard Assessment</MenuItem>
                                                <MenuItem value="highly_competitive">Highly Competitive - Expert Level</MenuItem>
                                            </TextField>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                multiline
                                                rows={6}
                                                label="Job Description / Requirements"
                                                name="job_description"
                                                value={formData.job_description}
                                                onChange={handleChange}
                                                placeholder="Paste the full job description, requirements, and tech stack here. The AI will analyze this to generate relevant questions."
                                            />
                                        </Grid>
                                    </Grid>
                                </>
                            )}
                        </Box>
                    )}

                    {activeStep === 1 && (
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" fontWeight="bold">
                                    Review Questions ({formData.questions.length})
                                </Typography>
                                <Button startIcon={<Add />} onClick={handleAddQuestion} variant="outlined" size="small">
                                    Add Question
                                </Button>
                            </Box>

                            {formData.questions.length === 0 ? (
                                <Alert severity="info">No questions generated. Click "Add Question" to start manually.</Alert>
                            ) : (
                                <Stack spacing={3} component={motion.div} layout>
                                    <AnimatePresence mode='popLayout'>
                                        {formData.questions.map((q, index) => (
                                            <motion.div
                                                key={q.id || `question-${index}`}
                                                layout
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <Paper variant="outlined" sx={{ p: 3, position: 'relative' }}>
                                                    <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', mr: 1 }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleMoveQuestion(index, 'up')}
                                                                disabled={index === 0}
                                                            >
                                                                <ArrowUpward fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleMoveQuestion(index, 'down')}
                                                                disabled={index === formData.questions.length - 1}
                                                            >
                                                                <ArrowDownward fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                        <IconButton
                                                            size="small"
                                                            color="primary"
                                                            onClick={() => handleRefineClick(index)}
                                                            disabled={refiningQuestion === index || !q.question}
                                                            title="Refine with AI"
                                                        >
                                                            {refiningQuestion === index ? (
                                                                <CircularProgress size={20} />
                                                            ) : (
                                                                <AutoAwesome />
                                                            )}
                                                        </IconButton>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            onClick={() => handleDeleteQuestion(index)}
                                                        >
                                                            <Delete />
                                                        </IconButton>
                                                    </Box>

                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12}>
                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                                                Question {index + 1}
                                                            </Typography>
                                                            <TextField
                                                                fullWidth
                                                                multiline
                                                                value={q.question}
                                                                onChange={(e) => handleQuestionChange(index, 'question', e.target.value)}
                                                                variant="standard"
                                                                placeholder="Enter question text..."
                                                            />
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            <TextField
                                                                select
                                                                fullWidth
                                                                label="Type"
                                                                value={q.type || 'technical'}
                                                                onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
                                                                SelectProps={{ native: true }}
                                                                variant="standard"
                                                                size="small"
                                                            >
                                                                <option value="technical">Technical</option>
                                                                <option value="behavioral">Behavioral</option>
                                                            </TextField>
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            <TextField
                                                                fullWidth
                                                                label="Scoring Criteria"
                                                                value={q.scoring_criteria || ''}
                                                                onChange={(e) => handleQuestionChange(index, 'scoring_criteria', e.target.value)}
                                                                variant="standard"
                                                                size="small"
                                                            />
                                                        </Grid>
                                                    </Grid>
                                                </Paper>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </Stack>
                            )}
                        </Box>
                    )}

                    {activeStep === 2 && (
                        <Box>
                            <Typography variant="h6" gutterBottom fontWeight="bold">
                                Assign Candidates
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Select candidates who should receive this interview invitation.
                                {selectedCandidates.length > 0 && ` (${selectedCandidates.length} selected)`}
                            </Typography>

                            {candidates.length === 0 ? (
                                <Alert severity="info">
                                    No candidates found. You can skip this step and assign candidates later.
                                </Alert>
                            ) : (
                                <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                                    <List>
                                        {candidates.map((candidate) => (
                                            <ListItem key={candidate.id} disablePadding>
                                                <ListItemButton onClick={() => handleToggleCandidate(candidate.id)} dense>
                                                    <ListItemIcon>
                                                        <Checkbox
                                                            edge="start"
                                                            checked={selectedCandidates.includes(candidate.id)}
                                                            tabIndex={-1}
                                                            disableRipple
                                                        />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={
                                                            candidate.first_name && candidate.last_name
                                                                ? `${candidate.first_name} ${candidate.last_name} (${candidate.email})`
                                                                : candidate.email || candidate.username
                                                        }
                                                        secondary={candidate.username}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            )}

                            <Alert severity="info" sx={{ mt: 3 }}>
                                Selected candidates will receive an email invitation with a link to log in and take the interview.
                            </Alert>
                        </Box>
                    )}

                    {activeStep === 3 && (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                            <Typography variant="h5" gutterBottom>
                                Ready to Create!
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 4 }}>
                                You are about to create "<strong>{formData.title}</strong>" with {formData.questions.length} questions
                                {selectedCandidates.length > 0 && ` for ${selectedCandidates.length} candidate(s)`}.
                            </Typography>

                            <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'left' }}>
                                <Alert severity="info" icon={<AutoAwesome />}>
                                    The AI interviewer will use these questions to conduct the interview.
                                    Candidates will be evaluated based on the criteria you reviewed.
                                </Alert>
                            </Box>
                        </Box>
                    )}
                </Paper>

                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                    <Button
                        color="inherit"
                        disabled={activeStep === 0 || loading}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                    >
                        Back
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        disabled={loading}
                        startIcon={loading && <CircularProgress size={20} color="inherit" />}
                    >
                        {loading ? 'Processing...' : activeStep === steps.length - 1 ? 'Create Interview' : 'Next'}
                    </Button>
                </Box>
            </Box >

            {/* Refine Question Dialog */}
            < Dialog open={refineDialogOpen} onClose={() => setRefineDialogOpen(false)}>
                <DialogTitle>Refine Question with AI</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        How would you like the AI to improve this question?
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="refinePrompt"
                        label="Refinement Instruction"
                        type="text"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={3}
                        value={refinePrompt}
                        onChange={(e) => setRefinePrompt(e.target.value)}
                        placeholder="e.g., Make it more focused on system design..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRefineDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleConfirmRefine} variant="contained">
                        Refine
                    </Button>
                </DialogActions>
            </Dialog >
        </Container >
    );
};

export default CreateInterview;
