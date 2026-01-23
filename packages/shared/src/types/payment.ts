import { PaymentProvider, PaymentStatus } from '../enums/index.js';

export interface Payment {
  id: string;
  profileId: string;
  provider: PaymentProvider;
  providerRef: string;
  packCode: string;
  amountXof: number;
  creditsGranted: number;
  status: PaymentStatus;
  phoneE164?: string;
  rawEvent?: Record<string, unknown>;
  initiatedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentInitInput {
  profileId: string;
  packCode: string;
  provider: PaymentProvider;
  phoneE164: string;
}

export interface CreditPack {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  priceXof: number;
  active: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
