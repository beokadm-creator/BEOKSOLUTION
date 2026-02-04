export interface BadgeLayoutItem {
  x: string;
  y: string;
  fontSize: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  fontWeight?: string;
}

export interface BadgeConfig {
  dimensions: {
    width: string;
    height: string;
  };
  backgroundUrl: string;
  layout: {
    name: BadgeLayoutItem;
    org: BadgeLayoutItem;
    category: BadgeLayoutItem;
    [key: string]: BadgeLayoutItem; // Allow for other fields if needed
  };
  qr: {
    x: string;
    y: string;
    size: number;
  };
}

export interface ReceiptConfig {
  issuerInfo: {
    name: string;
    registrationNumber: string;
    address: string;
    ceo: string;
  };
  stampUrl: string;
}

export interface RegistrationData {
  registrationId: string;
  name: string;
  org: string;
  category: string;
  [key: string]: unknown;
}

export interface PaymentItem {
  name: string;
  amount: number;
}

export interface PaymentData {
  registrationId?: string;
  items: PaymentItem[];
  totalAmount: number;
  paymentDate: string;
  receiptNumber: string;
  payerName: string;
}
