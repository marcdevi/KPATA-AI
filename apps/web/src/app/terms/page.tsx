'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import LoadingScreen from '@/components/LoadingScreen';
import { useTermsGuard } from '@/hooks/useAuthGuard';
import { acceptTerms } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function TermsPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useTermsGuard();
  const [isLoading, setIsLoading] = useState(false);
  const setTermsAccepted = useAuthStore((s) => s.setTermsAccepted);

  const handleAccept = async () => {
    setIsLoading(true);
    const result = await acceptTerms();
    setIsLoading(false);
    if (result.error) { alert(result.error.message); return; }
    setTermsAccepted(true);
    router.replace('/home');
  };

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-white flex flex-col p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-4">Conditions Générales</h1>

      <div className="flex-1 overflow-y-auto mb-6 text-gray-600 leading-relaxed space-y-4">
        <p>En utilisant KPATA AI, tu acceptes :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Nos conditions d'utilisation</li>
          <li>Notre politique de confidentialité</li>
          <li>L'utilisation de tes images pour le traitement IA</li>
        </ul>
        <p>KPATA AI transforme tes photos de produits en visuels professionnels pour les réseaux sociaux.</p>
        <p>Tes images sont traitées de manière sécurisée et ne sont pas partagées avec des tiers sans ton consentement.</p>
        <p className="text-blue-600">Pour plus de détails, visite kpata.ai/cgu</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleAccept}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg disabled:opacity-60 hover:bg-blue-700 transition-colors"
        >
          {isLoading ? 'Chargement...' : '✅ J\'accepte'}
        </button>
        <button
          onClick={() => alert('Tu ne peux pas utiliser KPATA AI sans accepter les CGU.')}
          className="w-full bg-gray-100 text-gray-500 py-4 rounded-xl font-semibold"
        >
          ❌ Je refuse
        </button>
      </div>
    </div>
  );
}
