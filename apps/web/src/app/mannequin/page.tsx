'use client';

import { ArrowLeft, Sparkles, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getMannequin, createMannequin, generateStudioMannequin } from '@/lib/api';

type Mode = 'choose' | 'manual' | 'ai';

export default function MannequinPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuthGuard();
  const [mode, setMode] = useState<Mode>('choose');
  // Manual mode
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [faceBase64, setFaceBase64] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  const [bodyBase64, setBodyBase64] = useState<string | null>(null);
  // AI mode
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiBase64, setAiBase64] = useState<string | null>(null);
  // Common
  const [savedFaceUrl, setSavedFaceUrl] = useState<string | null>(null);
  const [savedBodyUrl, setSavedBodyUrl] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [notCelebrity, setNotCelebrity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setIsLoading] = useState(true);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading) loadMannequin();
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [authLoading]);

  const loadMannequin = async () => {
    try {
      const result = await getMannequin();
      if (result.data?.mannequin) {
        setSavedFaceUrl(result.data.mannequin.faceImageUrl);
        setSavedBodyUrl(result.data.mannequin.bodyImageUrl);
        setSavedStatus(result.data.mannequin.status);
        setNotCelebrity(true);

        if (result.data.mannequin.status === 'generating') {
          setIsGenerating(true);
          startPolling();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const result = await getMannequin();
      if (result.data?.mannequin) {
        setSavedStatus(result.data.mannequin.status);
        if (result.data.mannequin.status === 'active') {
          setSavedFaceUrl(result.data.mannequin.faceImageUrl);
          setSavedBodyUrl(result.data.mannequin.bodyImageUrl);
          setIsGenerating(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (result.data.mannequin.status === 'error') {
          setIsGenerating(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }
    }, 5000);
  };

  const handleFile = (type: 'face' | 'body' | 'ai', file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const MAX_SIZE = 1024;
        let { width, height } = img;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) { height = Math.round((height * MAX_SIZE) / width); width = MAX_SIZE; }
          else { width = Math.round((width * MAX_SIZE) / height); height = MAX_SIZE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = compressed.split(',')[1];
        if (type === 'face') { setFaceImage(compressed); setFaceBase64(base64); }
        else if (type === 'body') { setBodyImage(compressed); setBodyBase64(base64); }
        else { setAiImage(compressed); setAiBase64(base64); }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSave = async () => {
    if (!faceBase64 || !bodyBase64) { alert('Ajoute une photo de visage et de corps.'); return; }
    if (!notCelebrity) { alert('Tu dois confirmer que ce n\'est pas une célébrité.'); return; }
    setIsSaving(true);
    const result = await createMannequin({ faceImageBase64: faceBase64, bodyImageBase64: bodyBase64, isCelebrityConfirmed: notCelebrity });
    setIsSaving(false);
    if (result.error) { alert(result.error.message); return; }
    setFaceBase64(null); setBodyBase64(null); setFaceImage(null); setBodyImage(null);
    alert('Ton mannequin a été enregistré !');
    await loadMannequin();
  };

  const handleAiGenerate = async () => {
    if (!aiBase64) { alert('Ajoute une photo de toi en plein pied.'); return; }
    if (!notCelebrity) { alert('Tu dois confirmer que ce n\'est pas une célébrité.'); return; }
    setIsSaving(true);
    const result = await generateStudioMannequin({ imageBase64: aiBase64, isCelebrityConfirmed: notCelebrity });
    setIsSaving(false);
    if (result.error) { alert(result.error.message); return; }
    setAiBase64(null); setAiImage(null);
    setIsGenerating(true);
    startPolling();
  };

  if (authLoading) return <LoadingScreen />;

  // Choose mode screen
  if (mode === 'choose' && !savedFaceUrl && !isGenerating) {
    return (
      <div className="min-h-screen bg-white max-w-lg mx-auto">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="text-base font-black text-gray-900">👕 Mon Mannequin</h1>
        </div>
        <div className="px-4 pt-6 pb-8 space-y-4">
          <p className="text-sm text-gray-500 mb-2">Comment veux-tu créer ton mannequin ?</p>

          <button
            onClick={() => setMode('ai')}
            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl hover:border-indigo-400 transition-colors"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} className="text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900">✨ Génération IA</p>
              <p className="text-xs text-gray-500 mt-0.5">Envoie 1 seule photo de toi. L&apos;IA crée ton mannequin studio automatiquement.</p>
            </div>
          </button>

          <button
            onClick={() => setMode('manual')}
            className="w-full flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl hover:border-gray-400 transition-colors"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Upload size={24} className="text-gray-600" />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900">📸 Upload manuel</p>
              <p className="text-xs text-gray-500 mt-0.5">Envoie toi-même tes photos de visage et de corps.</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => { if (savedFaceUrl || isGenerating) { router.back(); } else { setMode('choose'); } }} className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="text-base font-black text-gray-900">
          {mode === 'ai' ? '✨ Génération IA' : '👕 Mon Mannequin'}
        </h1>
      </div>

      <div className="px-4 pt-4 pb-8">
        {/* Generating state */}
        {isGenerating && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">🪄 Génération en cours...</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              L&apos;IA crée ton mannequin studio. Cela peut prendre 1 à 2 minutes.
            </p>
          </div>
        )}

        {/* Error state */}
        {savedStatus === 'error' && !isGenerating && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-bold text-red-700">❌ La génération a échoué.</p>
            <p className="text-xs text-red-600 mt-1">Essaie avec une autre photo bien éclairée de face.</p>
            <button
              onClick={() => { setSavedStatus(null); setSavedFaceUrl(null); setSavedBodyUrl(null); setMode('choose'); }}
              className="mt-3 text-sm font-bold text-indigo-600 underline"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* AI mode — single photo upload */}
        {mode === 'ai' && !isGenerating && savedStatus !== 'error' && (
          <>
            <p className="text-sm text-gray-500 mb-6">Envoie une photo de toi en pied. L&apos;IA va créer tes photos de mannequin studio.</p>

            <div className="mb-6">
              <p className="text-sm font-bold text-gray-900 mb-3">📸 Photo plein pied</p>
              <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
                {aiImage ? (
                  <img src={aiImage} alt="photo plein pied" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl">🧍</span>
                    <span className="text-sm text-gray-500">Photo de la tête aux pieds</span>
                  </div>
                )}
                <button
                  onClick={() => aiInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full shadow"
                >
                  {aiImage ? 'Changer' : 'Choisir'}
                </button>
              </div>
              <input ref={aiInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile('ai', e.target.files[0])} />
              <p className="text-xs text-gray-400 mt-2">Photo debout, de face, bien éclairée</p>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 mb-6">
              <input type="checkbox" id="notCelebrity" checked={notCelebrity} onChange={(e) => setNotCelebrity(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0" />
              <label htmlFor="notCelebrity" className="text-sm text-amber-800 leading-relaxed">
                Je confirme que cette photo ne représente pas une célébrité ou une personne publique.
              </label>
            </div>

            <button
              onClick={handleAiGenerate}
              disabled={!aiBase64 || !notCelebrity || isSaving}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-black text-base disabled:opacity-50 hover:from-indigo-700 hover:to-purple-700 transition-all mb-4"
            >
              {isSaving ? '⏳ Envoi...' : '✨ Générer mon mannequin IA'}
            </button>
          </>
        )}

        {/* Manual mode — two photos */}
        {mode === 'manual' && !isGenerating && savedStatus !== 'error' && (
          <>
            <p className="text-sm text-gray-500 mb-6">Ajoute tes photos pour créer un mannequin personnalisé.</p>

            {/* Face */}
            <div className="mb-6">
              <p className="text-sm font-bold text-gray-900 mb-3">📸 Photo de visage</p>
              <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 aspect-square flex items-center justify-center">
                {faceImage || savedFaceUrl ? (
                  <img src={faceImage || savedFaceUrl!} alt="visage" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl">👤</span>
                    <span className="text-sm text-gray-500">Ajouter</span>
                  </div>
                )}
                <button
                  onClick={() => faceInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full shadow"
                >
                  {savedFaceUrl && !faceImage ? 'Modifier' : 'Choisir'}
                </button>
              </div>
              <input ref={faceInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile('face', e.target.files[0])} />
              <p className="text-xs text-gray-400 mt-2">Photo de face, bien éclairée</p>
            </div>

            {/* Body */}
            <div className="mb-6">
              <p className="text-sm font-bold text-gray-900 mb-3">📸 Photo de corps</p>
              <div className="relative w-full rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
                {bodyImage || savedBodyUrl ? (
                  <img src={bodyImage || savedBodyUrl!} alt="corps" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl">🧍</span>
                    <span className="text-sm text-gray-500">Ajouter</span>
                  </div>
                )}
                <button
                  onClick={() => bodyInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full shadow"
                >
                  {savedBodyUrl && !bodyImage ? 'Modifier' : 'Choisir'}
                </button>
              </div>
              <input ref={bodyInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile('body', e.target.files[0])} />
              <p className="text-xs text-gray-400 mt-2">Photo en pied, vêtements neutres</p>
            </div>

            {/* Checkbox */}
            <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 mb-6">
              <input type="checkbox" id="notCelebrity" checked={notCelebrity} onChange={(e) => setNotCelebrity(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0" />
              <label htmlFor="notCelebrity" className="text-sm text-amber-800 leading-relaxed">
                Je confirme que ces photos ne représentent pas une célébrité ou une personne publique.
              </label>
            </div>

            {savedFaceUrl && savedBodyUrl && !faceBase64 && !bodyBase64 && savedStatus === 'active' && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                <span className="text-green-600 text-lg">✅</span>
                <p className="text-sm font-bold text-green-700">Mannequin enregistré. Clique sur &quot;Modifier&quot; pour changer les photos.</p>
              </div>
            )}

            <button
              onClick={handleManualSave}
              disabled={!faceBase64 || !bodyBase64 || !notCelebrity || isSaving}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-base disabled:opacity-50 hover:bg-indigo-700 transition-colors mb-4"
            >
              {isSaving ? '⏳ Enregistrement...' : savedFaceUrl ? '🔄 Mettre à jour le mannequin' : '💾 Enregistrer mon mannequin'}
            </button>
          </>
        )}

        {/* Active mannequin preview (shown after generation is complete) */}
        {!isGenerating && savedStatus === 'active' && savedFaceUrl && savedBodyUrl && mode !== 'manual' && (
          <>
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
              <span className="text-green-600 text-lg">✅</span>
              <p className="text-sm font-bold text-green-700">Mannequin prêt !</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Visage</p>
                <div className="rounded-xl overflow-hidden bg-gray-100 aspect-square">
                  <img src={savedFaceUrl} alt="visage mannequin" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Corps</p>
                <div className="rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '3/4' }}>
                  <img src={savedBodyUrl} alt="corps mannequin" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <button
              onClick={() => { setSavedStatus(null); setSavedFaceUrl(null); setSavedBodyUrl(null); setMode('choose'); }}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
            >
              🔄 Recréer mon mannequin
            </button>
          </>
        )}

        <p className="text-xs text-gray-400 text-center mt-4">⚠️ MVP : 1 mannequin par compte.</p>
      </div>
    </div>
  );
}
