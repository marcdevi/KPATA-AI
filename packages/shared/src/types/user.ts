import { ProfileStatus, UserRole } from '../enums/index.js';

export interface Profile {
  id: string;
  phoneE164: string;
  name?: string;
  role: UserRole;
  status: ProfileStatus;
  violationCount: number;
  banReason?: string;
  termsAcceptedAt?: Date;
  termsVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredentials {
  phone: string;
  otp?: string;
}
