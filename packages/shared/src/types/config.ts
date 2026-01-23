import { BackgroundStyle, JobCategory } from '../enums/index.js';

export interface ModelRouting {
  id: string;
  category: JobCategory;
  provider: string;
  model: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptProfile {
  id: string;
  style: BackgroundStyle;
  name: string;
  prompt: string;
  negativePrompt?: string;
  paramsJson: Record<string, unknown>;
  version: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingConfig {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
