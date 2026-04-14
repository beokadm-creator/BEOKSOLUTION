import type { ExternalAttendee } from '@/types/schema';

export type ExternalAttendeeDoc = ExternalAttendee;

export type ExternalAttendeeFormData = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  licenseNumber: string;
  amount: number;
  password: string;
};

export type ExternalAttendeeBulkRow = {
  name: string;
  email: string;
  phone: string;
  organization: string;
  licenseNumber?: string;
  amount?: number;
  password?: string;
};

export type ReceiptConfig = {
  issuerName: string;
  stampUrl: string;
  nextSerialNo: number;
};

export type TokenStatus = 'loading' | 'active' | 'expired' | 'issued' | 'none';
