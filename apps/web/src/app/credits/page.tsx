'use client';

import { Droplets } from 'lucide-react';
import { useState, useEffect } from 'react';

import AppShell from '@/components/AppShell';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getCreditPacks, initPayment, getProfile } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface CreditPack {
  id: string;
  code: string;
  name: string;
  credits: number;
  price_xof: number;
  active?: boolean;
}

export default function CreditsPage() {
  const { isLoading: authLoading } = useAuthGuard();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPackCode, setSelectedPackCode] = useState<string | null>(null);
  const { credits, setCredits } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;
    loadPacks();
    refreshCredits();
  }, [authLoading]);

  const loadPacks = async () => {
    const result = await getCreditPacks();
    if (result.data) {
      const active = result.data.packs.filter((p) => p.active !== false);
      setPacks(active);
      if (!selectedPackCode && active[0]?.code) setSelectedPackCode(active[0].code);
    }
  };

  const refreshCredits = async () => {
    const result = await getProfile();
    if (result.data) setCredits(result.data.credits.balance);
  };

  const handleBuy = async () => {
    if (!selectedPackCode) { alert('Sélectionne un pack.'); return; }
    setIsLoading(true);
    const result = await initPayment(selectedPackCode, 'paystack');
    setIsLoading(false);
    if (result.error) { alert(result.error.message); return; }

    const redirectUrl = result.data?.redirectUrl;
    if (!redirectUrl) { alert('URL Paystack manquante'); return; }

    // Rediriger vers Paystack dans la même fenêtre
    // Paystack redirigera automatiquement vers /payment-callback après paiement
    window.location.href = redirectUrl;
  };

  const formatPrice = (price: number) => price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  const isPopular = (pack: CreditPack) => pack.credits === 10 || pack.name?.toLowerCase().includes('pop');

  if (authLoading) return <LoadingScreen />;

  return (
    <AppShell>
      <div className="px-4 pt-4 pb-6">
        <h1 className="text-lg font-black text-gray-900 text-center mb-4">Portefeuille</h1>

        {/* Balance card */}
        <div className="bg-blue-600 rounded-2xl px-4 py-6 flex flex-col items-center mb-6 shadow-lg shadow-blue-200">
          <p className="text-blue-200 text-sm font-semibold">Solde actuel</p>
          <p className="text-white text-4xl font-black mt-2">{credits} Crédits</p>
          <div className="mt-3 bg-white/20 px-4 py-2 rounded-full">
            <p className="text-blue-100 text-sm font-bold">1 crédit = 1 génération</p>
          </div>
        </div>

        {/* Packs */}
        <h2 className="text-base font-black text-gray-900 mb-3">Recharger des crédits</h2>
        <div className="space-y-3 mb-6">
          {packs.map((pack) => {
            const active = selectedPackCode === pack.code;
            return (
              <button
                key={pack.code}
                onClick={() => setSelectedPackCode(pack.code)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border-2 transition-all ${active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}
              >
                <div className="text-left">
                  <p className="text-lg font-black text-gray-900">{pack.credits} Crédits</p>
                  <p className="text-sm font-bold text-gray-500">{formatPrice(pack.price_xof)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isPopular(pack) && (
                    <span className="bg-amber-400 text-white text-xs font-black px-2.5 py-1 rounded-full">POPULAIRE</span>
                  )}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-blue-600' : 'border-gray-300'}`}>
                    {active && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Provider */}
        <h2 className="text-base font-black text-gray-900 mb-3">Payer avec</h2>
        <button
          onClick={handleBuy}
          disabled={isLoading || !selectedPackCode}
          className="w-full bg-sky-400 text-white py-4 rounded-xl font-black flex items-center justify-center gap-3 disabled:opacity-60 hover:bg-sky-500 transition-colors mb-6"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Droplets size={18} />
          </div>
          {isLoading ? 'Traitement...' : 'Paystack'}
        </button>

      </div>
    </AppShell>
  );
}
