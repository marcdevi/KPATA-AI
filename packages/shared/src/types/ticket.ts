import { TicketPriority, TicketStatus } from '../enums/index.js';

export interface SupportTicket {
  id: string;
  profileId: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo?: string;
  relatedJobId?: string;
  relatedPaymentId?: string;
  lastMessageAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderProfileId: string;
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: Date;
}

export interface TicketCreateInput {
  profileId: string;
  subject: string;
  priority?: TicketPriority;
  relatedJobId?: string;
  relatedPaymentId?: string;
}

export interface TicketMessageCreateInput {
  ticketId: string;
  senderProfileId: string;
  content: string;
  attachments?: string[];
  isInternal?: boolean;
}
