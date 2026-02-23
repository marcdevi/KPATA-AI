import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, UserX, Clock, Mail, Calendar } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';

interface PendingProfile {
  id: string;
  email: string | null;
  phone_e164: string | null;
  name: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface PendingResponse {
  profiles: PendingProfile[];
  total: number;
}

export default function PendingUsersPage() {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => api.get<PendingResponse>('/admin/users/pending'),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/admin/users/${profileId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason: string }) =>
      api.post(`/admin/users/${profileId}/reject`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-users'] });
      setRejectingId(null);
      setRejectReason('');
    },
  });

  const handleApprove = (profileId: string) => {
    approveMutation.mutate(profileId);
  };

  const handleRejectConfirm = (profileId: string) => {
    rejectMutation.mutate({
      profileId,
      reason: rejectReason || 'Compte refusé lors de la vérification',
    });
  };

  const profiles = data?.profiles || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Comptes en attente</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approuvez ou refusez les nouveaux comptes avant qu'ils puissent accéder à l'application.
          </p>
        </div>
        <Badge variant={total > 0 ? 'destructive' : 'secondary'} className="text-base px-3 py-1">
          {total} en attente
        </Badge>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserCheck className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">Aucun compte en attente</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Tous les nouveaux comptes ont été traités.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
                        En attente d'approbation
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      {profile.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{profile.email}</span>
                        </div>
                      )}
                      {profile.phone_e164 && (
                        <div className="text-sm text-muted-foreground">
                          Tél : {profile.phone_e164}
                        </div>
                      )}
                      {profile.name && (
                        <div className="text-sm text-muted-foreground">
                          Nom : {profile.name}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Inscrit le {formatDate(profile.created_at)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        ID : {profile.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {rejectingId === profile.id ? (
                      <div className="space-y-2 w-64">
                        <textarea
                          className="w-full text-sm border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                          rows={2}
                          placeholder="Raison du refus (optionnel)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="flex-1"
                            disabled={rejectMutation.isPending}
                            onClick={() => handleRejectConfirm(profile.id)}
                          >
                            Confirmer le refus
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={approveMutation.isPending}
                          onClick={() => handleApprove(profile.id)}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => setRejectingId(profile.id)}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Refuser
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
