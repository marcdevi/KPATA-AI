'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authBootstrap, getProfile } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const { setAuth, setCredits } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) { setError('Email invalide'); return; }
    if (!password || password.length < 6) { setError('Mot de passe trop court (min 6 caractères)'); return; }

    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      const supabase = getSupabaseClient();
      const authRes = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (authRes.error) throw new Error(authRes.error.message);

      if (!authRes.data.session) {
        setInfo('Compte créé. Vérifie tes emails pour confirmer ton compte puis reconnecte-toi.');
        return;
      }

      const token = authRes.data.session.access_token;
      setAuth({ profileId: authRes.data.session.user.id, role: null, hasAcceptedTerms: false, token });

      const boot = await authBootstrap();
      if (boot.error) throw new Error(boot.error.message);

      const me = await getProfile();

      if (me.error) {
        if ((me.error as { code?: string }).code === 'ACCOUNT_PENDING_APPROVAL') {
          await getSupabaseClient().auth.signOut();
          setInfo('Votre compte est en attente de validation. Un administrateur doit approuver votre accès avant que vous puissiez vous connecter.');
          return;
        }
        throw new Error(me.error.message || 'Impossible de charger le profil');
      }

      if (!me.data) throw new Error('Impossible de charger le profil');

      const hasAcceptedTerms = !!me.data.profile.termsAcceptedAt;
      setAuth({ profileId: me.data.profile.id, phoneE164: me.data.profile.phone, email: me.data.profile.email, role: me.data.profile.role, hasAcceptedTerms, token });
      setCredits(me.data.credits.balance);

      router.replace(hasAcceptedTerms ? '/home' : '/terms');
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <span className="text-white font-black text-xl">K</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900">KPATA AI</h1>
          <p className="text-gray-500 text-sm mt-1 font-semibold">Studio photo IA instantané</p>
        </div>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            onClick={() => setMode('signin')}
          >
            Connexion
          </button>
          <button
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
            onClick={() => setMode('signup')}
          >
            Inscription
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="ex: marc@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-100 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-100 rounded-xl px-4 py-3.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />

          {error && <p className="text-red-500 text-sm font-semibold text-center">{error}</p>}
          {info && <p className="text-blue-600 text-sm font-semibold text-center">{info}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black text-base disabled:opacity-60 hover:bg-blue-700 transition-colors"
          >
            {isLoading ? '...' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}
