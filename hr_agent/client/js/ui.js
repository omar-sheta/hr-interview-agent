const STATUS_CLASSES = ['info', 'warning', 'error'];

export function createUI() {
  const elements = {
    candidate: document.getElementById('candidate-label'),
    interview: document.getElementById('interview-label'),
    description: document.getElementById('session-description'),
    statusBanner: document.getElementById('status-banner'),
    statusMessage: document.getElementById('status-message'),
    questionCount: document.getElementById('question-count'),
    questionText: document.getElementById('question-text'),
    recordingIndicator: document.getElementById('recording-indicator'),
    transcriptionBox: document.getElementById('transcription-box'),
    transcriptionText: document.getElementById('transcription-text'),
    micLevel: document.getElementById('mic-level'),
    completionPanel: document.getElementById('completion-panel'),
    questionPanel: document.getElementById('question-panel'),
    playButton: document.getElementById('play-question-btn'),
    startButton: document.getElementById('start-recording-btn'),
    stopButton: document.getElementById('stop-recording-btn'),
    redoButton: document.getElementById('redo-question-btn'),
    skipButton: document.getElementById('skip-question-btn'),
    nextButton: document.getElementById('next-question-btn'),
    uploadInput: document.getElementById('audio-upload'),
  };

  lockControls();

  function lockControls() {
    [elements.playButton, elements.startButton, elements.stopButton, elements.redoButton,
      elements.skipButton, elements.nextButton].forEach((btn) => {
      if (btn) btn.disabled = true;
    });
    if (elements.uploadInput) {
      elements.uploadInput.disabled = true;
    }
  }

  function enableInteractiveControls() {
    [elements.playButton, elements.startButton, elements.skipButton].forEach((btn) => {
      if (btn) btn.disabled = false;
    });
    if (elements.uploadInput) {
      elements.uploadInput.disabled = false;
    }
  }

  function setStatus(message, tone = 'info') {
    if (elements.statusMessage) {
      elements.statusMessage.textContent = message;
    }
    if (elements.statusBanner) {
      STATUS_CLASSES.forEach((cls) => elements.statusBanner.classList.remove(cls));
      elements.statusBanner.classList.add(tone);
    }
  }

  function setSessionDetails({ candidate, interview, description }) {
    if (candidate && elements.candidate) {
      elements.candidate.textContent = `Candidate: ${candidate}`;
    }
    if (interview && elements.interview) {
      elements.interview.textContent = `Interview: ${interview}`;
    }
    if (description && elements.description) {
      elements.description.textContent = description;
    }
  }

  function renderQuestion(question, index, total) {
    if (elements.questionCount) {
      elements.questionCount.textContent = `Question ${index + 1} / ${total}`;
    }
    if (elements.questionText) {
      elements.questionText.textContent = question;
    }
    clearTranscription();
    setPendingState(false);
    elements.startButton.disabled = false;
    elements.playButton.disabled = false;
  }

  function setRecordingState(state) {
    if (!elements.recordingIndicator) return;
    if (state === 'recording') {
      elements.recordingIndicator.textContent = 'Recording in progress…';
      elements.startButton.disabled = true;
      elements.stopButton.disabled = false;
      elements.redoButton.disabled = true;
      elements.nextButton.disabled = true;
    } else if (state === 'processing') {
      elements.recordingIndicator.textContent = 'Processing response…';
      elements.startButton.disabled = true;
      elements.stopButton.disabled = true;
    } else {
      elements.recordingIndicator.textContent = 'Recorder idle';
      elements.startButton.disabled = false;
      elements.stopButton.disabled = true;
    }
  }

  function showTranscription(text) {
    if (elements.transcriptionText) {
      elements.transcriptionText.textContent = text;
    }
    setPendingState(true);
  }

  function clearTranscription() {
    if (elements.transcriptionText) {
      elements.transcriptionText.textContent = 'Transcription will appear here once your answer is processed.';
    }
    setPendingState(false);
  }

  function setPendingState(hasPending) {
    if (elements.nextButton) {
      elements.nextButton.disabled = !hasPending;
    }
    if (elements.redoButton) {
      elements.redoButton.disabled = !hasPending;
    }
  }

  function updateMicLevel(level) {
    if (!elements.micLevel) return;
    const clamped = Math.max(0, Math.min(1, level));
    elements.micLevel.style.width = `${clamped * 100}%`;
  }

  function showCompletion() {
    if (elements.completionPanel) {
      elements.completionPanel.classList.remove('hidden');
    }
    if (elements.questionPanel) {
      elements.questionPanel.classList.add('hidden');
    }
    lockControls();
  }

  return {
    lockControls,
    enableInteractiveControls,
    setStatus,
    setSessionDetails,
    renderQuestion,
    setRecordingState,
    showTranscription,
    clearTranscription,
    setPendingState,
    updateMicLevel,
    showCompletion,
  };
}
