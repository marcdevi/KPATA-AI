'use client';

import { Mic, MicOff, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { VoiceState } from '@/hooks/useVoiceInput';

interface VoiceModalProps {
  state: VoiceState;
  transcript: string;
  error: string | null;
  summary: string | null;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function VoiceModal({
  state,
  transcript,
  error,
  summary,
  onStart,
  onStop,
  onClose,
  onConfirm,
}: VoiceModalProps) {
  const barsRef = useRef<HTMLDivElement[]>([]);

  // Animate bars while listening
  useEffect(() => {
    if (state !== 'listening') return;
    const interval = setInterval(() => {
      barsRef.current.forEach((bar) => {
        if (bar) {
          const h = Math.random() * 28 + 8;
          bar.style.height = `${h}px`;
        }
      });
    }, 120);
    return () => clearInterval(interval);
  }, [state]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-6 pt-6 pb-10 animate-slide-up">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
        >
          <X size={16} className="text-gray-500" />
        </button>

        {/* Title */}
        <h2 className="text-lg font-black text-gray-900 text-center mb-1">
          {state === 'idle' && 'Décris ton visuel'}
          {state === 'listening' && 'Je t\'écoute...'}
          {state === 'processing' && 'Analyse en cours...'}
          {state === 'done' && 'Prêt à générer !'}
          {state === 'error' && 'Problème détecté'}
        </h2>
        <p className="text-sm text-gray-400 text-center mb-8">
          {state === 'idle' && 'Parle naturellement, décris le produit et le style voulu'}
          {state === 'listening' && 'Parle clairement, puis clique sur Stop'}
          {state === 'processing' && 'L\'IA structure ton prompt...'}
          {state === 'done' && 'Vérifie et lance la génération'}
          {state === 'error' && 'Réessaie ou ferme'}
        </p>

        {/* Visual feedback */}
        <div className="flex items-center justify-center mb-8">
          {state === 'idle' && (
            <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center">
              <Mic size={40} className="text-blue-600" />
            </div>
          )}

          {state === 'listening' && (
            <div className="relative flex items-center justify-center">
              {/* Pulse rings */}
              <div className="absolute w-32 h-32 rounded-full bg-red-100 animate-ping opacity-30" />
              <div className="absolute w-24 h-24 rounded-full bg-red-100 animate-ping opacity-40" style={{ animationDelay: '0.2s' }} />
              <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-200">
                <Mic size={32} className="text-white" />
              </div>
            </div>
          )}

          {state === 'processing' && (
            <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center">
              <Loader2 size={40} className="text-indigo-600 animate-spin" />
            </div>
          )}

          {state === 'done' && (
            <div className="w-24 h-24 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle size={40} className="text-green-500" />
            </div>
          )}

          {state === 'error' && (
            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle size={40} className="text-red-500" />
            </div>
          )}
        </div>

        {/* Sound bars (listening only) */}
        {state === 'listening' && (
          <div className="flex items-center justify-center gap-1.5 mb-6 h-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                ref={(el) => { if (el) barsRef.current[i] = el; }}
                className="w-1.5 rounded-full bg-red-400 transition-all duration-100"
                style={{ height: `${Math.random() * 24 + 8}px` }}
              />
            ))}
          </div>
        )}

        {/* Transcript */}
        {transcript && state !== 'idle' && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs font-bold text-gray-400 mb-1">Tu as dit :</p>
            <p className="text-sm text-gray-700 font-medium italic">"{transcript}"</p>
          </div>
        )}

        {/* AI Summary */}
        {summary && state === 'done' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-6">
            <p className="text-xs font-bold text-blue-400 mb-1">✨ L'IA va générer :</p>
            <p className="text-sm text-blue-800 font-semibold">{summary}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-3 mb-6">
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {state === 'idle' && (
            <button
              onClick={onStart}
              className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
            >
              <Mic size={20} /> Commencer à parler
            </button>
          )}

          {state === 'listening' && (
            <button
              onClick={onStop}
              className="flex-1 bg-red-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
            >
              <MicOff size={20} /> Stop
            </button>
          )}

          {state === 'processing' && (
            <div className="flex-1 bg-gray-100 text-gray-400 py-4 rounded-xl font-black flex items-center justify-center gap-2">
              <Loader2 size={20} className="animate-spin" /> Analyse...
            </div>
          )}

          {state === 'done' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-500 py-4 rounded-xl font-black"
              >
                Annuler
              </button>
              <button
                onClick={onConfirm}
                className="flex-2 bg-blue-600 text-white py-4 px-6 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                <CheckCircle size={20} /> Générer
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <button
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-500 py-4 rounded-xl font-black"
              >
                Fermer
              </button>
              <button
                onClick={onStart}
                className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2"
              >
                <Mic size={20} /> Réessayer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
