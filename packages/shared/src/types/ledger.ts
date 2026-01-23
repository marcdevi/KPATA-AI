import { LedgerEntryType } from '../enums/index.js';

export interface CreditLedgerEntry {
  id: string;
  profileId: string;
  entryType: LedgerEntryType;
  amount: number;
  jobId?: string;
  paymentId?: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateJobAndDebitResult {
  jobId: string | null;
  wasCreated: boolean;
  balanceAfter: number;
  errorCode: string | null;
}

export interface RefundResult {
  refundCreated: boolean;
  refundAmount: number;
  errorMessage: string | null;
}
