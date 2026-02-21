import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Play, XCircle, ArrowUp } from 'lucide-react';

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
}

interface QueueResponse {
  stats: QueueStats;
  waiting: QueueJob[];
  active: QueueJob[];
  failed: QueueJob[];
}

export default function QueuePage() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['queue-status'],
    queryFn: () => api.get<QueueResponse>('/admin/queue/status'),
    refetchInterval: 5000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/admin/queue/retry/${jobId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      toast({ title: 'Job relancé' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/admin/queue/cancel/${jobId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      toast({ title: 'Job annulé' });
    },
  });

  const prioritizeMutation = useMutation({
    mutationFn: (jobId: string) => api.post(`/admin/queue/prioritize/${jobId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status'] });
      toast({ title: 'Job priorisé' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue Management</h1>
          <p className="text-muted-foreground">Gestion de la file d'attente BullMQ</p>
        </div>
        <Button onClick={() => refetch()}>
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
          {data?.active?.length === 0 ? (
            <p className="text-muted-foreground">Aucun job en cours</p>
          ) : (
            <div className="space-y-2">
              {data?.active?.map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-mono text-sm">{job.data.jobId?.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {job.data.category} • Tentative {job.attemptsMade + 1}
                    </p>
                  </div>
                  <Badge variant="warning">En cours</Badge>
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
          {data?.waiting?.length === 0 ? (
            <p className="text-muted-foreground">Aucun job en attente</p>
          ) : (
            <div className="space-y-2">
              {data?.waiting?.slice(0, 20).map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-mono text-sm">{job.data.jobId?.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {job.data.category} • Priorité: {job.priority}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => prioritizeMutation.mutate(job.id)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => cancelMutation.mutate(job.id)}
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
          {data?.failed?.length === 0 ? (
            <p className="text-muted-foreground">Aucun job échoué</p>
          ) : (
            <div className="space-y-2">
              {data?.failed?.slice(0, 20).map((job) => (
                <div key={job.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-mono text-sm">{job.data.jobId?.slice(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      {job.data.category} • {job.attemptsMade} tentatives
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryMutation.mutate(job.id)}
                    >
                      <Play className="mr-1 h-4 w-4" />
                      Relancer
                    </Button>
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
