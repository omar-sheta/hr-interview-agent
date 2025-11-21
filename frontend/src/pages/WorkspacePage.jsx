import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import api from '../api/client.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  Stack,
  Chip,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrowRounded,
  StopRounded,
  MicRounded,
  RedoRounded,
  SkipNextRounded,
  SendRounded,
  PlayCircleOutlineRounded,
  GraphicEqRounded,
} from '@mui/icons-material';

const WorkspacePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const theme = useTheme();
  const { session, interview } = location.state || {};

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState('loading'); // loading, ready, idle, playing, recording, processing, transcribed, finished
  const [resultsGenerated, setResultsGenerated] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [pendingTranscriptId, setPendingTranscriptId] = useState(null);
  const [error, setError] = useState('');
  const [micLevel, setMicLevel] = useState(0);

  const questionAudioRef = useRef(null);

  const handleRecordingComplete = async (audioBlob) => {
    if (!audioBlob) return;
    setStatus('processing');
    setTranscription('');
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('session_id', session.session_id);
      formData.append('question_index', currentIndex);

      const { data } = await api.post('/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setTranscription(data.transcript);
      setPendingTranscriptId(data.transcript_id);
      setStatus('transcribed');
    } catch (err) {
      setError('Failed to transcribe audio. Please try again.');
      setStatus('idle');
    }
  };

  const { isRecording, startRecording, stopRecording } = useAudioRecorder({
    onRecordingComplete: handleRecordingComplete,
    onMicIntensityChange: (level) => setMicLevel(level),
  });

  useEffect(() => {
    if (session?.questions?.length > 0) {
      setQuestions(session.questions);
      setStatus('ready');
    } else {
      setError('Interview questions are missing.');
      setStatus('error');
    }
    return () => {
      if (questionAudioRef.current) {
        questionAudioRef.current.pause();
      }
    };
  }, [session]);

  useEffect(() => {
    const generateResults = async () => {
      if (status === 'finished' && session && !resultsGenerated) {
        setResultsGenerated(true);
        try {
          await api.get(`/interview/${session.session_id}/results`);
        } catch (err) {
          console.error('Failed to generate results:', err);
        }
      }
    };
    generateResults();
  }, [status, session, resultsGenerated]);

  const stopQuestionAudio = () => {
    if (questionAudioRef.current) {
      questionAudioRef.current.pause();
      questionAudioRef.current = null;
    }
  };

  const handlePlayQuestion = async (questionIndex = currentIndex) => {
    stopQuestionAudio();
    setStatus('playing');
    try {
      const response = await api.post('/synthesize', { text: questions[questionIndex] }, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const audio = new Audio(url);
      questionAudioRef.current = audio;
      audio.onended = () => {
        setStatus('idle');
        setTimeout(() => {
          handleStartRecording();
        }, 500);
      };
      await audio.play();
    } catch (err) {
      setError('Could not play question audio.');
      setStatus('idle');
    }
  };

  const handleStartInterview = () => {
    setStatus('idle');
    setTimeout(handlePlayQuestion, 100);
  };

  const handleStartRecording = () => {
    stopQuestionAudio();
    setTranscription('');
    setPendingTranscriptId(null);
    startRecording().catch(err => {
      setError('Microphone access denied or not available.');
      setStatus('idle');
    });
  };

  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    let interval;
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      setStatus('recording');
    } else if (status === 'recording') {
      setStatus('processing');
    }
  }, [isRecording]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    setStatus('processing');
    console.log(`[SUBMIT] Submitting question index: ${currentIndex}, transcript_id: ${pendingTranscriptId}`);
    try {
      const formData = new FormData();
      formData.append('session_id', session.session_id);
      formData.append('question_index', currentIndex);
      if (pendingTranscriptId) {
        formData.append('transcript_id', pendingTranscriptId);
      }

      console.log(`[SUBMIT] FormData - session_id: ${session.session_id}, question_index: ${currentIndex}, transcript_id: ${pendingTranscriptId || 'none'}`);
      await api.post('/interview/submit', formData);
      console.log(`[SUBMIT] Successfully submitted question ${currentIndex}`);

      if (currentIndex < questions.length - 1) {
        const nextIndex = currentIndex + 1;
        console.log(`[SUBMIT] Moving to next question: ${currentIndex} -> ${nextIndex}`);
        setCurrentIndex(nextIndex);
        setTranscription('');
        setPendingTranscriptId(null);
        setStatus('idle');
        setTimeout(() => handlePlayQuestion(nextIndex), 100);
      } else {
        console.log(`[SUBMIT] Interview finished after question ${currentIndex}`);
        setStatus('finished');
      }
    } catch (err) {
      console.error(`[SUBMIT ERROR] Failed to submit question ${currentIndex}:`, err);
      setError('Failed to submit response.');
      setStatus('transcribed');
    }
  };

  const handleSkip = async () => {
    setStatus('processing');
    console.log(`[SKIP] Skipping question index: ${currentIndex}`);
    try {
      const formData = new FormData();
      formData.append('session_id', session.session_id);
      formData.append('question_index', currentIndex);

      console.log(`[SKIP] FormData - session_id: ${session.session_id}, question_index: ${currentIndex}`);
      await api.post('/interview/submit', formData);
      console.log(`[SKIP] Successfully skipped question ${currentIndex}`);

      if (currentIndex < questions.length - 1) {
        const nextIndex = currentIndex + 1;
        console.log(`[SKIP] Moving to next question: ${currentIndex} -> ${nextIndex}`);
        setCurrentIndex(nextIndex);
        setTranscription('');
        setPendingTranscriptId(null);
        setStatus('idle');
        setTimeout(() => handlePlayQuestion(nextIndex), 100);
      } else {
        console.log(`[SKIP] Interview finished after skipping question ${currentIndex}`);
        setStatus('finished');
      }
    } catch (err) {
      console.error(`[SKIP ERROR] Failed to skip question ${currentIndex}:`, err);
      setError('Failed to skip question.');
      setStatus('idle');
    }
  };

  const handleRedo = () => {
    setTranscription('');
    setPendingTranscriptId(null);
    setStatus('idle');
  };

  if (!interview || !session) {
    return (
      <>
        <Navbar />
        <Container maxWidth="sm" sx={{ mt: 8 }}>
          <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
            No interview session found. Please navigate from your dashboard.
            <Button component={Link} to="/candidate" color="inherit" size="small" sx={{ ml: 2, fontWeight: 'bold' }}>
              Go to Dashboard
            </Button>
          </Alert>
        </Container>
      </>
    );
  }

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const renderMainContent = () => {
    if (status === 'ready') {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, letterSpacing: '-1px' }}>
              Ready to Start?
            </Typography>
            <Typography color="text.secondary" variant="h6" sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}>
              Find a quiet place. We'll ask you a series of questions. Speak clearly and take your time.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayCircleOutlineRounded />}
              onClick={handleStartInterview}
              sx={{
                borderRadius: 50,
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                textTransform: 'none',
                boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
              }}
            >
              Start Interview
            </Button>
            {error && <Alert severity="error" sx={{ mt: 4, borderRadius: 2 }}>{error}</Alert>}
          </Box>
        </motion.div>
      );
    }

    if (status === 'loading') {
      return (
        <Box sx={{ textAlign: 'center', py: 12 }}>
          <CircularProgress size={60} thickness={4} sx={{ mb: 4, color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight="500">Preparing your interview...</Typography>
        </Box>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="overline" color="text.secondary" fontWeight="700" letterSpacing={1}>
                Question {currentIndex + 1} of {questions.length}
              </Typography>
              <Chip label={status === 'recording' ? 'Recording...' : status} color={status === 'recording' ? 'error' : 'default'} size="small" sx={{ fontWeight: 600 }} />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                mb: 4,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': { borderRadius: 4 }
              }}
            />
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700, minHeight: '3em', lineHeight: 1.3 }}>
              {questions[currentIndex]}
            </Typography>
          </Box>

          <Stack direction="row" spacing={3} sx={{ my: 6 }} justifyContent="center" alignItems="center">
            <Tooltip title="Replay Question">
              <span>
                <IconButton
                  onClick={() => handlePlayQuestion()}
                  disabled={status === 'playing' || isRecording}
                  sx={{
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    p: 1.5,
                    '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.1) }
                  }}
                >
                  <PlayArrowRounded fontSize="large" color="primary" />
                </IconButton>
              </span>
            </Tooltip>

            <Box sx={{ position: 'relative' }}>
              {isRecording && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -4,
                    left: -4,
                    right: -4,
                    bottom: -4,
                    borderRadius: '50%',
                    border: `2px solid ${theme.palette.error.main}`,
                    animation: 'pulse 1.5s infinite',
                    '@keyframes pulse': {
                      '0%': { transform: 'scale(1)', opacity: 1 },
                      '100%': { transform: 'scale(1.2)', opacity: 0 },
                    },
                  }}
                />
              )}
              <Button
                variant="contained"
                color={isRecording ? 'error' : 'primary'}
                onClick={isRecording ? stopRecording : handleStartRecording}
                disabled={status === 'playing'}
                sx={{
                  borderRadius: '50%',
                  width: 72,
                  height: 72,
                  minWidth: 0,
                  boxShadow: isRecording ? '0 0 20px rgba(231, 111, 81, 0.5)' : '0 8px 20px rgba(0,0,0,0.15)',
                }}
              >
                {isRecording ? <StopRounded sx={{ fontSize: 36 }} /> : <MicRounded sx={{ fontSize: 36 }} />}
              </Button>
            </Box>
          </Stack>

          {isRecording && (
            <Box sx={{ px: 4, mb: 4, textAlign: 'center' }}>
              <Stack direction="row" alignItems="center" spacing={2} justifyContent="center">
                <GraphicEqRounded color="error" />
                <Box sx={{ width: '100%', maxWidth: 300 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(micLevel * 200, 100)}
                    color="error"
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>
              </Stack>
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block', fontWeight: 600 }}>
                Listening... {formatTime(recordingTime)}
              </Typography>
            </Box>
          )}

          <Paper
            elevation={0}
            sx={{
              p: 3,
              minHeight: 160,
              borderRadius: 4,
              backgroundColor: alpha(theme.palette.background.paper, 0.5),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              backdropFilter: 'blur(10px)',
            }}
          >
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Answer Transcription
            </Typography>
            {(status === 'processing' || status === 'loading') ? (
              <Stack direction="row" alignItems="center" spacing={2} sx={{ height: '100%', py: 4 }}>
                <CircularProgress size={20} thickness={5} />
                <Typography color="text.secondary" fontWeight="500">Processing your answer...</Typography>
              </Stack>
            ) : (
              <Typography
                color="text.primary"
                sx={{
                  fontStyle: transcription ? 'normal' : 'italic',
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                  opacity: transcription ? 1 : 0.6
                }}
              >
                {transcription || 'Your answer will be transcribed here after you stop recording...'}
              </Typography>
            )}
          </Paper>

          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>{error}</Alert>
            </motion.div>
          )}

          <Box sx={{ mt: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              startIcon={<RedoRounded />}
              onClick={handleRedo}
              disabled={!transcription || isRecording}
              color="inherit"
              sx={{ opacity: 0.7 }}
            >
              Redo Answer
            </Button>
            <Stack direction="row" spacing={2}>
              <Button
                startIcon={<SkipNextRounded />}
                onClick={handleSkip}
                disabled={isRecording}
                color="inherit"
                sx={{ opacity: 0.7 }}
              >
                Skip
              </Button>
              <Button
                variant="contained"
                endIcon={<SendRounded />}
                onClick={handleSubmit}
                disabled={!transcription || isRecording}
                size="large"
                sx={{
                  px: 4,
                  borderRadius: 3,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                {currentIndex < questions.length - 1 ? 'Next Question' : 'Finish Interview'}
              </Button>
            </Stack>
          </Box>
        </motion.div>
      </AnimatePresence>
    );
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
        <Container maxWidth="md">
          <Card
            sx={{
              borderRadius: 6,
              backdropFilter: 'blur(20px)',
              backgroundColor: alpha(theme.palette.background.paper, 0.75),
              boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              overflow: 'visible',
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 6 } }}>
              {status === 'finished' ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Typography variant="h3" gutterBottom sx={{ fontWeight: 800 }}>Interview Complete! 🎉</Typography>
                    <Typography color="text.secondary" variant="h6" sx={{ mb: 6 }}>
                      Thank you for your time. Your responses have been submitted for review.
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={() => navigate('/candidate')}
                      sx={{ borderRadius: 50, px: 5, py: 1.5, fontWeight: 700 }}
                    >
                      Back to Dashboard
                    </Button>
                  </Box>
                </motion.div>
              ) : renderMainContent()}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </>
  );
};

export default WorkspacePage;
