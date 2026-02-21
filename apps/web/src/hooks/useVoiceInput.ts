'use client';

import { useState, useRef, useCallback } from 'react';

// Manual types for Web Speech API (not in all TS lib configs)
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
}
interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: ISpeechRecognitionResult[] & { length: number };
}
interface ISpeechRecognitionErrorEvent {
  error: string;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

export type VoiceState = 'idle' | 'listening' | 'processing' | 'done' | 'error';

interface UseVoiceInputReturn {
  state: VoiceState;
  setState: (s: VoiceState) => void;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceInput(onTranscript?: (text: string) => void): UseVoiceInputReturn {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(() => {
    if (!isSupported) {
      setError('La reconnaissance vocale n\'est pas supportée par ce navigateur.');
      setState('error');
      return;
    }

    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setState('listening');
      setTranscript('');
      transcriptRef.current = '';
      setError(null);
    };

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const t = final || interim;
      setTranscript(t);
      transcriptRef.current = t;
    };

    recognition.onend = () => {
      setState('processing');
      const finalText = transcriptRef.current;
      if (finalText && onTranscriptRef.current) {
        onTranscriptRef.current(finalText);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        setError('Aucune parole détectée. Réessaie.');
      } else if (event.error === 'not-allowed') {
        setError('Accès au microphone refusé. Autorise le micro dans ton navigateur.');
      } else {
        setError(`Erreur: ${event.error}`);
      }
      setState('error');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, onTranscript, transcript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    setState('idle');
    setTranscript('');
    setError(null);
  }, []);

  return { state, setState, transcript, error, isSupported, start, stop, reset };
}
