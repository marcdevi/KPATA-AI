'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getMannequin, createMannequin } from '@/lib/api';

export default function MannequinPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuthGuard();
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [faceBase64, setFaceBase64] = useState<string | null>(null);
  const [bodyImage, setBodyImage] = useState<string | null>(null);
  const [bodyBase64, setBodyBase64] = useState<string | null>(null);
  const [savedFaceUrl, setSavedFaceUrl] = useState<string | null>(null);
  const [savedBodyUrl, setSavedBodyUrl] = useState<string | null>(null);
  const [notCelebrity, setNotCelebrity] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, setIsLoading] = useState(true);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading) loadMannequin();
  }, [authLoading]);

  const loadMannequin = async () => {
    try {
      const result = await getMannequin();
      if (result.data?.mannequin) {
        setSavedFaceUrl(result.data.mannequin.faceImageUrl);
        setSavedBodyUrl(result.data.mannequin.bodyImageUrl);
        setNotCelebrity(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFile = (type: 'face' | 'body', file: File) => {
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
        else { setBodyImage(compressed); setBodyBase64(base64); }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const finalFaceBase64 = faceBase64;
    const finalBodyBase64 = bodyBase64;
    if (!finalFaceBase64 || !finalBodyBase64) { alert('Ajoute une nouvelle photo de visage et de corps pour mettre à jour.'); return; }
    if (!notCelebrity) { alert('Tu dois confirmer que ce n\'est pas une célébrité.'); return; }
    setIsSaving(true);
    const result = await createMannequin({ faceImageBase64: finalFaceBase64, bodyImageBase64: finalBodyBase64, isCelebrityConfirmed: notCelebrity });
    setIsSaving(false);
    if (result.error) { alert(result.error.message); return; }
    setFaceBase64(null);
    setBodyBase64(null);
    setFaceImage(null);
    setBodyImage(null);
    alert('Ton mannequin a été enregistré !');
    await loadMannequin();
  };

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="text-base font-black text-gray-900">👕 Mon Mannequin</h1>
      </div>

      <div className="px-4 pt-4 pb-8">
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
          <input
            type="checkbox"
            id="notCelebrity"
            checked={notCelebrity}
            onChange={(e) => setNotCelebrity(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-indigo-600 flex-shrink-0"
          />
          <label htmlFor="notCelebrity" className="text-sm text-amber-800 leading-relaxed">
            Je confirme que ces photos ne représentent pas une célébrité ou une personne publique.
          </label>
        </div>

        {savedFaceUrl && savedBodyUrl && !faceBase64 && !bodyBase64 && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
            <span className="text-green-600 text-lg">✅</span>
            <p className="text-sm font-bold text-green-700">Mannequin enregistré. Clique sur "Modifier" pour changer les photos.</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!faceBase64 || !bodyBase64 || !notCelebrity || isSaving}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-base disabled:opacity-50 hover:bg-indigo-700 transition-colors mb-4"
        >
          {isSaving ? '⏳ Enregistrement...' : savedFaceUrl ? '🔄 Mettre à jour le mannequin' : '💾 Enregistrer mon mannequin'}
        </button>

        <p className="text-xs text-gray-400 text-center">⚠️ MVP : 1 mannequin par compte.</p>
      </div>
    </div>
  );
}
