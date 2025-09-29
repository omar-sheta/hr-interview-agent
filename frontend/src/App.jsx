import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [interviewStatus, setInterviewStatus] = useState('setup'); // setup, questions_generated, questions_approved, in_progress, completed
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [ttsReady, setTtsReady] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const TTS_VOICE = "en_US-amy-medium";
  const [debugMode, setDebugMode] = useState(false);
  const [lastAudioUrl, setLastAudioUrl] = useState(null);
  const audioElementRef = useRef(null);
  const [audioEvents, setAudioEvents] = useState([]);
  const [transcriptionResult, setTranscriptionResult] = useState('');
  const [showTranscription, setShowTranscription] = useState(false);
  // Mic permission state
  const [micReady, setMicReady] = useState(false);
  const [micError, setMicError] = useState('');

  // Missing states for questions workflow and summary
  const [questionApprovals, setQuestionApprovals] = useState([]);
  const [approvedQuestions, setApprovedQuestions] = useState([]);
  const [modifyingQuestionIndex, setModifyingQuestionIndex] = useState(null);
  const [modificationRequest, setModificationRequest] = useState('');
  const [interviewSummary, setInterviewSummary] = useState(null);
  const [allResponses, setAllResponses] = useState([]);

  // Refs for audio playback and recording
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micSourceRef = useRef(null);
  const silenceStateRef = useRef({ started: false, silentMs: 0, lastTs: 0 });
  const rafRef = useRef(null);
  const bufferSourceRef = useRef(null);
  const liveStreamRef = useRef(null); // active MediaStream for cleanup
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordStartTsRef = useRef(0);
  const recordRetriesRef = useRef({}); // per-question retries

  // Ensure AudioContext resumes on first user gesture (needed for Safari/Chrome autoplay policy)
  const ensureAudioContext = async () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
    } catch (_) {
      // no-op
    }
  };

  const preloadTTSVoice = async () => {
    if (ttsReady || ttsLoading) return;
    setTtsLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/tts/health?voice_name=${encodeURIComponent(TTS_VOICE)}`);
      const data = await res.json();
      if (data && data.status === 'ok') {
        setTtsReady(true);
      } else {
        console.warn('TTS preload failed:', data);
      }
    } catch (e) {
      console.warn('TTS preload error:', e);
    } finally {
      setTtsLoading(false);
    }
  };

  // Ask for microphone permission once; stop the stream immediately after to just grant access
  const ensureMicPermission = async () => {
    setMicError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('This browser does not support microphone capture (getUserMedia). Try Chrome or the latest Safari.');
      return false;
    }

    // Check if we already have permission
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      if (permission.state === 'granted') {
        console.log('🎤 Microphone permission already granted');
        setMicReady(true);
        return true;
      } else if (permission.state === 'denied') {
        setMicError('Microphone access is permanently blocked. Please click the lock/microphone icon in your browser address bar and allow access, then refresh the page.');
        return false;
      }
    } catch (permCheckErr) {
      console.log('Permission API not available, proceeding with getUserMedia...');
    }

    try {
      console.log('🎤 Requesting microphone permission...');
      // Use the simplest constraints to maximize prompt success
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try { testStream.getTracks().forEach(t => t.stop()); } catch {}
      console.log('✅ Microphone permission granted');
      setMicReady(true);
      return true;
    } catch (err) {
      console.warn('Mic permission error:', err);
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setMicError('Microphone access was blocked. Please:\n1. Click the microphone/lock icon in your browser address bar\n2. Select "Allow" for microphone access\n3. Refresh the page\n\nOn macOS: System Settings → Privacy & Security → Microphone → enable your browser.');
      } else if (err && err.name === 'NotFoundError') {
        setMicError('No microphone input device was found. Please connect a mic or select the correct input in System Settings → Sound → Input.');
      } else if (err && err.name === 'NotReadableError') {
        setMicError('Your microphone is currently in use by another app. Close other apps that use the mic and try again.');
      } else {
        setMicError(`Unable to access the microphone: ${err.message || err.name || 'Unknown error'}. Please check browser permissions and system settings.`);
      }
      setMicReady(false);
      return false;
    }
  };

  // User-initiated unlock to satisfy autoplay policies on some browsers (esp. Safari/iOS)
  const unlockAudio = async () => {
    try {
      await ensureAudioContext();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001; // near-silent blip
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
      // small timer to log final state
      setTimeout(() => {
        console.debug('[Audio] Unlock attempted; context state:', ctx.state);
      }, 120);
    } catch (e) {
      console.warn('Unlock audio failed:', e);
    }
  };

  useEffect(() => {
    // Kick off voice preload early; safe since it's just a fetch
    preloadTTSVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateQuestions = async () => {
    setIsLoading(true);
    setLoadingMessage('Generating questions with AI...');
    // Clear any previous results and errors to avoid mixing old data with new state
    setQuestions([]);
    setQuestionApprovals([]);
    setInterviewStatus('setup');
    try {
      const response = await fetch('http://localhost:8000/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, num_questions: numQuestions }),
      });
      const data = await response.json();
      setQuestions(data.questions);
      setQuestionApprovals(new Array(data.questions.length).fill(false)); // Initialize all as not approved
      setInterviewStatus('questions_generated');
      setLoadingMessage('');
    } catch (error) {
      console.error('Error generating questions:', error);
      setLoadingMessage('Error generating questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifyQuestion = async (questionIndex) => {
    if (!modificationRequest.trim()) {
      alert('Please enter modification instructions');
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage('Modifying question with AI...');
    try {
      const response = await fetch('http://localhost:8000/api/questions/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: questions[questionIndex],
          modification_request: modificationRequest,
          job_description: jobDescription
        }),
      });
      const data = await response.json();
      
      // Update the question in the questions array
      const updatedQuestions = [...questions];
      updatedQuestions[questionIndex] = data.modified_question;
      setQuestions(updatedQuestions);
      
      // Clear modification state
      setModifyingQuestionIndex(null);
      setModificationRequest('');
      setLoadingMessage('');
    } catch (error) {
      console.error('Error modifying question:', error);
      setLoadingMessage('Error modifying question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveAllQuestions = async () => {
    // First, select all questions (same functionality as "Select All Questions" button)
    const newApprovals = new Array(questions.length).fill(true);
    setQuestionApprovals(newApprovals);
    
    // Then proceed with approving all questions
    const approvedIndices = questions.map((_, index) => index);
    
    if (approvedIndices.length === 0) {
      alert('Please approve at least one question');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Finalizing approved questions...');
    try {
      const response = await fetch('http://localhost:8000/api/questions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          questions: questions,
          approved_indices: approvedIndices,
          job_description: jobDescription
        }),
      });
      const data = await response.json();
      
      setApprovedQuestions(data.approved_questions);
      setInterviewStatus('questions_approved');
      setLoadingMessage('');
    } catch (error) {
      console.error('Error approving questions:', error);
      setLoadingMessage('Error approving questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInterview = async () => {
    // cleanup any previous audio/recording state before starting
    try { cleanupAudioAndRecording(); } catch (e) { console.warn('Pre-create cleanup failed', e); }
    setIsLoading(true);
    setLoadingMessage('Creating interview session...');
    try {
      // Try to request mic access up-front while user clicked a button (user gesture)
      try { await ensureMicPermission(); } catch {}
      const response = await fetch('http://localhost:8000/api/interviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, questions: approvedQuestions }),
      });
      const data = await response.json();
      setSessionId(data.session_id);
      setInterviewStatus('in_progress');
      const next = await handleNextQuestion(data.session_id);
      if (next) {
        // This play should be allowed as it's within a user gesture chain
        if (!ttsReady) {
          await preloadTTSVoice();
        }
        await speakQuestion(next.text, next.index);
        // Note: Recording will auto-start when TTS finishes via onended callback
      }
      setLoadingMessage('');
    } catch (error) {
      console.error('Error creating interview:', error);
      setLoadingMessage('Error creating interview. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextQuestion = async (sid) => {
    const response = await fetch(`http://localhost:8000/api/interviews/${sid || sessionId}/next`, {
      method: 'POST',
    });
    const data = await response.json();
    console.log('🔍 Backend next question response:', data);
    if (data.question) {
      // cleanup any previous audio/recording resources before switching to next question
      try { cleanupAudioAndRecording(); } catch (e) { console.warn('Cleanup before next question failed', e); }
      
      // Properly structure currentQuestion with question_index as direct property
      const structuredQuestion = {
        question: data.question, // data.question is already the question text
        question_index: data.question_index
      };
      setCurrentQuestion(structuredQuestion);
      console.log('📝 Set currentQuestion to:', structuredQuestion);
      
      // Clear previous transcription when moving to next question
      setTranscriptionResult('');
      setShowTranscription(false);
      // Return both text and index so caller can decide to play and we can thread index into recorder
      return { text: data.question, index: data.question_index };
    } else {
      // Interview completed - prepare for completion
      setCurrentQuestion(null);
      return null;
    }
  };

  const handleBatchTranscription = async () => {
    setIsLoading(true);
    setLoadingMessage('Transcribing all responses with GPU acceleration...');
    
    try {
      const response = await fetch(`http://localhost:8000/api/interviews/${sessionId}/transcribe_all`, {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.session_data) {
        setInterviewSummary(result.session_data);
        setInterviewStatus('completed');
      } else {
        throw new Error('Failed to get transcribed session data');
      }
    } catch (error) {
      console.error('Error during batch transcription:', error);
      // Fallback: fetch session without transcription
      try {
        const sessionResponse = await fetch(`http://localhost:8000/api/interviews/${sessionId}`);
        const sessionData = await sessionResponse.json();
        setInterviewSummary(sessionData);
        setInterviewStatus('completed');
      } catch (fallbackError) {
        console.error('Fallback session fetch failed:', fallbackError);
        setLoadingMessage('Error processing interview results. Please try again.');
        return;
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const stopCurrentWebAudio = () => {
    try {
      if (bufferSourceRef.current) {
        bufferSourceRef.current.onended = null;
        bufferSourceRef.current.stop(0);
      }
    } catch {}
    bufferSourceRef.current = null;
  };

  // Fully stop and cleanup any playing audio and active recordings/streams
  const cleanupAudioAndRecording = () => {
    try {
      // Stop any HTMLAudioElement
      if (currentAudio) {
        try { currentAudio.pause(); } catch {}
        try { currentAudio.src = ''; } catch {}
      }
    } catch {}

    // Stop any WebAudio buffer source
    try { stopCurrentWebAudio(); } catch {}

    // Stop RAF loop and disconnect analyser/source
    try { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } } catch {}
    try { if (micSourceRef.current) { micSourceRef.current.disconnect(); micSourceRef.current = null; } } catch {}
    try { if (analyserRef.current) { analyserRef.current.disconnect(); analyserRef.current = null; } } catch {}

    // Stop any live getUserMedia tracks
    try {
      if (liveStreamRef.current) {
        liveStreamRef.current.getTracks().forEach(t => {
          try { t.stop(); } catch {}
        });
        liveStreamRef.current = null;
      }
    } catch {}

    // Stop and clear MediaRecorder
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.ondataavailable = null; } catch {}
        try { mediaRecorderRef.current.onstop = null; } catch {}
        try { mediaRecorderRef.current.stop(); } catch {}
      }
    } catch {}
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];

    // Reset silence detection
    try { silenceStateRef.current = { started: false, silentMs: 0, lastTs: performance.now() }; } catch {}
    setIsRecording(false);
    setIsPlayingAudio(false);
    setLevel(0);
    // Revoke last audio URL if present
    try { if (lastAudioUrl) { URL.revokeObjectURL(lastAudioUrl); setLastAudioUrl(null); } } catch {}
  };

  const playWithWebAudio = async (arrayBuffer, questionIndexForThisPlayback) => {
    try {
      await ensureAudioContext();
      const ctx = audioCtxRef.current;
      const clone = arrayBuffer.slice(0);
      const decoded = await new Promise((resolve, reject) => {
        // Use callback form for broader Safari compatibility
        ctx.decodeAudioData(clone, resolve, reject);
      });
      stopCurrentWebAudio();
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      bufferSourceRef.current = src;
      setIsPlayingAudio(true);
      src.onended = () => {
        setIsPlayingAudio(false);
        bufferSourceRef.current = null;
        // Auto-start recording when question finishes playing
        setTimeout(() => {
          if (!isRecording) { // Only start if not already recording
            startRecordingFor(questionIndexForThisPlayback);
          }
        }, 500); // Small delay for better UX
      };
      src.start(0);
      console.debug('[Audio] Playing via WebAudio BufferSource');
    } catch (e) {
      console.error('WebAudio decode/play failed:', e);
      alert('Audio decode failed in this browser.');
      setIsPlayingAudio(false);
    }
  };

  const speakQuestion = async (questionText, questionIndexForThisPlayback) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      stopCurrentWebAudio();

      setIsPlayingAudio(true);
      console.log('Requesting TTS for:', questionText);
      // Proactively ensure AudioContext is resumed before network fetch
      await ensureAudioContext();
      console.debug('[Audio] Context state pre-fetch:', audioCtxRef.current?.state);
      console.debug('[Audio] Doc visibility:', document.visibilityState, 'Focused:', typeof document.hasFocus === 'function' ? document.hasFocus() : 'n/a');
      
      const response = await fetch('http://localhost:8000/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: questionText,
          voice: TTS_VOICE // Piper voice
        }),
      });
      
      console.log('TTS Response status:', response.status);
      console.debug('[Audio] Resp headers content-type:', response.headers.get('content-type'), 'len:', response.headers.get('content-length'));
      
      if (response.ok) {
        const audioBlob = await response.blob();
        console.log('Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        if (audioBlob.size > 0) {
          const audioUrl = URL.createObjectURL(audioBlob);
          setLastAudioUrl(audioUrl);
          await ensureAudioContext();
          const audio = new Audio(audioUrl);
          audio.preload = 'auto';
          audio.crossOrigin = 'anonymous';
          audio.muted = false;

          if (debugMode) {
            const events = ['loadstart','loadedmetadata','loadeddata','canplay','canplaythrough','play','playing','pause','ended','waiting','stalled','suspend','timeupdate','volumechange','error','progress'];
            events.forEach(ev => {
              audio.addEventListener(ev, () => {
                const line = `[Audio evt] ${ev} t=${audio.currentTime.toFixed(3)}`;
                // keep last ~200 lines
                setAudioEvents(prev => (prev.length > 200 ? prev.slice(-200) : prev).concat(line));
                if (ev === 'error') console.debug('[Audio] element error event fired');
              });
            });
          }
          
          audio.onended = () => {
            setIsPlayingAudio(false);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
            // Auto-start recording when question finishes playing
            setTimeout(() => {
              if (!isRecording) { // Only start if not already recording
                startRecordingFor(questionIndexForThisPlayback);
              }
            }, 500); // Small delay for better UX
          };
          
          audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            setIsPlayingAudio(false);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
            // Try WebAudio fallback for Safari decode issues
            playWithWebAudio(arrayBuffer, questionIndexForThisPlayback);
          };
          
          setCurrentAudio(audio);
          try {
            const p = audio.play();
            if (p && typeof p.then === 'function') await p;
          } catch (err) {
            console.warn('Play blocked by policy or error:', err?.name, err?.message);
            // Attempt WebAudio fallback too
            await playWithWebAudio(arrayBuffer, questionIndexForThisPlayback);
          }
        } else {
          console.error('Empty audio blob received');
          setIsPlayingAudio(false);
        }
      } else {
        const errorText = await response.text();
        console.error('TTS API error:', response.status, errorText);
        setIsPlayingAudio(false);
      }
    } catch (error) {
      console.error('Error playing question audio:', error);
      setIsPlayingAudio(false);
      setCurrentAudio(null);
    }
  };
  
  // Mic recording with silence detection (client-side)
  // Start recording explicitly for a given question index to avoid stale-state races
  const startRecordingFor = async (questionIndexForUpload) => {
    if (!sessionId || !currentQuestion) return;
    if (isRecording) return; // prevent double-start
    
    console.log(`🎙️ Starting recording for question index: ${questionIndexForUpload}`);
    
    try {
      await ensureAudioContext();
      
      // Always check mic permission before recording, regardless of micReady state
      console.log('🔍 Checking microphone permission...');
      const granted = await ensureMicPermission();
      if (!granted) {
        console.error('❌ Microphone permission denied');
        throw new Error('Microphone permission not granted');
      }
      console.log('✅ Microphone permission confirmed');

      // Try progressively simpler constraints for maximum compatibility
      const tryGetUserMedia = async () => {
        const attempts = [
          { audio: { noiseSuppression: true, echoCancellation: true }, video: false },
          { audio: { echoCancellation: true }, video: false },
          { audio: true, video: false },
        ];
        let lastErr = null;
        for (const c of attempts) {
          try {
            console.log('🎤 Attempting getUserMedia with constraints:', c);
            const stream = await navigator.mediaDevices.getUserMedia(c);
            console.log('✅ getUserMedia successful');
            return stream;
          } catch (e) {
            console.warn('❌ getUserMedia attempt failed:', e.name, e.message);
            lastErr = e;
            // If permission denied, do not continue attempts
            if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break;
          }
        }
        throw lastErr || new Error('getUserMedia failed');
      };

      const stream = await tryGetUserMedia();
      liveStreamRef.current = stream;

      // MediaRecorder for chunks - try multiple formats for maximum compatibility
      let mime = null;
      let mr = null;
      
      // Try formats in order of reliability and compatibility - MP4 first for MLX-Whisper compatibility
      const formatOptions = [
        { mime: 'audio/mp4', options: {} },
        { mime: 'audio/webm;codecs=opus', options: { audioBitsPerSecond: 128000 } },
        { mime: 'audio/webm', options: { audioBitsPerSecond: 128000 } },
        { mime: 'audio/ogg;codecs=opus', options: {} }
      ];
      
      for (const format of formatOptions) {
        if (MediaRecorder.isTypeSupported(format.mime)) {
          try {
            console.log(`[Recorder] Trying format: ${format.mime} for question ${questionIndexForUpload}`);
            mr = new MediaRecorder(stream, { mimeType: format.mime, ...format.options });
            mime = format.mime;
            console.log(`[Recorder] Successfully using: ${format.mime}`);
            break;
          } catch (e) {
            console.warn(`[Recorder] Failed to create recorder with ${format.mime}:`, e);
            // Try without options
            try {
              mr = new MediaRecorder(stream, { mimeType: format.mime });
              mime = format.mime;
              console.log(`[Recorder] Successfully using: ${format.mime} (no options)`);
              break;
            } catch (e2) {
              console.warn(`[Recorder] Failed again with ${format.mime}:`, e2);
            }
          }
        }
      }
      
      if (!mr || !mime) {
        throw new Error('No supported audio recording format found in this browser');
      }
      
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      
      // Improved chunk handling to prevent corruption
      mr.ondataavailable = e => { 
        if (e.data && e.data.size > 0) {
          console.log(`📦 Chunk received: ${e.data.size} bytes, type: ${e.data.type}`);
          audioChunksRef.current.push(e.data); 
        } else {
          console.warn('📦 Empty or invalid chunk received');
        }
      };
      
      console.log(`[Recorder] Starting for question index ${questionIndexForUpload} with mime '${mime}'`);

      mr.onstop = async () => {
        console.log(`🎤 MediaRecorder stopped for question index: ${questionIndexForUpload}`);
        
        // Wait longer for MediaRecorder to finalize all chunks, especially for WebM
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Request any remaining data
        try {
          if (mr.state === 'recording') {
            mr.requestData();
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (e) {
          console.warn('Failed to request final data:', e);
        }
        
        // Cleanup audio graph
        try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch {}
        try { if (micSourceRef.current) micSourceRef.current.disconnect(); } catch {}
        try { if (analyserRef.current) analyserRef.current.disconnect(); } catch {}
        try { if (liveStreamRef.current) { liveStreamRef.current.getTracks().forEach(t => t.stop()); liveStreamRef.current = null; } else { stream.getTracks().forEach(t => t.stop()); } } catch {}

        // Create blob with explicit type
        const blob = new Blob(audioChunksRef.current, { type: mime });
        const durMs = Math.max(0, performance.now() - (recordStartTsRef.current || performance.now()));
        
        console.log(`📊 Recording stats: duration=${durMs}ms, chunks=${audioChunksRef.current.length}, size=${blob.size}bytes, type=${blob.type}, mime=${mime}`);

        // Validate blob before proceeding
        if (!blob || blob.size < 1024) {
          console.error(`❌ Invalid or tiny blob: size=${blob?.size || 0}, chunks=${audioChunksRef.current.length}`);
        }

        // If too short or tiny, auto-retry recording up to 2 times for this question
        if (!blob || blob.size < 2048 || durMs < 700) {
          const key = String(questionIndexForUpload);
          const prev = recordRetriesRef.current[key] || 0;
          recordRetriesRef.current[key] = prev + 1;
          setShowTranscription(false);
          setTranscriptionResult('');
          setLoadingMessage('We didn\'t catch that. Please speak for a couple of seconds. Retrying...');
          if (recordRetriesRef.current[key] <= 2) {
            setTimeout(() => {
              try { cleanupAudioAndRecording(); } catch {}
              // Re-speak the question to give the user context, then record again
              speakQuestion(currentQuestion.question, questionIndexForUpload).then(() => {
                setTimeout(() => startRecordingFor(questionIndexForUpload), 500);
              });
            }, 700);
          } else {
            alert('Recording was too short. Please click Start Recording and try again.');
          }
          try { mediaRecorderRef.current = null; } catch {}
          return; // Do not upload
        }

        // Validate audio blob has proper headers (basic check)
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          
          // Check for basic container headers
          let hasValidHeader = false;
          if (mime.includes('webm')) {
            // WebM should start with EBML header
            hasValidHeader = uint8.length > 4 && uint8[0] === 0x1A && uint8[1] === 0x45 && uint8[2] === 0xDF && uint8[3] === 0xA3;
          } else if (mime.includes('mp4')) {
            // MP4 should have ftyp box early in file
            const str = new TextDecoder().decode(uint8.slice(4, 8));
            hasValidHeader = str === 'ftyp';
          } else {
            hasValidHeader = true; // Assume other formats are OK
          }
          
          if (!hasValidHeader && blob.size > 5000) {
            console.warn('⚠️ Audio blob appears to have corrupted headers, but size is reasonable - will try upload anyway');
          }
        } catch (e) {
          console.warn('⚠️ Could not validate audio blob headers:', e);
        }

        try {
          // Pass the captured question index to ensure correct upload endpoint
          await uploadRecordedBlob(blob, questionIndexForUpload);
        } catch (e) {
          console.error('Error in onstop upload:', e);
        } finally {
          // clear recorder ref
          try { mediaRecorderRef.current = null; } catch {}
        }
      };

      // Web Audio graph for level + VAD
      const ctx = audioCtxRef.current;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      micSourceRef.current = src;
      analyserRef.current = analyser;

      // Silence detection params
      silenceStateRef.current = { started: false, silentMs: 0, lastTs: performance.now() };
      const SILENCE_THRESHOLD = 0.015; // tune for mic
      const START_THRESHOLD = 0.03;
      const HANGOVER_MS = 3000;
      const data = new Float32Array(analyser.fftSize);

      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        // RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        setLevel(rms);

        const now = performance.now();
        const dt = now - (silenceStateRef.current.lastTs || now);
        silenceStateRef.current.lastTs = now;

        if (!silenceStateRef.current.started) {
          if (rms > START_THRESHOLD) {
            silenceStateRef.current.started = true;
            silenceStateRef.current.silentMs = 0;
          }
        } else {
          if (rms < SILENCE_THRESHOLD) {
            silenceStateRef.current.silentMs += dt;
          } else {
            silenceStateRef.current.silentMs = 0;
          }
          if (silenceStateRef.current.silentMs >= HANGOVER_MS) {
            stopRecording();
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      recordStartTsRef.current = performance.now();
      // Auto-stop safety after max duration (e.g., 120s)
      const MAX_MS = 120000;
      try { setTimeout(() => { try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { stopRecording(); } } catch {} }, MAX_MS); } catch {}

      mr.start(500); // Use larger intervals (500ms) for more reliable container creation
      setIsRecording(true);
      tick();
    } catch (err) {
      console.error('Mic error:', err);
      if (err?.message === 'Mic permission not granted') {
        setMicError('Please allow microphone access and try again. Click the mic icon in the address bar.');
      } else if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setMicError('Microphone access was blocked. Allow access in the browser (address bar mic icon). On macOS: System Settings → Privacy & Security → Microphone.');
      } else if (err?.name === 'NotFoundError') {
        setMicError('No microphone device found. Connect a mic or choose the correct input in System Settings → Sound → Input.');
      } else if (err?.name === 'NotReadableError') {
        setMicError('Your mic is in use by another app. Close other apps that might be recording audio and try again.');
      } else {
        setMicError('Microphone access denied or unavailable.');
      }
      alert('Microphone access denied or unavailable. Please allow mic access (browser address bar) or check System Settings.');
    }
  };

  const startRecording = async () => {
    if (!currentQuestion) return;
    return startRecordingFor(currentQuestion.question_index);
  };

  const stopRecording = () => {
    setIsRecording(false);
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        // Request final data and give it time to arrive before stopping
        try { 
          mediaRecorderRef.current.requestData && mediaRecorderRef.current.requestData(); 
          // Small delay to ensure final chunk is processed
          setTimeout(() => {
            try { mediaRecorderRef.current.stop(); } catch {}
          }, 100);
        } catch {}
      }
    } catch {}
  };

  const uploadRecordedBlob = async (blob, questionIndex) => {
    if (!sessionId || questionIndex === undefined) {
      console.error("Cannot upload without session ID and question index.", { sessionId, questionIndex });
      return;
    }
    if (!blob || blob.size < 1024) {
      alert('Your recording seems too short or empty. Please try again and speak for a few seconds.');
      return;
    }
    
    // Additional validation: try to read the blob to ensure it's not corrupted
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        alert('Recording appears to be empty. Please try again.');
        return;
      }
    } catch (e) {
      console.warn('Blob validation warning:', e);
      alert('Recording may be corrupted. Please try again if transcription fails.');
    }
    
    setIsLoading(true);
    setLoadingMessage('Uploading your response...');
    try {
  // Name with extension matching the blob mime to help server normalization
  const ext = (blob.type && blob.type.includes('mp4')) ? 'mp4' : 'webm';
  const file = new File([blob], `response.${ext}`, { type: blob.type || (ext === 'mp4' ? 'audio/mp4' : 'audio/webm') });
      const formData = new FormData();
      formData.append('audio_response', file);

      console.log('🎯 Uploading to question index:', questionIndex);
      const response = await fetch(`http://localhost:8000/api/interviews/${sessionId}/submit_response/${questionIndex}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const result = await response.json();
      
      // Show confirmation that audio was saved
      setTranscriptionResult('Audio saved - transcription will happen at the end of the interview');
      setShowTranscription(true);
      
      // Next question
      const next = await handleNextQuestion(sessionId);
      if (next) {
        // Auto-play the next question (recording will auto-start when TTS finishes)
        setTimeout(() => speakQuestion(next.text, next.index), 1000);
      } else {
        // Interview completed - start batch transcription
        await handleBatchTranscription();
      }
    } catch (e) {
      console.error('Upload failed:', e);
      alert('Upload failed. Try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // A simple placeholder for recording and uploading audio
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !sessionId || currentQuestion === null) return;

    setIsLoading(true);
    setLoadingMessage('Uploading your response...');

    try {
      const formData = new FormData();
      formData.append('audio_response', file);

      const response = await fetch(`http://localhost:8000/api/interviews/${sessionId}/submit_response/${currentQuestion.question_index}`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      // Show confirmation that audio was saved
      setTranscriptionResult('Audio saved - transcription will happen at the end of the interview');
      setShowTranscription(true);
      
      // Fetch the next question automatically after submission
      const next = await handleNextQuestion(sessionId);
      if (next) {
        // Auto-play the next question (recording will auto-start when TTS finishes)
        setTimeout(() => speakQuestion(next.text, next.index), 1000);
      } else {
        // Interview completed - start batch transcription
        await handleBatchTranscription();
      }
    } catch (error) {
      console.error('Error uploading audio:', error);
      setLoadingMessage('Error uploading audio. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white p-6 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left Logo */}
          <div className="flex items-center">
            <div className="bg-white rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <img 
                src="/images/HIVE-logo-4-color.png" 
                alt="HIVE Logo" 
                className="h-28 md:h-36 w-auto object-contain"
              />
            </div>
          </div>
          
          {/* Center Title */}
          <div className="text-center flex-1 mx-8">
            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-200 to-white bg-clip-text text-transparent">
              HR Interview Agent
            </h1>
            <p className="text-blue-200 text-sm md:text-base mt-2 font-medium">
              🚀 AI-Powered Interview Assistant with GPU Acceleration
            </p>
            <div className="flex justify-center items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-300">Live & Ready</span>
            </div>
          </div>
          
          {/* Right Logo */}
          <div className="flex items-center">
            <div className="bg-white rounded-2xl p-4 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <img 
                src="/images/GEA Logo_1.jpg" 
                alt="GE Appliances Logo" 
                className="h-28 md:h-36 w-56 object-contain"
              />
            </div>
          </div>
        </div>
      </header>
      <main className="p-8">
        {interviewStatus === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Setup Interview</h2>
            {/* Mic preflight */}
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded ${micReady ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                {micReady ? 'Mic ready' : 'Mic access needed'}
              </span>
              <button onClick={ensureMicPermission} className="px-2 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200">Test microphone access</button>
              <button onClick={async () => {
                try {
                  console.log('🧪 Testing direct getUserMedia...');
                  const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                  console.log('✅ Direct getUserMedia works!', testStream);
                  testStream.getTracks().forEach(t => t.stop());
                  alert('✅ Microphone access is working!');
                } catch (e) {
                  console.error('❌ Direct getUserMedia failed:', e);
                  alert(`❌ Microphone test failed: ${e.name} - ${e.message}`);
                }
              }} className="px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Direct test</button>
            </div>
            {micError && (
              <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
                {micError}
              </div>
            )}
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className={`inline-flex items-center px-2 py-1 rounded ${ttsReady ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                {ttsReady ? 'Voice ready' : (ttsLoading ? 'Loading voice…' : 'Voice will preload')}
              </span>
              {!ttsReady && !ttsLoading && (
                <button onClick={preloadTTSVoice} className="px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">Preload now</button>
              )}
            </div>
            <textarea
              className="w-full p-2 border rounded mb-4"
              rows="10"
              placeholder="Paste job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            ></textarea>
            <div className="flex items-center mb-4">
              <label className="mr-2">Number of Questions:</label>
              <input
                type="number"
                className="p-2 border rounded w-24"
                value={numQuestions || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setNumQuestions(5); // Reset to default
                  } else {
                    const n = parseInt(v, 10);
                    if (Number.isFinite(n) && n > 0) setNumQuestions(n);
                  }
                }}
              />
            </div>
            <button
              className={`group relative py-4 px-8 rounded-xl font-bold shadow-lg transform transition-all duration-200 ${
                isLoading || !jobDescription.trim()
                  ? 'bg-gray-400 cursor-not-allowed text-gray-700 shadow-none'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white hover:shadow-purple-500/25 hover:scale-105'
              }`}
              onClick={handleGenerateQuestions}
              disabled={isLoading || !jobDescription.trim()}
            >
              <span className="flex items-center gap-3">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    Generate Questions
                  </>
                )}
              </span>
              {!isLoading && jobDescription.trim() && (
                <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
              )}
            </button>
            {isLoading && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-blue-800">{loadingMessage}</p>
                </div>
              </div>
            )}
            {loadingMessage && !isLoading && questions.length === 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800">{loadingMessage}</p>
              </div>
            )}
            {questions.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-lg mb-3">Generated Questions:</h3>
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <div key={i} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-400">
                      <span className="text-sm font-medium text-blue-600">Question {i + 1}</span>
                      <p className="text-gray-800 mt-1">{q}</p>
                    </div>
                  ))}
                </div>
                <button
                  className={`py-2 px-4 rounded font-bold mt-4 ${
                    isLoading
                      ? 'bg-gray-400 cursor-not-allowed text-gray-700'
                      : 'bg-green-500 hover:bg-green-700 text-white'
                  }`}
                  onClick={() => setInterviewStatus('questions_generated')}
                  disabled={isLoading}
                >
                  Review & Approve Questions
                </button>
              </div>
            )}
          </div>
        )}

        {interviewStatus === 'questions_generated' && (
          <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">Review & Approve Questions</h2>
              <p className="text-gray-600">Please review each question and approve the ones you want to use in the interview. You can also modify questions using AI assistance.</p>
            </div>
            
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={questionApprovals[i] || false}
                      onChange={(e) => {
                        const newApprovals = [...questionApprovals];
                        newApprovals[i] = e.target.checked;
                        setQuestionApprovals(newApprovals);
                      }}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-blue-600">Question {i + 1}</span>
                        {questionApprovals[i] && (
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                            ✓ Approved
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 mb-3">{q}</p>
                      
                      {modifyingQuestionIndex === i ? (
                        <div className="bg-blue-50 p-3 rounded border">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            How would you like to modify this question?
                          </label>
                          <textarea
                            value={modificationRequest}
                            onChange={(e) => setModificationRequest(e.target.value)}
                            placeholder="e.g., Make it more specific to backend development, focus on leadership skills, make it less technical..."
                            className="w-full p-2 border rounded mb-3"
                            rows="3"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleModifyQuestion(i)}
                              disabled={isLoading || !modificationRequest.trim()}
                              className={`px-3 py-1 rounded text-sm font-medium ${
                                isLoading || !modificationRequest.trim()
                                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                  : 'bg-blue-500 hover:bg-blue-600 text-white'
                              }`}
                            >
                              {isLoading ? 'Modifying...' : 'Apply Changes'}
                            </button>
                            <button
                              onClick={() => {
                                setModifyingQuestionIndex(null);
                                setModificationRequest('');
                              }}
                              className="px-3 py-1 rounded text-sm font-medium bg-gray-300 hover:bg-gray-400 text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setModifyingQuestionIndex(i)}
                          disabled={isLoading}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          ✏️ Modify with AI
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isLoading && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-blue-800">{loadingMessage}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 font-medium">
                  {questionApprovals.filter(Boolean).length} of {questions.length} questions approved
                </div>
                {questionApprovals.filter(Boolean).length === questions.length && questions.length > 0 && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 text-sm font-bold px-4 py-2 rounded-full border border-emerald-200 shadow-sm">
                    <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Perfect! All questions approved</span>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    // Check all questions
                    const newApprovals = new Array(questions.length).fill(true);
                    setQuestionApprovals(newApprovals);
                  }}
                  disabled={isLoading}
                  className="group relative px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/25 transform hover:scale-105 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Select All Questions
                  </span>
                  <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                </button>
                
                <button
                  onClick={() => {
                    // Uncheck all questions
                    const newApprovals = new Array(questions.length).fill(false);
                    setQuestionApprovals(newApprovals);
                  }}
                  disabled={isLoading}
                  className="group relative px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-red-500/25 transform hover:scale-105 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Clear All
                  </span>
                  <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                </button>
                
                <button
                  onClick={() => setInterviewStatus('setup')}
                  className="group relative px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-gray-500/25 transform hover:scale-105 transition-all duration-200"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back to Setup
                  </span>
                  <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                </button>
                <button
                  onClick={handleApproveAllQuestions}
                  disabled={isLoading || questionApprovals.filter(Boolean).length === 0}
                  className={`group relative px-8 py-4 font-bold rounded-xl shadow-lg transform transition-all duration-200 ${
                    isLoading || questionApprovals.filter(Boolean).length === 0
                      ? 'bg-gray-400 cursor-not-allowed text-gray-700 shadow-none'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white hover:shadow-blue-500/25 hover:scale-105'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Approve & Start Interview
                      </>
                    )}
                  </span>
                  {!isLoading && questionApprovals.filter(Boolean).length > 0 && (
                    <div className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-200"></div>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {interviewStatus === 'questions_approved' && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-green-600 mb-2">Questions Approved!</h2>
              <p className="text-gray-600">You have approved {approvedQuestions.length} questions for the interview.</p>
            </div>
            
            <div className="space-y-3 mb-6">
              {approvedQuestions.map((q, i) => (
                <div key={i} className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                  <span className="text-sm font-medium text-green-600">Question {i + 1}</span>
                  <p className="text-gray-800 mt-1">{q}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              <button
                className={`py-3 px-6 rounded-lg font-bold text-lg ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed text-gray-700'
                    : 'bg-blue-500 hover:bg-blue-700 text-white'
                }`}
                onClick={handleCreateInterview}
                disabled={isLoading}
              >
                {isLoading ? 'Creating Interview...' : 'Start Interview'}
              </button>
            </div>
          </div>
        )}

        {interviewStatus === 'in_progress' && currentQuestion && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            {/* Mic troubleshooting banner */}
            {(!micReady || micError) && (
              <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-yellow-800">
                    {micError || 'Please grant microphone access before recording.'}
                  </div>
                  <button onClick={ensureMicPermission} className="px-3 py-1 rounded bg-yellow-200 hover:bg-yellow-300 text-yellow-900 text-sm font-medium">Grant Access</button>
                </div>
                <div className="text-xs text-yellow-700 mt-2">
                  Tip (macOS): System Settings → Privacy & Security → Microphone → enable your browser. In the browser, click the mic icon in the address bar and choose Allow.
                </div>
              </div>
            )}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Question {currentQuestion.question_index + 1}
              </h2>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((currentQuestion.question_index + 1) / (questions.length || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-lg border border-gray-200">
              <p className="text-2xl font-semibold text-gray-800 mb-6 text-center">{currentQuestion.question}</p>
              <div className="flex justify-center items-center space-x-4 mb-6">
                <button
                  onClick={() => speakQuestion(currentQuestion.question, currentQuestion.question_index)}
                  disabled={isRecording || isPlayingAudio}
                  className={`px-4 py-2 rounded-full font-semibold text-white transition-colors flex items-center gap-2 ${
                    isPlayingAudio ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isPlayingAudio ? (
                    <>
                      <div className="animate-pulse w-4 h-4 bg-white rounded-full"></div>
                      <span>Playing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.797-3.793a1 1 0 011.617.793zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Play Question</span>
                    </>
                  )}
                </button>
                <button onClick={unlockAudio} className="px-4 py-3 rounded-full font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800">Unlock Audio</button>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} /> Debug
                </label>
              </div>

              {debugMode && (
                <div className="mb-6 p-3 rounded bg-gray-50 border">
                  <div className="text-xs text-gray-600 mb-2">Debug Player</div>
                  {lastAudioUrl && (
                    <audio ref={audioElementRef} src={lastAudioUrl} controls style={{ width: '100%' }} />
                  )}
                  <div className="mt-2 max-h-40 overflow-auto text-xs font-mono text-gray-700 bg-white p-2 border rounded">
                    {audioEvents.slice(-40).map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcription Result Display */}
              {showTranscription && transcriptionResult && (
                <div className="mb-6 p-4 rounded bg-green-50 border border-green-200">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-green-800 mb-1">Your Response (Transcribed):</h4>
                      <p className="text-green-700 italic">"{transcriptionResult}"</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-6">
                {/* Inline recording error/help */}
                {micError && (
                  <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
                    {micError}
                  </div>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">Mic level</span>
                  <div className="w-40 h-2 bg-gray-200 rounded">
                    <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.min(100, Math.round(level * 300))}%` }}></div>
                  </div>
                </div>
                <div className="flex gap-3 mb-4">
                  {!isRecording ? (
                    <button onClick={startRecording} disabled={!micReady} className={`px-4 py-2 rounded text-white font-semibold ${!micReady ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}>Start Recording</button>
                  ) : (
                    <button onClick={stopRecording} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold">Stop</button>
                  )}
                  {/* Optional Skip Question: explicitly move on without recording */}
                  {!isRecording && (
                    <button
                      onClick={async () => {
                        // Move on without recording: fetch next question and play it
                        const next = await handleNextQuestion(sessionId);
                        if (next) setTimeout(() => speakQuestion(next.text, next.index), 600);
                        else await handleBatchTranscription();
                      }}
                      className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold"
                    >
                      Skip Question
                    </button>
                  )}
                </div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload your response (audio file):
                </label>
                <input 
                  type="file" 
                  accept="audio/*,.m4a,.wav,.mp3,.mp4,.webm" 
                  onChange={handleAudioUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Accepted formats: MP3, WAV, M4A, etc.
                </p>
              </div>
            </div>
          </div>
        )}

        {interviewStatus === 'completed' && (
          <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-green-600 mb-2">Interview Completed!</h2>
              <p className="text-gray-600">Thank you for completing the interview. Here's a summary of your responses:</p>
            </div>

            {/* Interview Summary */}
            {interviewSummary && (
              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Interview Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Total Questions:</span>
                      <span className="ml-2 text-gray-800">{interviewSummary.questions.length}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Status:</span>
                      <span className="ml-2 text-green-600 font-medium">Completed</span>
                    </div>
                  </div>
                </div>

                {/* Overall Interview Score */}
                {interviewSummary.overall_score && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      🏆 Overall Interview Performance
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-3xl font-bold text-blue-600">{interviewSummary.overall_score.overall_score?.toFixed(1) || 'N/A'}</div>
                        <div className="text-sm text-gray-600">Final Score</div>
                        <div className="text-xs text-gray-500">out of 10</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-green-600">{interviewSummary.overall_score.average_linguistic?.toFixed(1) || 'N/A'}</div>
                        <div className="text-sm text-gray-600">Linguistic</div>
                        <div className="text-xs text-gray-500">Communication</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-purple-600">{interviewSummary.overall_score.average_behavioral?.toFixed(1) || 'N/A'}</div>
                        <div className="text-sm text-gray-600">Behavioral</div>
                        <div className="text-xs text-gray-500">Professionalism</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="text-2xl font-bold text-gray-600">{interviewSummary.overall_score.questions_scored || 0}</div>
                        <div className="text-sm text-gray-600">Evaluated</div>
                        <div className="text-xs text-gray-500">of {interviewSummary.overall_score.total_questions || 0} questions</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Manual Scoring Button */}
                {interviewSummary && interviewSummary.questions && interviewSummary.questions.some(q => q.transcript && !q.score) && (
                  <div className="mb-6 text-center">
                    <button
                      onClick={async () => {
                        try {
                          setIsLoading(true);
                          setLoadingMessage('🤖 Scoring responses with AI evaluation...');
                          
                          // Create request with timeout
                          const controller = new AbortController();
                          const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes
                          
                          const response = await fetch(`http://localhost:8000/api/interviews/${interviewSummary.id}/score_all`, {
                            method: 'POST',
                            signal: controller.signal,
                          });
                          
                          clearTimeout(timeoutId);
                          
                          if (response.ok) {
                            const result = await response.json();
                            setInterviewSummary(result.session_data);
                            setLoadingMessage('✅ AI evaluation completed!');
                            setTimeout(() => setIsLoading(false), 1000);
                          } else {
                            throw new Error('Scoring failed');
                          }
                        } catch (error) {
                          console.error('Scoring error:', error);
                          setLoadingMessage('❌ Scoring failed. Please try again.');
                          setTimeout(() => setIsLoading(false), 2000);
                        }
                      }}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors"
                    >
                      🤖 Generate AI Evaluation Scores
                    </button>
                    <p className="text-sm text-gray-600 mt-2">Click to score your responses using Gemma AI model</p>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Questions & Responses</h3>
                  <div className="space-y-6">
                    {interviewSummary.questions.map((item, index) => {
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-5">
                          <div className="mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                                Question {index + 1}
                              </span>
                              {item.transcript && (
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                                  ✓ Answered
                                </span>
                              )}
                              {item.transcription_method && (
                                <span className={`text-xs font-medium px-2 py-1 rounded ${
                                  item.transcription_method === 'mlx-whisper-gpu' 
                                    ? 'bg-purple-100 text-purple-800' 
                                    : item.transcription_method === 'whisper-fallback'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.transcription_method === 'mlx-whisper-gpu' ? '🚀 GPU' : 
                                   item.transcription_method === 'whisper-fallback' ? '⚠️ Fallback' : '❌ Failed'}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-800 font-medium text-lg leading-relaxed">
                              {item.question}
                            </p>
                          </div>
                          
                          {item.transcript && (
                            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                              <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                  <path fillRule="evenodd" d="M7 4a3 3 0 001.745-.723 3.066 3.066 0 013.976 0A3.066 3.066 0 0016 4a3.066 3.066 0 00.723 1.745A3.066 3.066 0 0018 8a3.066 3.066 0 00-.723 1.745A3.066 3.066 0 0016 12a3.066 3.066 0 00-1.745.723A3.066 3.066 0 0012 14a3.066 3.066 0 00-1.745-.723A3.066 3.066 0 009 12a3.066 3.066 0 00-.723-1.745A3.066 3.066 0 007 8a3.066 3.066 0 00.723-1.745A3.066 3.066 0 007 4z" clipRule="evenodd" />
                                </svg>
                                Your Response:
                              </h4>
                              <p className="text-green-700 italic leading-relaxed mb-3">"{item.transcript}"</p>
                              
                              {/* Score Display */}
                              {item.score && !item.score.error && (
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                                    📊 AI Evaluation Score
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-blue-600">{item.score.final_score?.toFixed(1) || 'N/A'}</div>
                                      <div className="text-xs text-blue-700">Overall Score</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-blue-600">{item.score.linguistic_score?.toFixed(1) || 'N/A'}</div>
                                      <div className="text-xs text-blue-700">Linguistic</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-semibold text-blue-600">{item.score.behavioral_score?.toFixed(1) || 'N/A'}</div>
                                      <div className="text-xs text-blue-700">Behavioral</div>
                                    </div>
                                  </div>
                                  {item.score.summary && (
                                    <div className="mt-2 text-xs text-blue-700 italic">
                                      "{item.score.summary}"
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {item.audio_file && (
                                <div className="mt-3">
                                  <label className="text-xs font-medium text-green-700 mb-1 block">Listen to your recording:</label>
                                  <audio 
                                    controls 
                                    className="w-full max-w-md h-8"
                                    preload="none"
                                  >
                                    <source src={`http://localhost:8000/api/interviews/${interviewSummary.id}/audio/${item.audio_file}`} />
                                    Your browser does not support the audio element.
                                  </audio>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {!item.transcript ? (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                              <p className="text-yellow-700 text-sm">No response recorded for this question.</p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4 pt-6 border-t">
                  <button 
                    onClick={() => {
                      // Fully cleanup any active audio/recording resources before resetting UI
                      try { cleanupAudioAndRecording(); } catch (e) { console.warn('Cleanup failed', e); }
                      setInterviewStatus('setup');
                      setSessionId(null);
                      setCurrentQuestion(null);
                      setQuestions([]);
                      setApprovedQuestions([]);
                      setQuestionApprovals([]);
                      setAllResponses([]);
                      setInterviewSummary(null);
                      setJobDescription('');
                      setModifyingQuestionIndex(null);
                      setModificationRequest('');
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Start New Interview
                  </button>
                  <button 
                    onClick={() => {
                      const summaryText = interviewSummary.questions.map((item, i) => {
                        return `Question ${i + 1}: ${item.question}\nResponse: ${item.transcript || 'No response'}\n${item.transcription_method ? `Transcription Method: ${item.transcription_method}\n` : ''}`;
                      }).join('\n');
                      
                      const blob = new Blob([summaryText], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `interview-summary-${new Date().toISOString().split('T')[0]}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Download Summary
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;