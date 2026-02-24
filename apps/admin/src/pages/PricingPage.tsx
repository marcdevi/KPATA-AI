import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { toast } from '../components/ui/use-toast';
import { useAuthStore } from '../stores/auth';

interface CreditPack {
  id: string;
  code: string;
  credits: number;
  price_xof: number;
  active: boolean;
}

interface PricingConfig {
  credits_per_job: number;
  margin_alert_threshold: number;
}

interface PricingResponse {
  packs: CreditPack[];
  config: PricingConfig;
}

export default function PricingPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [editingPack, setEditingPack] = useState<CreditPack | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => api.get<PricingResponse>('/admin/pricing'),
  });

  const updatePackMutation = useMutation({
    mutationFn: (pack: Partial<CreditPack> & { id: string }) =>
      api.patch(`/admin/pricing/packs/${pack.id}`, pack),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      setEditingPack(null);
      toast({ title: 'Pack mis à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (config: Partial<PricingConfig>) =>
      api.patch('/admin/pricing/config', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      toast({ title: 'Configuration mise à jour' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    },
  });

  const canEdit = isAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tarification</h1>
        <p className="text-muted-foreground">Gestion des packs de crédits et pricing</p>
      </div>

      {/* Pricing Config */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration générale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Crédits par job</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  value={data?.config?.credits_per_job ?? 1}
                  disabled
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  (fixé à 1 pour le MVP)
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Seuil alerte marge (%)</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  defaultValue={data?.config?.margin_alert_threshold ?? 20}
                  className="w-24"
                  disabled={!canEdit}
                  onBlur={(e) => {
                    if (canEdit) {
                      updateConfigMutation.mutate({
                        margin_alert_threshold: parseInt(e.target.value, 10),
                      });
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Packs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Packs de crédits</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Crédits</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Prix</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Prix/crédit</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Statut</th>
                    {canEdit && <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {data?.packs?.map((pack) => (
                    <tr key={pack.id} className="border-b">
                      <td className="px-4 py-3 font-mono">{pack.code}</td>
                      <td className="px-4 py-3">{pack.credits}</td>
                      <td className="px-4 py-3">{formatCurrency(pack.price_xof)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatCurrency(Math.round(pack.price_xof / pack.credits))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={pack.active ? 'success' : 'secondary'}>
                          {pack.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPack(pack)}
                            >
                              Modifier
                            </Button>
                            <Button
                              variant={pack.active ? 'destructive' : 'default'}
                              size="sm"
                              onClick={() =>
                                updatePackMutation.mutate({
                                  id: pack.id,
                                  active: !pack.active,
                                })
                              }
                            >
                              {pack.active ? 'Désactiver' : 'Activer'}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Pack Modal */}
      {editingPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Modifier le pack: {editingPack.code}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updatePackMutation.mutate({
                    id: editingPack.id,
                    credits: parseInt(formData.get('credits') as string, 10),
                    price_xof: parseInt(formData.get('price_xof') as string, 10),
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">Nombre de crédits</label>
                  <Input
                    name="credits"
                    type="number"
                    defaultValue={editingPack.credits}
                    min={1}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Prix (FCFA)</label>
                  <Input
                    name="price_xof"
                    type="number"
                    defaultValue={editingPack.price_xof}
                    min={100}
                    step={100}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingPack(null)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updatePackMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
