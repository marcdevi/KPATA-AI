import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';

interface Job {
  id: string;
  profile_id: string;
  status: string;
  category: string;
  background_style: string;
  source_channel: string;
  attempt_count: number;
  duration_ms_total?: number;
  created_at: string;
  profiles?: { phone_e164: string };
}

interface JobsResponse {
  jobs: Job[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export default function JobsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, statusFilter],
    queryFn: () =>
      api.get<JobsResponse>(
        `/admin/jobs?limit=${limit}&offset=${page * limit}${statusFilter ? `&status=${statusFilter}` : ''}`
      ),
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary' | 'default'> = {
      delivered: 'success',
      failed: 'destructive',
      processing: 'warning',
      queued: 'secondary',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Jobs</h1>
        <p className="text-muted-foreground">Historique des traitements d'images</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <select
              className="rounded-md border px-3 py-2"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tous les statuts</option>
              <option value="queued">En attente</option>
              <option value="processing">En cours</option>
              <option value="delivered">Livrés</option>
              <option value="failed">Échoués</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Catégorie</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Style</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Tentatives</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Durée</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Chargement...
                    </td>
                  </tr>
                ) : data?.jobs?.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Aucun job trouvé
                    </td>
                  </tr>
                ) : (
                  data?.jobs?.map((job) => (
                    <tr key={job.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs">{job.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {job.profiles?.phone_e164 || '-'}
                      </td>
                      <td className="px-4 py-3">{job.category}</td>
                      <td className="px-4 py-3">{job.background_style}</td>
                      <td className="px-4 py-3">{getStatusBadge(job.status)}</td>
                      <td className="px-4 py-3">{job.attempt_count}</td>
                      <td className="px-4 py-3">
                        {job.duration_ms_total ? `${(job.duration_ms_total / 1000).toFixed(1)}s` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {data?.pagination?.total ?? 0} job(s) au total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!data || (page + 1) * limit >= data.pagination.total}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
