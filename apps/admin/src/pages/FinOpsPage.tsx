import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';

interface FinOpsData {
  summary: {
    totalRevenue: number;
    totalCost: number;
    margin: number;
    marginPercent: number;
    marginAlert: boolean;
  };
  dailyStats: Array<{
    date: string;
    revenue: number;
    cost: number;
    margin: number;
  }>;
  modelStats: Array<{
    model: string;
    volume: number;
    avgCost: number;
    failRate: number;
  }>;
}

export default function FinOpsPage() {
  const [period, setPeriod] = useState('7d');

  const { data, isLoading } = useQuery({
    queryKey: ['finops', period],
    queryFn: () => api.get<FinOpsData>(`/admin/finops?period=${period}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FinOps Dashboard</h1>
          <p className="text-muted-foreground">Coûts IA vs revenus</p>
        </div>
        <select
          className="rounded-md border px-3 py-2"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="90d">90 derniers jours</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenu total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(data?.summary?.totalRevenue ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coût IA total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(data?.summary?.totalCost ?? 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Marge nette
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {isLoading ? '...' : formatCurrency(data?.summary?.margin ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className={data?.summary?.marginAlert ? 'border-red-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Marge %
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {data?.summary?.marginAlert && (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <span
                className={`text-2xl font-bold ${
                  data?.summary?.marginAlert ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {isLoading ? '...' : `${(data?.summary?.marginPercent ?? 0).toFixed(1)}%`}
              </span>
            </div>
            {data?.summary?.marginAlert && (
              <Badge variant="destructive" className="mt-2">
                Alerte marge basse
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue vs Cost Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenu vs Coût par jour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.dailyStats ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#22c55e"
                  name="Revenu"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#ef4444"
                  name="Coût"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Model Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Statistiques par modèle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">Modèle</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Volume</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Coût moyen</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Taux d'échec</th>
                </tr>
              </thead>
              <tbody>
                {data?.modelStats?.map((model) => (
                  <tr key={model.model} className="border-b">
                    <td className="px-4 py-3 font-mono text-sm">{model.model}</td>
                    <td className="px-4 py-3">{model.volume}</td>
                    <td className="px-4 py-3">{formatCurrency(model.avgCost)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={model.failRate > 5 ? 'destructive' : 'secondary'}>
                        {model.failRate.toFixed(1)}%
                      </Badge>
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
