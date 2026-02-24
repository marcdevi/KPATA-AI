'use client';

import { X, Download, Share2, ImageIcon, Grid } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';

import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getJob } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Asset {
  id: string;
  type: string;
  width: number;
  height: number;
  metadata?: { format?: string; variant?: string; url?: string };
}

interface Job {
  id: string;
  status: string;
  category: string;
  background_style: string;
}

const STEPS = ['Optimisation photo', 'Détourage IA', 'Studio Pro & Lumière', 'Export Final'];

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoading: authLoading } = useAuthGuard();
  const { credits } = useAuthStore();
  const [job, setJob] = useState<Job | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'whatsapp' | 'instagram'>('whatsapp');
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const jobRef = useRef(job);
  const assetsRef = useRef(assets);
  jobRef.current = job;
  assetsRef.current = assets;

  const loadJob = useCallback(async (isInitial = false) => {
    if (!id) return;
    const res = await getJob(id);
    if (res.error) {
      if (isInitial) { setError(res.error.message); setIsLoading(false); }
      return;
    }
    if (res.data) { setJob(res.data.job); setAssets(res.data.assets || []); }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    loadJob(true);
    const interval = setInterval(() => {
      const currentJob = jobRef.current;
      const currentAssets = assetsRef.current;
      if (currentJob?.status !== 'completed' || currentAssets.length === 0) {
        loadJob(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [authLoading, loadJob]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const isProcessing = !job || job.status !== 'completed' || assets.length === 0;
  const whatsappAsset = assets.find((a) => a.metadata?.format === 'whatsapp' || a.metadata?.variant === 'whatsapp');
  const instagramAsset = assets.find((a) => a.metadata?.format === 'instagram' || a.metadata?.variant === 'instagram');
  const activeAsset = selectedFormat === 'whatsapp' ? whatsappAsset : instagramAsset;
  const activeUrl = activeAsset?.metadata?.url || null;

  const handleDownload = async () => {
    if (!activeUrl) { alert('Image non disponible'); return; }
    const a = document.createElement('a');
    a.href = activeUrl;
    a.download = `kpata_${selectedFormat}_${Date.now()}.webp`;
    a.target = '_blank';
    a.click();
  };

  const handleShare = async () => {
    if (!activeUrl) { alert('Image non disponible'); return; }
    if (navigator.share) {
      try { await navigator.share({ url: activeUrl, title: 'Mon visuel KPATA AI' }); }
      catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(activeUrl);
      alert('Lien copié dans le presse-papier !');
    }
  };

  if (authLoading) return <LoadingScreen />;

  if (isLoading && !job) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4 p-6">
        <p className="text-red-500 font-semibold text-center">❌ {error}</p>
        <button onClick={loadJob} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">Réessayer</button>
      </div>
    );
  }

  if (isProcessing) {
    const elapsed = now - mountedAt;
    const stepsDone = [elapsed > 3000, elapsed > 11000, elapsed > 19000, false];

    return (
      <div className="flex flex-col min-h-screen bg-white max-w-lg mx-auto">
        <div className="flex-1 flex flex-col items-center pt-12 px-6">
          {/* Orb */}
          <div className="relative flex items-center justify-center mb-8">
            <div className="w-36 h-36 rounded-full bg-indigo-50 animate-pulse" />
            <div className="absolute w-16 h-16 rounded-full bg-white border-8 border-indigo-100 flex items-center justify-center">
              <span className="text-2xl">✨</span>
            </div>
          </div>

          <h2 className="text-2xl font-black text-gray-900 text-center mb-2">Transformation en cours...</h2>
          <p className="text-gray-400 font-bold text-sm mb-8">⏱ Objectif &lt; 30 secondes</p>

          <div className="w-full space-y-4">
            {STEPS.map((step, i) => {
              const done = stepsDone[i];
              const active = !done && (i === 0 || stepsDone[i - 1]);
              return (
                <div key={step} className="flex items-center gap-4">
                  {done ? (
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-600 text-sm font-black">✓</span>
                    </div>
                  ) : active ? (
                    <div className="w-7 h-7 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-300 mx-2.5 flex-shrink-0" />
                  )}
                  <span className={`font-black text-sm ${done ? 'text-gray-900' : active ? 'text-blue-600' : 'text-gray-400'}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-6">
          <button onClick={() => router.replace('/gallery')} className="w-full border border-gray-200 py-3.5 rounded-xl text-gray-400 font-black">
            Retour à la galerie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="w-10" />
        <h1 className="text-base font-black text-gray-900">Ton Visuel</h1>
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center">
          <X size={22} className="text-gray-700" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          {(['whatsapp', 'instagram'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${selectedFormat === fmt ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            >
              {fmt === 'whatsapp' ? 'WhatsApp (9:16)' : 'Instagram (1:1)'}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="flex justify-center mb-5">
          {activeUrl ? (
            <img
              src={activeUrl}
              alt="résultat"
              className={`rounded-2xl object-cover ${selectedFormat === 'whatsapp' ? 'w-56 h-[350px]' : 'w-64 h-64'}`}
            />
          ) : (
            <div className={`rounded-2xl bg-gray-200 flex items-center justify-center ${selectedFormat === 'whatsapp' ? 'w-56 h-[350px]' : 'w-64 h-64'}`}>
              <p className="text-gray-400 text-sm">Image indisponible</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-5">
          <button
            onClick={handleDownload}
            disabled={!activeUrl}
            className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            <Download size={18} /> Télécharger
          </button>
          <button
            onClick={handleShare}
            disabled={!activeUrl}
            className="flex-1 h-12 bg-white border border-gray-200 text-gray-900 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Share2 size={18} /> Partager
          </button>
        </div>

        {/* Secondary actions */}
        <div className="border border-gray-100 rounded-xl overflow-hidden mb-5">
          <button
            onClick={() => alert('Fonctionnalité en développement')}
            className="w-full flex items-center justify-between px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <ImageIcon size={16} className="text-gray-500" />
              </div>
              <span className="font-black text-gray-900 text-sm">Regénérer le fond</span>
            </div>
            <span className="bg-blue-50 text-blue-600 text-xs font-black px-2.5 py-1.5 rounded-full">1 crédit</span>
          </button>
          <div className="h-px bg-gray-100" />
          <button
            onClick={() => alert('Fonctionnalité en développement')}
            className="w-full flex items-center justify-between px-4 py-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Grid size={16} className="text-gray-500" />
              </div>
              <span className="font-black text-gray-900 text-sm">Changer le template</span>
            </div>
            <span className="bg-blue-50 text-blue-600 text-xs font-black px-2.5 py-1.5 rounded-full">1 crédit</span>
          </button>
        </div>

        <p className="text-center text-gray-400 text-sm font-semibold">💰 {credits} crédits restants</p>
      </div>
    </div>
  );
}
