import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from '../components/ui/use-toast';

interface ContentReport {
  id: string;
  reporter_id: string;
  reported_job_id: string | null;
  reported_asset_id: string | null;
  reported_profile_id: string | null;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter?: { phone_e164: string };
}

interface ReportsResponse {
  reports: ContentReport[];
  pagination: { total: number };
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports', statusFilter],
    queryFn: () => api.get<ReportsResponse>(`/admin/reports?status=${statusFilter}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: string }) =>
      api.patch(`/admin/reports/${reportId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast({ title: 'Statut mis à jour' });
      setSelectedReport(null);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'success' | 'warning' | 'secondary' | 'destructive'; label: string }> = {
      pending: { variant: 'warning', label: 'En attente' },
      reviewing: { variant: 'secondary', label: 'En cours' },
      resolved_valid: { variant: 'success', label: 'Résolu (valide)' },
      resolved_invalid: { variant: 'destructive', label: 'Résolu (invalide)' },
      dismissed: { variant: 'secondary', label: 'Rejeté' },
    };
    const config = variants[status] || { variant: 'secondary' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      nsfw: 'Contenu NSFW',
      violence: 'Violence',
      hate_speech: 'Discours haineux',
      spam: 'Spam',
      copyright: 'Violation copyright',
      other: 'Autre',
    };
    return labels[reason] || reason;
  };

  const selectedReportData = reportsData?.reports?.find(r => r.id === selectedReport);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Signalements</h1>
        <p className="text-muted-foreground">Gestion des signalements de contenu</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['pending', 'reviewing', 'resolved_valid', 'resolved_invalid', 'dismissed'].map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
          >
            {getStatusBadge(status).props.children}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Reports List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Signalements ({reportsData?.reports?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-4 text-muted-foreground">Chargement...</p>
            ) : reportsData?.reports?.length === 0 ? (
              <p className="p-4 text-muted-foreground">Aucun signalement</p>
            ) : (
              <div className="divide-y">
                {reportsData?.reports?.map((report) => (
                  <div
                    key={report.id}
                    className={`cursor-pointer p-4 hover:bg-muted/50 ${
                      selectedReport === report.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedReport(report.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{getReasonLabel(report.reason)}</p>
                        <p className="text-sm text-muted-foreground">
                          {report.reporter?.phone_e164}
                        </p>
                      </div>
                      {getStatusBadge(report.status)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Details */}
        <Card className="lg:col-span-2">
          {selectedReportData ? (
            <>
              <CardHeader>
                <CardTitle>Détails du signalement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Raison</p>
                  <p className="text-lg font-semibold">{getReasonLabel(selectedReportData.reason)}</p>
                </div>

                {selectedReportData.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p className="mt-1">{selectedReportData.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedReportData.reported_job_id && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Job ID</p>
                      <p className="font-mono text-sm">{selectedReportData.reported_job_id}</p>
                    </div>
                  )}
                  {selectedReportData.reported_profile_id && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Profile ID</p>
                      <p className="font-mono text-sm">{selectedReportData.reported_profile_id}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Statut actuel</p>
                  <div className="mt-1">{getStatusBadge(selectedReportData.status)}</div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ reportId: selectedReportData.id, status: 'reviewing' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    En cours
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ reportId: selectedReportData.id, status: 'resolved_valid' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <CheckCircle className="mr-1 h-4 w-4" />
                    Valide
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ reportId: selectedReportData.id, status: 'resolved_invalid' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    <XCircle className="mr-1 h-4 w-4" />
                    Invalide
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => updateStatusMutation.mutate({ reportId: selectedReportData.id, status: 'dismissed' })}
                    disabled={updateStatusMutation.isPending}
                  >
                    Rejeter
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex h-96 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="mx-auto mb-2 h-12 w-12" />
                <p>Sélectionnez un signalement pour voir les détails</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
