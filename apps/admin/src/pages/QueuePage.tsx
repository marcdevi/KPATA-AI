import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Play, XCircle, ArrowUp, AlertCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from '../components/ui/use-toast';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface QueueJob {
  id: string;
  name: string;
  data: {
    jobId: string;
    profileId: string;
    category: string;
  };
  timestamp: number;
  attemptsMade: number;
  priority: number;
  state: string;
  failedReason?: string;
}

interface QueueResponse {
  stats: QueueStats;
  waiting: QueueJob[];
  active: QueueJob[];
  failed: QueueJob[];
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

export default function QueuePage() {
  const queryClient = useQueryClient();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => api.get<QueueResponse>('/admin/queue/status'),
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/admin/queue/retry/${jobId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      toast({ title: '✅ Job relancé avec succès' });
    },
    onError: (err: Error) => {
      toast({ title: '❌ Erreur lors du relancement', description: err.message, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/admin/queue/cancel/${jobId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      toast({ title: '✅ Job annulé' });
    },
    onError: (err: Error) => {
      toast({ title: '❌ Erreur lors de l\'annulation', description: err.message, variant: 'destructive' });
    },
  });

  const prioritizeMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/admin/queue/prioritize/${jobId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      toast({ title: '✅ Job priorisé' });
    },
    onError: (err: Error) => {
      toast({ title: '❌ Erreur lors de la priorisation', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue Management</h1>
          <p className="text-muted-foreground">Gestion de la file d'attente des jobs</p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{data?.stats?.waiting ?? 0}</div>
            <p className="text-sm text-muted-foreground">En attente</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{data?.stats?.active ?? 0}</div>
            <p className="text-sm text-muted-foreground">En cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{data?.stats?.completed ?? 0}</div>
            <p className="text-sm text-muted-foreground">Terminés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-500">{data?.stats?.failed ?? 0}</div>
            <p className="text-sm text-muted-foreground">Échoués</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-500">{data?.stats?.delayed ?? 0}</div>
            <p className="text-sm text-muted-foreground">Différés</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs en cours ({data?.active?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.active?.length ? (
            <p className="text-muted-foreground">Aucun job en cours</p>
          ) : (
            <div className="space-y-2">
              {data.active.map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm">{job.id.slice(0, 12)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {job.data.category} • Tentative {job.attemptsMade + 1} • {formatDate(job.timestamp)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant="warning">En cours</Badge>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(job.id)}
                      title="Annuler ce job"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waiting Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs en attente ({data?.waiting?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.waiting?.length ? (
            <p className="text-muted-foreground">Aucun job en attente</p>
          ) : (
            <div className="space-y-2">
              {data.waiting.slice(0, 50).map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm">{job.id.slice(0, 12)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {job.data.category} • {formatDate(job.timestamp)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant={job.state === 'queued' ? 'warning' : 'secondary'}>
                      {job.state === 'queued' ? 'Queued' : 'Pending'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={prioritizeMutation.isPending}
                      onClick={() => prioritizeMutation.mutate(job.id)}
                      title="Passer en priorité"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(job.id)}
                      title="Annuler ce job"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Jobs échoués ({data?.failed?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.failed?.length ? (
            <p className="text-muted-foreground">Aucun job échoué</p>
          ) : (
            <div className="space-y-2">
              {data.failed.slice(0, 50).map((job) => (
                <div key={job.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm">{job.id.slice(0, 12)}...</p>
                      <p className="text-xs text-muted-foreground">
                        {job.data.category} • {job.attemptsMade} tentative(s) • {formatDate(job.timestamp)}
                      </p>
                      {job.failedReason && (
                        <div className="mt-1 flex items-start gap-1">
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                          <p className="text-xs text-red-500 break-all">{job.failedReason}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="destructive">Échoué</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryMutation.isPending}
                        onClick={() => retryMutation.mutate(job.id)}
                        title="Relancer ce job"
                      >
                        <Play className="mr-1 h-4 w-4" />
                        Relancer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
