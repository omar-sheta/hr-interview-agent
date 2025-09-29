import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [jobDescription, setJobDescription] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [interviewStatus, setInterviewStatus] = useState('setup'); // setup, in_progress, completed
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isRecording, setIsRecording                        {item.response && (
                          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                            <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                              </svg>
                              Your Response:
                            </h4>
                            <p className="text-green-700 italic leading-relaxed mb-3">"{item.response}"</p>
                            {item.audio_url && (
                              <div className="mt-3">
                                <label className="text-xs font-medium text-green-700 mb-1 block">Listen to your recording:</label>
                                <audio 
                                  controls 
                                  className="w-full max-w-md h-8"
                                  preload="none"
                                >
                                  <source src={`http://localhost:8000${item.audio_url}`} type="audio/webm" />
                                  <source src={`http://localhost:8000${item.audio_url}`} type="audio/mp4" />
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                            )}
                          </div>
                        )}e(false);
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
  const [allResponses, setAllResponses] = useState([]); // Store all Q&A pairs
  const [interviewSummary, setInterviewSummary] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micSourceRef = useRef(null);
  const silenceStateRef = useRef({ started: false, silentMs: 0, lastTs: 0 });
  const rafRef = useRef(null);
  const bufferSourceRef = useRef(null);

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
    try {
      const response = await fetch('http://localhost:8000/api/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, num_questions: numQuestions }),
      });
      const data = await response.json();
      setQuestions(data.questions);
      setLoadingMessage('');
    } catch (error) {
      console.error('Error generating questions:', error);
      setLoadingMessage('Error generating questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateInterview = async () => {
    setIsLoading(true);
    setLoadingMessage('Creating interview session...');
    try {
      const response = await fetch('http://localhost:8000/api/interviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription, questions }),
      });
      const data = await response.json();
      setSessionId(data.session_id);
      setInterviewStatus('in_progress');
      const qText = await handleNextQuestion(data.session_id);
      if (qText) {
        // This play should be allowed as it's within a user gesture chain
        if (!ttsReady) {
          await preloadTTSVoice();
        }
        await speakQuestion(qText);
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
    if (data.question) {
      setCurrentQuestion(data);
      // Clear previous transcription when moving to next question
      setTranscriptionResult('');
      setShowTranscription(false);
      // Return text so caller can decide to play (ideally after a click)
      return data.question.question;
    } else {
      // Interview completed - fetch the full session for summary
      const sessionResponse = await fetch(`http://localhost:8000/api/interviews/${sid || sessionId}`);
      const sessionData = await sessionResponse.json();
      setInterviewSummary(sessionData);
      setInterviewStatus('completed');
      setCurrentQuestion(null);
      return null;
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

  const playWithWebAudio = async (arrayBuffer) => {
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
            startRecording();
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

  const speakQuestion = async (questionText) => {
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
                startRecording();
              }
            }, 500); // Small delay for better UX
          };
          
          audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            setIsPlayingAudio(false);
            setCurrentAudio(null);
            URL.revokeObjectURL(audioUrl);
            // Try WebAudio fallback for Safari decode issues
            playWithWebAudio(arrayBuffer);
          };
          
          setCurrentAudio(audio);
          try {
            const p = audio.play();
            if (p && typeof p.then === 'function') await p;
          } catch (err) {
            console.warn('Play blocked by policy or error:', err?.name, err?.message);
            // Attempt WebAudio fallback too
            await playWithWebAudio(arrayBuffer);
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
  const startRecording = async () => {
    if (!sessionId || !currentQuestion) return;
    try {
      await ensureAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: true, echoCancellation: true }, video: false });

      // MediaRecorder for chunks
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm');
      const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        // Cleanup audio graph
        try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch {}
        try { if (micSourceRef.current) micSourceRef.current.disconnect(); } catch {}
        try { if (analyserRef.current) analyserRef.current.disconnect(); } catch {}
        stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(audioChunksRef.current, { type: mime });
        await uploadRecordedBlob(blob);
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
      const HANGOVER_MS = 900;
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

      mr.start(100); // collect data every 100ms
      setIsRecording(true);
      tick();
    } catch (err) {
      console.error('Mic error:', err);
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    try { mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && mediaRecorderRef.current.stop(); } catch {}
  };

  const uploadRecordedBlob = async (blob) => {
    if (!sessionId || !currentQuestion) return;
    setIsLoading(true);
    setLoadingMessage('Uploading and transcribing your response...');
    try {
      const file = new File([blob], 'response.webm', { type: blob.type || 'audio/webm' });
      const formData = new FormData();
      formData.append('audio_response', file);

      const response = await fetch(`http://localhost:8000/api/interviews/${sessionId}/submit_response/${currentQuestion.question_index}`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      
      if (result.transcription && !result.transcription.startsWith('[Transcription failed')) {
        setTranscriptionResult(result.transcription);
        setShowTranscription(true);
        
        // Store this Q&A pair
        const qaData = {
          questionIndex: currentQuestion.question_index,
          question: currentQuestion.question.question,
          response: result.transcription,
          timestamp: new Date().toISOString()
        };
        setAllResponses(prev => [...prev, qaData]);
      } else {
        setTranscriptionResult('Transcription failed or was unclear');
        setShowTranscription(true);
      }
      
      // Next question
      const nextQuestionText = await handleNextQuestion(sessionId);
      if (nextQuestionText) {
        // Auto-play the next question (recording will auto-start when TTS finishes)
        setTimeout(() => speakQuestion(nextQuestionText), 1000);
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
    setLoadingMessage('Uploading and transcribing your response...');

    try {
      const formData = new FormData();
      formData.append('audio_response', file);

      const response = await fetch(`http://localhost:8000/api/interviews/${sessionId}/submit_response/${currentQuestion.question_index}`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      // Show transcription result
      if (result.transcription && result.transcription !== '[Transcription pending]') {
        setTranscriptionResult(result.transcription);
        setShowTranscription(true);
        
        // Store this Q&A pair
        const qaData = {
          questionIndex: currentQuestion.question_index,
          question: currentQuestion.question.question,
          response: result.transcription,
          timestamp: new Date().toISOString()
        };
        setAllResponses(prev => [...prev, qaData]);
      } else {
        setTranscriptionResult('Transcription failed or was unclear');
        setShowTranscription(true);
      }
      
      // Fetch the next question automatically after submission
      const nextQuestionText = await handleNextQuestion(sessionId);
      if (nextQuestionText) {
        // Auto-play the next question
        setTimeout(() => speakQuestion(nextQuestionText), 1000);
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
      <header className="bg-blue-600 text-white p-4 text-center">
        <h1 className="text-2xl font-bold">HR Interview Agent</h1>
      </header>
      <main className="p-8">
        {interviewStatus === 'setup' && (
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Setup Interview</h2>
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
              className={`py-2 px-4 rounded font-bold ${
                isLoading || !jobDescription.trim()
                  ? 'bg-gray-400 cursor-not-allowed text-gray-700'
                  : 'bg-blue-500 hover:bg-blue-700 text-white'
              }`}
              onClick={handleGenerateQuestions}
              disabled={isLoading || !jobDescription.trim()}
            >
              {isLoading ? 'Generating...' : 'Generate Questions'}
            </button>
            {isLoading && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-blue-800">{loadingMessage}</p>
                </div>
              </div>
            )}
            {loadingMessage && !isLoading && (
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
                  onClick={handleCreateInterview}
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Interview...' : 'Start Interview'}
                </button>
              </div>
            )}
          </div>
        )}

        {interviewStatus === 'in_progress' && currentQuestion && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Question {currentQuestion.question_index + 1}
              </h2>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((currentQuestion.question_index + 1) / (sessionId ? questions.length : 1)) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-6 rounded-r-lg">
              <p className="text-xl text-gray-800 leading-relaxed font-medium">
                {currentQuestion.question.question}
              </p>
            </div>

            <div className="flex justify-center gap-3 mb-6">
              <button
                onClick={() => speakQuestion(currentQuestion.question.question)}
                disabled={isPlayingAudio}
                className={`flex items-center space-x-2 px-6 py-3 rounded-full font-semibold ${
                  isPlayingAudio
                    ? 'bg-gray-400 cursor-not-allowed text-gray-700'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
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
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Mic level</span>
                <div className="w-40 h-2 bg-gray-200 rounded">
                  <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.min(100, Math.round(level * 300))}%` }}></div>
                </div>
              </div>
              <div className="flex gap-3 mb-4">
                {!isRecording ? (
                  <button onClick={startRecording} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold">Start Recording</button>
                ) : (
                  <button onClick={stopRecording} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold">Stop</button>
                )}
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload your response (audio file):
              </label>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleAudioUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-2">
                Accepted formats: MP3, WAV, M4A, etc.
              </p>
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

                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Questions & Responses</h3>
                  <div className="space-y-6">
                    {interviewSummary.questions.map((item, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-5">
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
                              Question {index + 1}
                            </span>
                            {item.answered && (
                              <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                                ✓ Answered
                              </span>
                            )}
                          </div>
                          <p className="text-gray-800 font-medium text-lg leading-relaxed">
                            {item.question}
                          </p>
                        </div>
                        
                        {item.response && (
                          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
                            <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                              </svg>
                              Your Response:
                            </h4>
                            <p className="text-green-700 italic leading-relaxed mb-3">"{item.response}"</p>
                            {item.audio_url && (
                              <div className="mt-3">
                                <label className="text-xs font-medium text-green-700 mb-1 block">Listen to your recording:</label>
                                <audio 
                                  controls 
                                  className="w-full max-w-md h-8"
                                  preload="none"
                                >
                                  <source src={`http://localhost:8000${item.audio_url}`} type="audio/webm" />
                                  <source src={`http://localhost:8000${item.audio_url}`} type="audio/mp4" />
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {!item.answered && (
                          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                            <p className="text-yellow-700 text-sm">No response recorded for this question.</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center gap-4 pt-6 border-t">
                  <button 
                    onClick={() => {
                      setInterviewStatus('setup');
                      setSessionId(null);
                      setCurrentQuestion(null);
                      setQuestions([]);
                      setAllResponses([]);
                      setInterviewSummary(null);
                      setJobDescription('');
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Start New Interview
                  </button>
                  <button 
                    onClick={() => {
                      const summaryText = interviewSummary.questions.map((item, i) => 
                        `Question ${i + 1}: ${item.question}\nResponse: ${item.response || 'No response'}\n`
                      ).join('\n');
                      
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
