import {
  BackgroundStyle,
  JobCategory,
  JobStatus,
  MannequinMode,
  SourceChannel,
  TemplateLayout,
} from '../enums/index.js';

export interface Job {
  id: string;
  profileId: string;
  correlationId: string;
  idempotencyKey: string;
  sourceChannel: SourceChannel;
  sourceMessageId?: string;
  clientRequestId?: string;
  category: JobCategory;
  backgroundStyle: BackgroundStyle;
  templateLayout: TemplateLayout;
  mannequinMode: MannequinMode;
  status: JobStatus;
  attemptCount: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  stageDurations?: Record<string, number>;
  providerUsed?: string;
  modelUsed?: string;
  durationMsTotal?: number;
  queuedAt?: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobCreateInput {
  profileId: string;
  idempotencyKey: string;
  category?: JobCategory;
  backgroundStyle?: BackgroundStyle;
  templateLayout?: TemplateLayout;
  mannequinMode?: MannequinMode;
  sourceChannel?: SourceChannel;
  sourceMessageId?: string;
  clientRequestId?: string;
}

export interface JobUpdateInput {
  status?: JobStatus;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  stageDurations?: Record<string, number>;
  providerUsed?: string;
  modelUsed?: string;
  durationMsTotal?: number;
  processingStartedAt?: Date;
  completedAt?: Date;
}
