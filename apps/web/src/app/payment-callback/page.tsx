'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import LoadingScreen from '@/components/LoadingScreen';
import { verifyPaystack } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

export default function PaymentCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference');
  const { refreshProfile } = useAuthStore();

  const [status, setStatus] = useState<'checking' | 'success' | 'failed' | 'pending'>('checking');
  const [message, setMessage] = useState('Vérification du paiement en cours...');

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setMessage('Référence de paiement manquante');
      return;
    }

    let attempts = 0;
    const maxAttempts = 30; // 30 tentatives max (1 minute)
    let intervalId: NodeJS.Timeout | null = null;
    
    const checkPayment = async () => {
      try {
        attempts++;
        
        const result = await verifyPaystack(reference);
        
        if (result.data?.status === 'succeeded') {
          if (intervalId) clearInterval(intervalId);
          setStatus('success');
          setMessage('Paiement confirmé ! Tes crédits ont été ajoutés.');
          await refreshProfile();
          
          setTimeout(() => {
            router.push('/credits');
          }, 2000);
          
          return true;
        } else if (result.data?.status === 'failed' || result.data?.status === 'canceled') {
          if (intervalId) clearInterval(intervalId);
          setStatus('failed');
          setMessage('Le paiement a échoué ou a été annulé.');
          return true;
        } else if (result.data?.status === 'pending') {
          if (attempts >= maxAttempts) {
            if (intervalId) clearInterval(intervalId);
            setStatus('pending');
            setMessage('Le paiement est en cours de traitement. Tes crédits seront ajoutés sous peu.');
            setTimeout(() => {
              router.push('/credits');
            }, 3000);
            return true;
          }
          setMessage(`Vérification du paiement... (${attempts}/${maxAttempts})`);
          return false;
        }
      } catch (error) {
        console.error('Erreur vérification paiement:', error);
        if (attempts >= maxAttempts) {
          if (intervalId) clearInterval(intervalId);
          setStatus('pending');
          setMessage('Impossible de vérifier le paiement. Vérifie ton solde dans quelques instants.');
          setTimeout(() => {
            router.push('/credits');
          }, 3000);
          return true;
        }
        return false;
      }
      return false;
    };

    // Première vérification immédiate
    checkPayment().then((shouldStop) => {
      if (shouldStop) return;

      // Polling toutes les 2 secondes
      intervalId = setInterval(async () => {
        await checkPayment();
      }, 2000);
    });

    // Cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [reference, router, refreshProfile]);

  if (!reference) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-xl font-black text-gray-900 mb-2">Erreur</h1>
          <p className="text-sm text-gray-600 text-center mb-6">Référence de paiement manquante</p>
          <button
            onClick={() => router.push('/credits')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            Retour aux crédits
          </button>
        </div>
      </AppShell>
    );
  }

  if (status === 'checking') {
    return <LoadingScreen />;
  }

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Paiement confirmé !</h1>
            <p className="text-sm text-gray-600 text-center mb-6">{message}</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Paiement non validé</h1>
            <p className="text-sm text-gray-600 text-center mb-6">{message}</p>
            <button
              onClick={() => router.push('/credits')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
            >
              Retour aux crédits
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <span className="text-3xl">⏳</span>
            </div>
            <h1 className="text-xl font-black text-gray-900 mb-2">Paiement en cours</h1>
            <p className="text-sm text-gray-600 text-center mb-6">{message}</p>
          </>
        )}
      </div>
    </AppShell>
  );
}
