import { useState, useRef, useCallback } from 'react';

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 5000;

export const useAudioRecorder = ({ onRecordingComplete, onMicIntensityChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const silenceStartRef = useRef(null);
  const hasSpokenRef = useRef(false);

  const stopRecording = useCallback((reason = 'manual') => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cleanupAudioProcessing = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (onMicIntensityChange) {
      onMicIntensityChange(0);
    }
  }, [onMicIntensityChange]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      setIsRecording(true);
      setIsProcessing(false);
      hasSpokenRef.current = false;
      silenceStartRef.current = null;
      audioChunksRef.current = [];

      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      const processor = context.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);

        if (onMicIntensityChange) {
          onMicIntensityChange(rms);
        }

        if (rms > SILENCE_THRESHOLD) {
          hasSpokenRef.current = true;
          silenceStartRef.current = null;
        } else if (hasSpokenRef.current) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION_MS) {
            stopRecording('silence');
          }
        }
      };

      source.connect(processor);
      processor.connect(context.destination);

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[RECORDER] Chunk ${audioChunksRef.current.length}: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length}`);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log(`[RECORDER] Recording stopped. Total chunks: ${audioChunksRef.current.length}, total size: ${totalSize} bytes`);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`[RECORDER] Final blob size: ${audioBlob.size} bytes`);
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob);
        }
        stream.getTracks().forEach((track) => track.stop());
        cleanupAudioProcessing();
        setIsRecording(false);
        setIsProcessing(true);
      };

      mediaRecorderRef.current.start(1000); // Collect data every 1 second
      console.log('[RECORDER] Recording started with 1s timeslice');

    } catch (err) {
      console.error("Error starting recording:", err);
      throw err;
    }
  }, [onRecordingComplete, onMicIntensityChange, stopRecording, cleanupAudioProcessing]);

  return { isRecording, isProcessing, startRecording, stopRecording };
};
