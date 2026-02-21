import { useQuery } from '@tanstack/react-query';
import { Users, Briefcase, CreditCard, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';

interface DashboardStats {
  totalUsers: number;
  activeJobs: number;
  todayRevenue: number;
  pendingTickets: number;
  queueStats: {
    waiting: number;
    active: number;
    failed: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get<DashboardStats>('/admin/dashboard/stats'),
    refetchInterval: 30000,
  });

  const statCards = [
    {
      title: 'Utilisateurs',
      value: stats?.totalUsers ?? '-',
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Jobs actifs',
      value: stats?.activeJobs ?? '-',
      icon: Briefcase,
      color: 'text-green-500',
    },
    {
      title: 'Revenu du jour',
      value: stats?.todayRevenue ? formatCurrency(stats.todayRevenue) : '-',
      icon: CreditCard,
      color: 'text-purple-500',
    },
    {
      title: 'Tickets en attente',
      value: stats?.pendingTickets ?? '-',
      icon: AlertTriangle,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vue d'ensemble de KPATA AI</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Queue Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>État de la Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">En attente</span>
                <span className="font-semibold text-yellow-500">
                  {stats?.queueStats?.waiting ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">En cours</span>
                <span className="font-semibold text-blue-500">
                  {stats?.queueStats?.active ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Échoués</span>
                <span className="font-semibold text-red-500">
                  {stats?.queueStats?.failed ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.recentActivity?.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className="flex-1">
                    <p>{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>
              )) ?? (
                <p className="text-muted-foreground">Aucune activité récente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
