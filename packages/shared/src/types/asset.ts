import { AssetType } from '../enums/index.js';

export interface Asset {
  id: string;
  ownerProfileId: string;
  jobId?: string;
  bucket: string;
  key: string;
  type: AssetType;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AssetCreateInput {
  ownerProfileId: string;
  jobId?: string;
  bucket: string;
  key: string;
  type: AssetType;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}
