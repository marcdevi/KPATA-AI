import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Edit } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { toast } from '../components/ui/use-toast';
import { useAuthStore } from '../stores/auth';

interface ModelRouting {
  id: string;
  category: string;
  provider: string;
  model: string;
  fallback_provider: string;
  fallback_model: string;
  active: boolean;
}

interface PromptProfile {
  id: string;
  style: string;
  prompt: string;
  negative_prompt: string;
  params_json: Record<string, unknown>;
  active: boolean;
  version: number;
}

interface ConfigResponse {
  modelRouting: ModelRouting[];
  promptProfiles: PromptProfile[];
}

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuthStore();
  const [editingPrompt, setEditingPrompt] = useState<PromptProfile | null>(null);
  const [editingRouting, setEditingRouting] = useState<ModelRouting | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<ConfigResponse>('/admin/config'),
  });

  const updateRoutingMutation = useMutation({
    mutationFn: (routing: Partial<ModelRouting> & { id: string }) =>
      api.patch(`/admin/config/model-routing/${routing.id}`, routing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast({ title: 'Configuration mise à jour' });
    },
  });

  const updatePromptMutation = useMutation({
    mutationFn: (profile: Partial<PromptProfile> & { id: string }) =>
      api.patch(`/admin/config/prompt-profiles/${profile.id}`, profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setEditingPrompt(null);
      toast({ title: 'Prompt mis à jour' });
    },
  });

  const canEdit = isSuperAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuration IA</h1>
        <p className="text-muted-foreground">
          Model routing & prompt profiles
          {!canEdit && (
            <Badge variant="secondary" className="ml-2">
              Lecture seule
            </Badge>
          )}
        </p>
      </div>

      {/* Model Routing */}
      <Card>
        <CardHeader>
          <CardTitle>Model Routing</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium">Catégorie</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Modèle</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Fallback</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Statut</th>
                    {canEdit && <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {data?.modelRouting?.map((routing) => (
                    <tr key={routing.id} className="border-b">
                      <td className="px-4 py-3">{routing.category}</td>
                      <td className="px-4 py-3 font-mono text-sm">{routing.provider}</td>
                      <td className="px-4 py-3 font-mono text-sm">{routing.model}</td>
                      <td className="px-4 py-3 font-mono text-sm">{routing.fallback_model}</td>
                      <td className="px-4 py-3">
                        <Badge variant={routing.active ? 'success' : 'secondary'}>
                          {routing.active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingRouting(routing)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateRoutingMutation.mutate({
                                  id: routing.id,
                                  active: !routing.active,
                                })
                              }
                            >
                              {routing.active ? 'Désactiver' : 'Activer'}
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

      {/* Prompt Profiles */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Chargement...</p>
          ) : (
            <div className="space-y-4">
              {data?.promptProfiles?.map((profile) => (
                <div key={profile.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{profile.style}</h3>
                        <Badge variant={profile.active ? 'success' : 'secondary'}>
                          v{profile.version}
                        </Badge>
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPrompt(profile)}
                      >
                        Modifier
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Prompt:</span>
                      <p className="mt-1 rounded bg-muted p-2 font-mono text-xs">
                        {profile.prompt.slice(0, 200)}...
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Negative:</span>
                      <p className="mt-1 rounded bg-muted p-2 font-mono text-xs">
                        {profile.negative_prompt.slice(0, 100)}...
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Model Routing Modal */}
      {editingRouting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Modifier le routing: {editingRouting.category}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateRoutingMutation.mutate({
                    id: editingRouting.id,
                    provider: formData.get('provider') as string,
                    model: formData.get('model') as string,
                    fallback_provider: formData.get('fallback_provider') as string,
                    fallback_model: formData.get('fallback_model') as string,
                  });
                  setEditingRouting(null);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">Provider principal</label>
                  <input
                    name="provider"
                    defaultValue={editingRouting.provider}
                    className="mt-1 w-full rounded-md border p-2 text-sm"
                    placeholder="openrouter"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Modèle principal</label>
                  <input
                    name="model"
                    defaultValue={editingRouting.model}
                    className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
                    placeholder="google/gemini-2.5-flash-image"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Provider fallback</label>
                  <input
                    name="fallback_provider"
                    defaultValue={editingRouting.fallback_provider}
                    className="mt-1 w-full rounded-md border p-2 text-sm"
                    placeholder="openrouter"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Modèle fallback</label>
                  <input
                    name="fallback_model"
                    defaultValue={editingRouting.fallback_model}
                    className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
                    placeholder="anthropic/claude-3-haiku"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingRouting(null)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateRoutingMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Prompt Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Modifier le prompt: {editingPrompt.style}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updatePromptMutation.mutate({
                    id: editingPrompt.id,
                    prompt: formData.get('prompt') as string,
                    negative_prompt: formData.get('negative_prompt') as string,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">Prompt</label>
                  <textarea
                    name="prompt"
                    defaultValue={editingPrompt.prompt}
                    className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
                    rows={6}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Negative Prompt</label>
                  <textarea
                    name="negative_prompt"
                    defaultValue={editingPrompt.negative_prompt}
                    className="mt-1 w-full rounded-md border p-2 font-mono text-sm"
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingPrompt(null)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updatePromptMutation.isPending}>
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
