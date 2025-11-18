import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import api from '../api/client.js';
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
} from '@mui/material';
import { PlayArrow, Stop, Mic, Redo, SkipNext, Send, PlayCircleOutline } from '@mui/icons-material';

const WorkspacePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { session, interview } = location.state || {}; // Ensure session is available

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
      console.log('Setting questions from session:', session.questions);
      setQuestions(session.questions);
      setStatus('ready'); // Set to 'ready' for the "Click to Start" screen
    } else {
      console.error('Questions missing from session:', session);
      setError('Interview questions are missing.');
      setStatus('error');
    }
    return () => {
      if (questionAudioRef.current) {
        questionAudioRef.current.pause();
      }
    };
  }, [session]); // Depend on session to ensure it's loaded

  // Generate results when interview is finished
  useEffect(() => {
    const generateResults = async () => {
      if (status === 'finished' && session && !resultsGenerated) {
        setResultsGenerated(true);
        try {
          console.log('Generating results for session:', session.session_id);
          await api.get(`/interview/${session.session_id}/results`);
          console.log('Results generated and saved successfully');
        } catch (err) {
          console.error('Failed to generate results:', err);
          // Don't show error to user, results generation is background process
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
    console.log('Playing question:', questions[questionIndex]);
    try {
      const response = await api.post('/synthesize', { text: questions[questionIndex] }, { responseType: 'blob' });
      console.log('Audio synthesized successfully');
      const url = URL.createObjectURL(response.data);
      const audio = new Audio(url);
      questionAudioRef.current = audio;
      audio.onended = () => {
        console.log('Question audio ended, starting recording...');
        setStatus('idle');
        // Automatically start recording after question finishes
        setTimeout(() => {
          handleStartRecording();
        }, 500);
      };
      await audio.play();
      console.log('Audio playing');
    } catch (err) {
      console.error('Error playing question:', err);
      setError('Could not play question audio.');
      setStatus('idle');
    }
  };

  const handleStartInterview = () => {
    setStatus('idle'); // Change status from ready to idle to show interview UI
    setTimeout(handlePlayQuestion, 100); // Play the first question after a brief delay
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

  useEffect(() => {
    // This useEffect handles status changes based on recording state
    if (isRecording) {
      setStatus('recording');
    } else if (status === 'recording') { // If just stopped recording, go to processing
      setStatus('processing');
    }
  }, [isRecording]);

  const handleSubmit = async () => {
    setStatus('processing');
    try {
      const formData = new FormData();
      formData.append('session_id', session.session_id);
      formData.append('question_index', currentIndex);
      if (pendingTranscriptId) {
        formData.append('transcript_id', pendingTranscriptId);
      }
      await api.post('/interview/submit', formData);

      if (currentIndex < questions.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setTranscription('');
        setPendingTranscriptId(null);
        setStatus('idle'); // Return to idle state before playing next question
        setTimeout(() => handlePlayQuestion(nextIndex), 100);
      } else {
        setStatus('finished');
      }
    } catch (err) {
      setError('Failed to submit response.');
      setStatus('transcribed');
    }
  };

  const handleSkip = async () => {
      // Logic for skipping a question
    setStatus('processing'); // Indicate processing for skip
    try {
      // Submit an empty/skipped response
      const formData = new FormData();
      formData.append('session_id', session.session_id);
      formData.append('question_index', currentIndex);
      // No transcript_id for skip
      await api.post('/interview/submit', formData);

      if (currentIndex < questions.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setTranscription('');
        setPendingTranscriptId(null);
        setStatus('idle'); // Return to idle state before playing next question
        setTimeout(() => handlePlayQuestion(nextIndex), 100);
      } else {
        setStatus('finished');
      }
    } catch (err) {
      setError('Failed to skip question.');
      setStatus('idle'); // Return to idle if skip fails
    }
  };

  const handleRedo = () => {
    setTranscription('');
    setPendingTranscriptId(null);
    setStatus('idle'); // Go back to idle to allow re-recording
  };

  if (!interview || !session) {
    return (
      <>
        <Navbar />
        <Container maxWidth="sm" sx={{ mt: 4 }}>
          <Alert severity="error">
            No interview session found. Please navigate from your dashboard.
            <Button component={Link} to="/candidate" sx={{ mt: 2 }}>Go to Dashboard</Button>
          </Alert>
        </Container>
      </>
    );
  }

  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const renderMainContent = () => {
    if (status === 'ready') {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h4" gutterBottom>Ready to Start?</Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Click the button below to begin your interview.
          </Typography>
          <Button variant="contained" size="large" startIcon={<PlayCircleOutline />} onClick={handleStartInterview}>
            Start Interview
          </Button>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Box>
      );
    }
    
    if (status === 'loading') {
        return (
            <Box sx={{ textAlign: 'center', py: 8 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="h5">Loading interview...</Typography>
            </Box>
        );
    }


    return (
      <>
        <Box sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary">
            Question {currentIndex + 1} of {questions.length}
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ my: 1 }} />
          <Typography variant="h4" component="h1" sx={{ mt: 2, minHeight: '3em' }}>
            {questions[currentIndex]}
          </Typography>
        </Box>

        <Stack direction="row" spacing={2} sx={{ my: 4 }} justifyContent="center">
          <Button variant="outlined" startIcon={<PlayArrow />} onClick={handlePlayQuestion} disabled={status === 'playing' || isRecording}>
            Play 
          </Button>
          <Button variant="contained" color="error" startIcon={<Mic />} onClick={handleStartRecording} disabled={isRecording || status === 'playing'}>
            Record
          </Button>
          <Button variant="outlined" startIcon={<Stop />} onClick={stopRecording} disabled={!isRecording}>
            Stop
          </Button>
        </Stack>

        {isRecording && (
          <Box sx={{ px: 2, mb: 2 }}>
            <LinearProgress variant="determinate" value={micLevel * 200} color="error" />
          </Box>
        )}

        <Paper variant="outlined" sx={{ p: 2, minHeight: 150 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="overline">Your transcribed answer:</Typography>
            <Chip label={status} size="small" color={isRecording ? 'error' : 'default'} />
          </Stack>
          {(status === 'processing' || status === 'loading') ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography color="text.secondary">Processing...</Typography>
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ fontStyle: transcription ? 'normal' : 'italic' }}>
              {transcription || 'Transcription will appear here...'}
            </Typography>
          )}
        </Paper>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={2}>
            <Button startIcon={<Redo />} onClick={handleRedo} disabled={!transcription || isRecording}>
              Redo
            </Button>
            <Box>
              <Button startIcon={<SkipNext />} sx={{ mr: 2 }} onClick={handleSkip} disabled={isRecording}>
                Skip
              </Button>
              <Button variant="contained" endIcon={<Send />} onClick={handleSubmit} disabled={!transcription || isRecording}>
                Submit & Next
              </Button>
            </Box>
          </Stack>
        </Box>
      </>
    );
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="md" sx={{ my: 4 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
            {status === 'finished' ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h4" gutterBottom>Interview Complete</Typography>
                <Typography color="text.secondary" sx={{ mb: 4 }}>
                  Thank you for completing the interview. Your responses have been submitted.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/candidate')}>
                  Back to Dashboard
                </Button>
              </Box>
            ) : renderMainContent()}
          </CardContent>
        </Card>
      </Container>
    </>
  );
};

export default WorkspacePage;
