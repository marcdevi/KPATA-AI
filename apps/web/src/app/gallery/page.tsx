'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

import AppShell from '@/components/AppShell';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { getJobs } from '@/lib/api';
import { JOB_STATUS_LABELS } from '@/lib/constants';

interface Job {
  id: string;
  status: string;
  category: string;
  background_style: string;
  template_layout: string;
  created_at: string;
  thumbnail_url?: string | null;
}

export default function GalleryPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuthGuard();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    const result = await getJobs(50, 0);
    setIsLoading(false);
    if (result.data) setJobs(result.data.jobs);
  }, []);

  useEffect(() => { if (!authLoading) loadJobs(); }, [authLoading, loadJobs]);

  if (authLoading) return <LoadingScreen />;

  return (
    <AppShell>
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-black text-gray-900">Galerie</h1>
          <button onClick={loadJobs} className="text-blue-600 text-sm font-bold">
            {isLoading ? '...' : 'Actualiser'}
          </button>
        </div>

        {jobs.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center pt-24 gap-4">
            <span className="text-5xl">🖼️</span>
            <p className="text-lg font-bold text-gray-900">Aucun visuel pour le moment</p>
            <p className="text-sm text-gray-500">Crée ton premier visuel !</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {jobs.map((job) => {
              const status = JOB_STATUS_LABELS[job.status] || { label: job.status, color: '#666' };
              return (
                <button
                  key={job.id}
                  onClick={() => router.push(`/result/${job.id}`)}
                  className="bg-gray-50 rounded-xl overflow-hidden text-left"
                >
                  {job.thumbnail_url ? (
                    <img src={job.thumbnail_url} alt="thumbnail" className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-200 flex items-center justify-center">
                      <span className="text-3xl opacity-50">{job.status === 'completed' ? '🖼️' : '⏳'}</span>
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-800 capitalize">{job.category}</p>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ backgroundColor: status.color + '20', color: status.color }}
                    >
                      {status.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(job.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
