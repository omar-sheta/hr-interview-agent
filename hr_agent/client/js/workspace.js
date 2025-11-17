import { createApiClient } from './api.js';
import { createUI } from './ui.js';
import { createAudioController } from './audio.js';

const params = new URLSearchParams(window.location.search);
const query = Object.fromEntries(params.entries());

const api = createApiClient(query);
const ui = createUI();

const state = {
  candidateId: query.candidate_id || query.candidate || null,
  candidateLabel: query.candidate_name || null,
  interviewId: query.interview_id || null,
  interviewLabel: query.interview_title || null,
  sessionId: query.session_id || null,
  questions: [],
  currentIndex: 0,
  pendingResponse: null,
  questionAudio: null,
};

const audio = createAudioController({
  ui,
  onRecordingComplete: handleRecordedBlob,
});

init();

async function init() {
  ui.setStatus('Connecting to the HR Interview API…');
  try {
    await bootstrapSession();
    bindEventHandlers();
    ui.enableInteractiveControls();
    renderCurrentQuestion();
    ui.setStatus('Ready. Click “Play Question” or start recording when you are prepared.', 'info');
  } catch (error) {
    console.error('Failed to initialize workspace', error);
    ui.setStatus(error.message || 'Unable to load interview workspace.', 'error');
  }
}

async function bootstrapSession() {
  if (state.sessionId) {
    const session = await api.fetchSession(state.sessionId);
    applySession(session);
    return;
  }

  if (state.candidateId && state.interviewId) {
    const payload = await api.startCandidateInterview(state.interviewId, state.candidateId);
    state.sessionId = payload.session?.session_id;
    const enrichedSession = {
      ...payload.session,
      candidate_name: state.candidateLabel || state.candidateId,
      job_role: payload.interview?.title || payload.session?.job_role,
      job_description: payload.interview?.description || payload.session?.job_description,
    };
    applySession(enrichedSession);
    return;
  }

  const fallbackRequest = {
    candidate_name: state.candidateLabel || 'Guest Candidate',
    job_role: query.job_role || 'Software Professional',
    job_description: query.job_description || 'Generated interview via workspace',
    num_questions: Number(query.num_questions || '3'),
  };
  const fallbackSession = await api.startFallbackInterview(fallbackRequest);
  state.sessionId = fallbackSession.session_id;
  applySession({
    ...fallbackSession,
    candidate_name: fallbackRequest.candidate_name,
    job_role: fallbackRequest.job_role,
    job_description: fallbackRequest.job_description,
  });
}

function applySession(session) {
  if (!session) {
    throw new Error('Server did not provide session data.');
  }
  state.questions = Array.isArray(session.questions) ? session.questions : [];
  if (!state.questions.length) {
    throw new Error('No interview questions were provided.');
  }
  state.candidateLabel = state.candidateLabel || session.candidate_name || state.candidateId;
  state.interviewLabel = state.interviewLabel || session.job_role || state.interviewId;
  ui.setSessionDetails({
    candidate: state.candidateLabel,
    interview: state.interviewLabel,
    description: session.job_description,
  });
}

function bindEventHandlers() {
  document.getElementById('play-question-btn')?.addEventListener('click', handlePlayQuestion);
  document.getElementById('start-recording-btn')?.addEventListener('click', async () => {
    try {
      await audio.startRecording();
    } catch (error) {
      ui.setStatus(error.message || 'Unable to access microphone.', 'error');
    }
  });
  document.getElementById('stop-recording-btn')?.addEventListener('click', () => audio.stopRecording('manual'));
  document.getElementById('redo-question-btn')?.addEventListener('click', redoCurrentQuestion);
  document.getElementById('skip-question-btn')?.addEventListener('click', handleSkipQuestion);
  document.getElementById('next-question-btn')?.addEventListener('click', submitCurrentResponse);
  document.getElementById('audio-upload')?.addEventListener('change', handleAudioUpload);

  window.addEventListener('beforeunload', () => {
    stopQuestionAudio();
    audio.dispose();
  });
}

function renderCurrentQuestion() {
  if (state.currentIndex >= state.questions.length) {
    completeInterview();
    return;
  }
  stopQuestionAudio();
  const question = state.questions[state.currentIndex];
  ui.renderQuestion(question, state.currentIndex, state.questions.length);
  ui.setRecordingState('idle');
  state.pendingResponse = null;
}

async function handlePlayQuestion() {
  const question = state.questions[state.currentIndex];
  if (!question) return;
  try {
    ui.setStatus('Generating audio for the question…', 'info');
    const audioBlob = await api.synthesizeQuestion(question);
    stopQuestionAudio();
    const url = URL.createObjectURL(audioBlob);
    state.questionAudio = new Audio(url);
    state.questionAudio.onended = () => {
      URL.revokeObjectURL(url);
      state.questionAudio = null;
      ui.setStatus('Question audio finished. Recording will start automatically.', 'info');
      setTimeout(() => audio.startRecording().catch(() => {}), 600);
    };
    await new Promise((resolve) => setTimeout(resolve, 200));
    await state.questionAudio.play();
    ui.setStatus('Playing interview question…', 'info');
  } catch (error) {
    ui.setStatus(error.message || 'Unable to play question audio.', 'error');
  }
}

async function handleRecordedBlob(blob, info) {
  if (info.reason === 'skip') {
    return;
  }
  ui.setStatus(getAutoStopMessage(info.reason), 'info');
  try {
    const payload = await api.transcribeAudio(blob, state.sessionId, state.currentIndex);
    const transcript = payload.transcript ?? payload.transcription ?? '';
    if (!transcript) {
      throw new Error('No transcription returned from the server.');
    }
    state.pendingResponse = { transcriptId: payload.transcript_id, transcript };
    ui.showTranscription(transcript);
    ui.setRecordingState('idle');
    ui.setStatus('Review the transcript, then submit or redo the question.', 'info');
  } catch (error) {
    console.error('Transcription failed', error);
    ui.clearTranscription();
    ui.setStatus(error.message || 'Unable to process the recording.', 'error');
    ui.setRecordingState('idle');
  }
}

function getAutoStopMessage(reason) {
  switch (reason) {
    case 'silence':
      return 'Recording stopped after 5 seconds of silence. Processing your response…';
    case 'noise':
      return 'Recording stopped after noise was detected. Processing your response…';
    case 'manual':
    default:
      return 'Processing your response…';
  }
}

async function submitCurrentResponse() {
  if (!state.pendingResponse) {
    ui.setStatus('Please record or upload a response before continuing.', 'warning');
    return;
  }
  try {
    await api.submitResponse(state.sessionId, state.currentIndex, state.pendingResponse.transcriptId);
    state.pendingResponse = null;
    state.currentIndex += 1;
    ui.clearTranscription();
    renderCurrentQuestion();
  } catch (error) {
    ui.setStatus(error.message || 'Failed to submit response.', 'error');
  }
}

async function handleSkipQuestion() {
  if (!state.sessionId) return;
  try {
    if (typeof audio.isRecording === 'function' && audio.isRecording()) {
      audio.stopRecording('skip');
    }
  } catch {}
  ui.setStatus('Skipping this question…', 'warning');
  try {
    await api.submitSkip(state.sessionId, state.currentIndex);
    state.pendingResponse = null;
    state.currentIndex += 1;
    ui.clearTranscription();
    stopQuestionAudio();
    renderCurrentQuestion();
  } catch (error) {
    ui.setStatus(error.message || 'Unable to skip question.', 'error');
  }
}

async function handleAudioUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  ui.setStatus('Uploading audio file…', 'info');
  try {
    const payload = await api.transcribeAudio(file, state.sessionId, state.currentIndex);
    const transcript = payload.transcript ?? payload.transcription ?? '';
    if (!transcript) {
      throw new Error('No transcription returned from the server.');
    }
    state.pendingResponse = { transcriptId: payload.transcript_id, transcript };
    ui.showTranscription(transcript);
    ui.setStatus('Uploaded response is ready. Review and submit.', 'info');
  } catch (error) {
    ui.setStatus(error.message || 'Unable to process uploaded audio.', 'error');
  } finally {
    event.target.value = '';
  }
}

function redoCurrentQuestion() {
  state.pendingResponse = null;
  ui.clearTranscription();
}

function completeInterview() {
  ui.showCompletion();
  ui.setStatus('Interview completed. You can close this window.', 'info');
  stopQuestionAudio();
  audio.dispose();
  finalizeResults();
}

function stopQuestionAudio() {
  if (state.questionAudio) {
    state.questionAudio.pause();
    state.questionAudio = null;
  }
}

async function finalizeResults() {
  if (!state.sessionId) {
    return;
  }
  try {
    await api.fetchResults(state.sessionId);
  } catch (error) {
    console.warn('Unable to finalize interview results yet:', error.message);
  }
}
