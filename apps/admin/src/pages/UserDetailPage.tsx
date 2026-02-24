import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard, Ban, RefreshCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { formatCurrency, formatPhone, formatDate } from '../lib/utils';
import { useAuthStore } from '../stores/auth';
import { toast } from '../components/ui/use-toast';

interface UserDetail {
  profile: {
    id: string;
    phone_e164: string;
    name?: string;
    role: string;
    status: string;
    violation_count: number;
    ban_reason?: string;
    terms_accepted_at?: string;
    created_at: string;
  };
  credits: {
    balance: number;
  };
  recentTransactions: Array<{
    id: string;
    entry_type: string;
    amount: number;
    created_at: string;
    description?: string;
  }>;
  recentJobs: Array<{
    id: string;
    status: string;
    category: string;
    created_at: string;
  }>;
  payments: Array<{
    id: string;
    pack_code: string;
    amount_xof: number;
    status: string;
    created_at: string;
  }>;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isSuperAdmin } = useAuthStore();

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['user-detail', id],
    queryFn: () => api.get<UserDetail>(`/admin/users/${id}`),
    enabled: !!id,
  });

  const adjustCreditsMutation = useMutation({
    mutationFn: (data: { credits: number; reason: string }) =>
      api.post('/admin/credits/refund', {
        profileId: id,
        credits: data.credits,
        reason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', id] });
      setShowCreditModal(false);
      setCreditAmount('');
      setCreditReason('');
      toast({ title: 'Crédits ajustés avec succès' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post(`/admin/users/${id}/ban`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-detail', id] });
      toast({ title: 'Utilisateur banni' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const handleAdjustCredits = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount <= 0) return;
    adjustCreditsMutation.mutate({ credits: amount, reason: creditReason });
  };

  if (isLoading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center">Utilisateur non trouvé</div>;
  }

  const { profile, credits, recentTransactions, recentJobs, payments } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Profil 360°</h1>
          <p className="font-mono text-muted-foreground">
            {formatPhone(profile.phone_e164)}
          </p>
        </div>
      </div>

      {/* Profile Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nom</span>
              <span>{profile.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rôle</span>
              <Badge>{profile.role}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Statut</span>
              <Badge variant={profile.status === 'active' ? 'success' : 'destructive'}>
                {profile.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Violations</span>
              <span>{profile.violation_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inscrit le</span>
              <span className="text-sm">{formatDate(profile.created_at)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Solde Crédits</CardTitle>
            {isAdmin() && (
              <Button size="sm" onClick={() => setShowCreditModal(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Ajuster
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{credits.balance}</div>
            <p className="text-sm text-muted-foreground">crédits disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.status === 'active' && isAdmin() && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  const reason = prompt('Raison du ban:');
                  if (reason) banUserMutation.mutate(reason);
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                Bannir l'utilisateur
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={() => queryClient.invalidateQueries({ queryKey: ['user-detail', id] })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Ajuster les crédits</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdjustCredits} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre de crédits</label>
                  <Input
                    type="number"
                    min="1"
                    max={isSuperAdmin() ? undefined : 16}
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    required
                  />
                  {!isSuperAdmin() && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Maximum 16 crédits (5000 FCFA) pour admin
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Raison (obligatoire)</label>
                  <Input
                    value={creditReason}
                    onChange={(e) => setCreditReason(e.target.value)}
                    minLength={10}
                    placeholder="Minimum 10 caractères"
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreditModal(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={adjustCreditsMutation.isPending}>
                    {adjustCreditsMutation.isPending ? 'En cours...' : 'Confirmer'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des crédits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-sm">Type</th>
                  <th className="px-4 py-2 text-left text-sm">Montant</th>
                  <th className="px-4 py-2 text-left text-sm">Description</th>
                  <th className="px-4 py-2 text-left text-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions?.map((tx) => (
                  <tr key={tx.id} className="border-b">
                    <td className="px-4 py-2">
                      <Badge variant="outline">{tx.entry_type}</Badge>
                    </td>
                    <td className={`px-4 py-2 font-mono ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-4 py-2 text-sm">{tx.description || '-'}</td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Paiements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-sm">Pack</th>
                  <th className="px-4 py-2 text-left text-sm">Montant</th>
                  <th className="px-4 py-2 text-left text-sm">Statut</th>
                  <th className="px-4 py-2 text-left text-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments?.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="px-4 py-2">{p.pack_code}</td>
                    <td className="px-4 py-2">{formatCurrency(p.amount_xof)}</td>
                    <td className="px-4 py-2">
                      <Badge variant={p.status === 'succeeded' ? 'success' : 'secondary'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-sm">ID</th>
                  <th className="px-4 py-2 text-left text-sm">Catégorie</th>
                  <th className="px-4 py-2 text-left text-sm">Statut</th>
                  <th className="px-4 py-2 text-left text-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs?.map((job) => (
                  <tr key={job.id} className="border-b">
                    <td className="px-4 py-2 font-mono text-xs">{job.id.slice(0, 8)}...</td>
                    <td className="px-4 py-2">{job.category}</td>
                    <td className="px-4 py-2">
                      <Badge variant={job.status === 'delivered' ? 'success' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-sm text-muted-foreground">
                      {formatDate(job.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
