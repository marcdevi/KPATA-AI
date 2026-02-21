import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { formatPhone, formatDate } from '../lib/utils';

interface Profile {
  id: string;
  phone_e164: string;
  name?: string;
  role: string;
  status: string;
  violation_count: number;
  created_at: string;
}

interface UsersResponse {
  profiles: Profile[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, page],
    queryFn: () =>
      api.get<UsersResponse>(
        `/admin/users?search=${encodeURIComponent(search)}&limit=${limit}&offset=${page * limit}`
      ),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      super_admin: 'destructive',
      admin: 'default',
      support_agent: 'secondary',
      user_pro: 'outline',
      user_free: 'outline',
    };
    return <Badge variant={variants[role] || 'outline'}>{role}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
      active: 'success',
      banned: 'destructive',
      deleting: 'warning',
      deleted: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground">Rechercher et gérer les utilisateurs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recherche</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par téléphone, nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Rechercher</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Téléphone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Nom</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Rôle</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Statut</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Violations</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Inscrit le</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Chargement...
                    </td>
                  </tr>
                ) : data?.profiles?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                ) : (
                  data?.profiles?.map((user) => (
                    <tr
                      key={user.id}
                      className="cursor-pointer border-b hover:bg-muted/50"
                      onClick={() => navigate(`/users/${user.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-sm">
                        {formatPhone(user.phone_e164)}
                      </td>
                      <td className="px-4 py-3">{user.name || '-'}</td>
                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                      <td className="px-4 py-3">
                        {user.violation_count > 0 ? (
                          <Badge variant="destructive">{user.violation_count}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {data?.pagination?.total ?? 0} utilisateur(s) au total
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
