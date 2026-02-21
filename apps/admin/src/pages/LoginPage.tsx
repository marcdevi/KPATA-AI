import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@kpata/shared';

import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.session || !authData.user) {
        setError('Email ou mot de passe incorrect.');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, phone_e164, role, name')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        setError('Impossible de charger votre profil.');
        return;
      }

      const staffRoles = [UserRole.SUPPORT_AGENT, UserRole.ADMIN, UserRole.SUPER_ADMIN];
      if (!staffRoles.includes(profile.role as UserRole)) {
        setError('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
        return;
      }

      login(
        {
          id: profile.id,
          email: authData.user.email || undefined,
          phone: profile.phone_e164 || undefined,
          role: profile.role as UserRole,
          name: profile.name || undefined,
        },
        authData.session.access_token
      );
      navigate('/');
    } catch (err) {
      setError('Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">KPATA Admin</CardTitle>
          <CardDescription>
            Connectez-vous pour accéder au tableau de bord
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="admin@kpata.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Mot de passe</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
