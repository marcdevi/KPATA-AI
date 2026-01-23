/**
 * Job Store for KPATA AI Mobile App
 * Manages job creation and status
 */

import { create } from 'zustand';

export interface JobOptions {
  category: string;
  backgroundStyle: string;
  templateLayout: string;
  mannequinMode: string;
}

export interface Job {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  category: string;
  backgroundStyle: string;
  templateLayout: string;
  mannequinMode: string;
  createdAt: string;
  completedAt?: string;
  thumbnailUrl?: string;
}

interface JobState {
  // Current job creation
  currentOptions: JobOptions;
  pendingJobId: string | null;
  
  // Jobs list
  jobs: Job[];
  isLoadingJobs: boolean;
  
  // Actions
  setOption: <K extends keyof JobOptions>(key: K, value: JobOptions[K]) => void;
  resetOptions: () => void;
  setPendingJob: (jobId: string | null) => void;
  setJobs: (jobs: Job[]) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  setLoadingJobs: (loading: boolean) => void;
}

const DEFAULT_OPTIONS: JobOptions = {
  category: 'clothing',
  backgroundStyle: 'studio_clean_white',
  templateLayout: 'A',
  mannequinMode: 'none',
};

export const useJobStore = create<JobState>((set) => ({
  currentOptions: { ...DEFAULT_OPTIONS },
  pendingJobId: null,
  jobs: [],
  isLoadingJobs: false,

  setOption: (key, value) => set((state) => ({
    currentOptions: { ...state.currentOptions, [key]: value },
  })),

  resetOptions: () => set({ currentOptions: { ...DEFAULT_OPTIONS } }),

  setPendingJob: (jobId) => set({ pendingJobId: jobId }),

  setJobs: (jobs) => set({ jobs }),

  updateJob: (jobId, updates) => set((state) => ({
    jobs: state.jobs.map((job) =>
      job.id === jobId ? { ...job, ...updates } : job
    ),
  })),

  setLoadingJobs: (loading) => set({ isLoadingJobs: loading }),
}));
