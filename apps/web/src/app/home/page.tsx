'use client';

import { Camera, Image as ImageIcon, Zap, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useCallback } from 'react';

import AppShell from '@/components/AppShell';
import LoadingScreen from '@/components/LoadingScreen';
import VoiceModal from '@/components/VoiceModal';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { createJob, getMannequin, analyzeVoice } from '@/lib/api';
import { CATEGORIES, BACKGROUNDS } from '@/lib/constants';
import { useAuthStore } from '@/store/auth';

const DEFAULT_OPTIONS = {
  category: 'clothing',
  backgroundStyle: 'studio_white',
  templateLayout: 'square_1x1',
  mannequinMode: 'none',
};

export default function HomePage() {
  const router = useRouter();
  const { isLoading } = useAuthGuard();
  const { credits, setCredits } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [isCreating, setIsCreating] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceSummary, setVoiceSummary] = useState<string | null>(null);
  const [voicePrompt, setVoicePrompt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setVoiceStateRef = useRef<((s: 'done' | 'error') => void) | null>(null);

  const handleVoiceTranscript = useCallback(async (text: string) => {
    const result = await analyzeVoice({
      transcript: text,
      hasImage: !!selectedImage,
      hasMannequin: options.mannequinMode === 'custom',
    });
    if (result.data) {
      setVoicePrompt(result.data.prompt);
      setVoiceSummary(result.data.summary);
      setOptions((o) => ({
        ...o,
        category: result.data!.category,
        backgroundStyle: result.data!.backgroundStyle,
        mannequinMode: result.data!.mannequinMode,
      }));
      setVoiceStateRef.current?.('done');
    } else {
      setVoiceStateRef.current?.('error');
    }
  }, [selectedImage, options.mannequinMode]);

  const voiceInputHook = useVoiceInput(handleVoiceTranscript);
  setVoiceStateRef.current = voiceInputHook.setState;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const MAX_SIZE = 1920;
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
        setSelectedImage(compressed);
        setImageBase64(compressed.split(',')[1]);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleVoiceConfirm = async () => {
    setVoiceOpen(false);
    voiceInputHook.reset();
    setVoiceSummary(null);
    if (!selectedImage) { alert('Sélectionne une image d\'abord pour générer.'); return; }
    await handleCreate(voicePrompt || undefined);
    setVoicePrompt(null);
  };

  const handleCreate = async (customPrompt?: string) => {
    if (!selectedImage) { alert('Sélectionne une image d\'abord.'); return; }
    const requiredCredits = options.mannequinMode === 'custom' ? 2 : 1;
    if (credits < requiredCredits) { alert(`Crédits insuffisants. Il te faut ${requiredCredits} crédit(s).`); return; }

    if (options.mannequinMode === 'custom') {
      const m = await getMannequin();
      if (!m.data?.mannequin) { alert('Configure ton mannequin dans le profil d\'abord.'); return; }
    }

    setIsCreating(true);
    const result = await createJob({ ...options, clientRequestId: `web_${Date.now()}`, imageBase64: imageBase64 || undefined, ...(customPrompt ? { prompt: customPrompt } : {}) });
    setIsCreating(false);

    if (result.error) { alert(result.error.message); return; }
    if (result.data?.job.id) {
      if (typeof result.data.creditsRemaining === 'number') setCredits(result.data.creditsRemaining);
      setSelectedImage(null);
      setImageBase64(null);
      setOptions(DEFAULT_OPTIONS);
      router.push(`/result/${result.data.job.id}`);
    }
  };

  const handleVoiceClose = () => {
    setVoiceOpen(false);
    voiceInputHook.reset();
    setVoiceSummary(null);
    setVoicePrompt(null);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <AppShell><div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">K</span>
            </div>
            <span className="text-lg font-black text-gray-900">KPATA AI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceOpen(true)}
              className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors"
              title="Décrire vocalement"
            >
              <Mic size={18} className="text-blue-600" />
            </button>
            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
              <Zap size={15} className="text-blue-600" />
              <span className="text-sm font-bold text-gray-900">{credits} crédits</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-4">
          {/* Source photo */}
          <div className="px-4 pt-4 pb-5">
            <p className="text-sm font-bold text-gray-900 mb-3">Source photo</p>
            {selectedImage ? (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <img src={selectedImage} alt="preview" className="w-full h-52 object-cover" />
                <button onClick={() => { setSelectedImage(null); setImageBase64(null); }} className="w-full py-3 text-blue-600 font-bold text-sm">
                  Changer
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-5 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center gap-2.5"
                >
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <Camera size={20} className="text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Prendre photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col items-center gap-2.5"
                >
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <ImageIcon size={20} className="text-gray-500" />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Importer</span>
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Catégorie */}
          <div className="px-4 pb-5">
            <p className="text-sm font-bold text-gray-900 mb-3">Catégorie</p>
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setOptions((o) => ({ ...o, category: cat.id }))}
                  className={`flex-shrink-0 px-3.5 py-2 rounded-full text-sm font-bold border transition-all ${options.category === cat.id ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fond */}
          <div className="px-4 pb-5">
            <p className="text-sm font-bold text-gray-900 mb-3">Fond studio</p>
            <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setOptions((o) => ({ ...o, backgroundStyle: bg.id }))}
                  className={`flex-shrink-0 w-36 rounded-xl overflow-hidden border-2 transition-all ${options.backgroundStyle === bg.id ? 'border-blue-600' : 'border-gray-200'}`}
                >
                  <img src={bg.previewUrl} alt={bg.label} className="h-24 w-full object-cover" />
                  <p className="py-3 text-xs font-bold text-gray-900 text-center">{bg.label}</p>
                </button>
              ))}
            </div>
          </div>


          {/* Mannequin */}
          <div className="px-4 pb-5">
            <p className="text-sm font-bold text-gray-900 mb-3">Mannequin</p>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              {[{ id: 'none', label: 'Aucun (produit seul)' }, { id: 'custom', label: 'Mon mannequin' }].map((m, i) => (
                <div key={m.id}>
                  {i > 0 && <div className="h-px bg-gray-100" />}
                  <button
                    onClick={() => setOptions((o) => ({ ...o, mannequinMode: m.id }))}
                    className="w-full flex items-center gap-3 px-3 py-3"
                  >
                    <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${options.mannequinMode === m.id ? 'border-blue-600' : 'border-gray-300'}`}>
                      {options.mannequinMode === m.id && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <span className="font-bold text-gray-900 text-sm">{m.label}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 pt-2.5 pb-3 bg-white">
          <div className="flex gap-2">
            <button
              onClick={() => setVoiceOpen(true)}
              className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0 hover:bg-blue-100 transition-colors"
              title="Décrire vocalement"
            >
              <Mic size={20} className="text-blue-600" />
            </button>
            <button
              onClick={() => handleCreate()}
              disabled={!selectedImage || isCreating}
              className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-black text-base disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {isCreating ? 'Génération...' : 'Générer (1 crédit)'}
            </button>
          </div>
        </div>
      </div></AppShell>

      {voiceOpen && (
        <VoiceModal
          state={voiceInputHook.state}
          transcript={voiceInputHook.transcript}
          error={voiceInputHook.error}
          summary={voiceSummary}
          onStart={voiceInputHook.start}
          onStop={voiceInputHook.stop}
          onClose={handleVoiceClose}
          onConfirm={handleVoiceConfirm}
        />
    )}
    </>
  );
}
