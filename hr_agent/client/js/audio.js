const MEDIA_PREFERENCES = [
  { type: 'audio/webm;codecs=opus', extension: 'webm' },
  { type: 'audio/webm', extension: 'webm' },
  { type: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { type: 'audio/ogg', extension: 'ogg' },
  { type: 'audio/mp4;codecs=mp4a.40.2', extension: 'm4a' },
  { type: 'audio/mpeg', extension: 'mp3' },
];

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 5000;
const NOISE_RMS_THRESHOLD = 0.3;
const NOISE_ZCR_THRESHOLD = 0.5;
const NOISE_DURATION_MS = 5000;

export function createAudioController({ ui, onRecordingComplete }) {
  const state = {
    supported: typeof window.MediaRecorder !== 'undefined',
    stream: null,
    recorder: null,
    chunks: [],
    recordingExtension: 'webm',
    audioContext: null,
    analyser: null,
    processor: null,
    speakingSince: null,
    silenceSince: null,
    noiseSince: null,
    isRecording: false,
    autoStopReason: null,
  };

  async function ensureMicPermission() {
    if (state.stream && state.stream.getTracks().some((track) => track.readyState === 'live')) {
      return state.stream;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    attachAnalyser(state.stream);
    return state.stream;
  }

  function attachAnalyser(stream) {
    teardownAnalyser();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioContext = state.audioContext || new AudioCtx();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.processor = state.audioContext.createScriptProcessor(2048, 1, 1);
    state.processor.onaudioprocess = (event) => {
      const data = event.inputBuffer.getChannelData(0);
      const rms = calculateRMS(data);
      const zcr = calculateZeroCrossingRate(data);
      ui.updateMicLevel(rms * 2);
      evaluateAutoStop(rms, zcr);
    };
    source.connect(state.processor);
    state.processor.connect(state.audioContext.destination);
    state.analyser = source;
  }

  function teardownAnalyser() {
    if (state.processor) {
      state.processor.disconnect();
      state.processor.onaudioprocess = null;
      state.processor = null;
    }
    state.analyser = null;
  }

  function calculateRMS(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / samples.length);
  }

  function calculateZeroCrossingRate(samples) {
    let crossings = 0;
    for (let i = 1; i < samples.length; i += 1) {
      if ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0)) {
        crossings += 1;
      }
    }
    return crossings / samples.length;
  }

  function evaluateAutoStop(rms, zcr) {
    if (!state.isRecording) return;
    const now = performance.now();

    if (rms > SILENCE_THRESHOLD) {
      state.speakingSince = state.speakingSince || now;
      state.silenceSince = null;
    } else if (state.speakingSince) {
      state.silenceSince = state.silenceSince || now;
      if (now - state.silenceSince > SILENCE_DURATION_MS) {
        stopRecording('silence');
      }
    }

    if (zcr > NOISE_ZCR_THRESHOLD && rms > NOISE_RMS_THRESHOLD) {
      state.noiseSince = state.noiseSince || now;
      if (now - state.noiseSince > NOISE_DURATION_MS) {
        stopRecording('noise');
      }
    } else {
      state.noiseSince = null;
    }
  }

  function pickSupportedMime() {
    if (!state.supported) return null;
    for (const preference of MEDIA_PREFERENCES) {
      if (MediaRecorder.isTypeSupported?.(preference.type)) {
        state.recordingExtension = preference.extension;
        return preference.type;
      }
    }
    state.recordingExtension = 'webm';
    return undefined;
  }

  async function startRecording() {
    if (!state.supported) {
      throw new Error('Live recording is not supported in this browser.');
    }
    const stream = await ensureMicPermission();
    attachAnalyser(stream);

    if (state.audioContext?.state === 'suspended') {
      await state.audioContext.resume();
    }

    state.chunks = [];
    state.autoStopReason = null;
    state.speakingSince = null;
    state.silenceSince = null;
    state.noiseSince = null;

    const mimeType = pickSupportedMime();
    state.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    state.recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) {
        state.chunks.push(event.data);
      }
    };
    state.recorder.onstop = () => {
      state.isRecording = false;
      teardownAnalyser();
      const blob = new Blob(state.chunks, { type: state.recorder?.mimeType || 'audio/webm' });
      state.chunks = [];
      if (blob.size > 0 && typeof onRecordingComplete === 'function') {
        const extension = state.recordingExtension;
        blob.name = `recording.${extension}`;
        onRecordingComplete(blob, { reason: state.autoStopReason, extension });
      }
      state.autoStopReason = null;
      ui.setRecordingState('processing');
    };
    state.recorder.start();
    state.isRecording = true;
    ui.setRecordingState('recording');
  }

  function stopRecording(reason = 'manual') {
    if (!state.recorder || state.recorder.state === 'inactive') {
      return;
    }
    state.autoStopReason = reason;
    state.recorder.stop();
  }

  function dispose() {
    if (state.recorder && state.recorder.state !== 'inactive') {
      state.recorder.stop();
    }
    teardownAnalyser();
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }
    if (state.audioContext) {
      state.audioContext.close();
      state.audioContext = null;
    }
  }

  return {
    supported: state.supported,
    ensureMicPermission,
    startRecording,
    stopRecording,
    dispose,
    isRecording: () => state.isRecording,
  };
}
