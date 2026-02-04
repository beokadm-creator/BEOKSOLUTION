

export interface ConferenceTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  border: string;
}

export interface ConferencePricing {
  id: string;
  name: string;
  price?: number; // Deprecated but kept for compatibility if needed
  prices?: Record<string, number>; // New: Category-based pricing
  currency: string;
  period: {
    start: Date;
    end: Date;
  };
  isBestValue?: boolean;
  discountPercentage?: number;
}

export interface ConferenceFeatures {
  showAbstract: boolean;
  showWideHero: boolean;
  showRegistration: boolean;
  showSchedule: boolean;
  showSpeakers: boolean;
  multiLanguageSupport: boolean;
  earlyBirdEnabled: boolean;
  onlineAttendance: boolean;
}

export interface ConferenceContent {
  hero: {
    title: { [lang: string]: string };
    subtitle: { [lang: string]: string };
    description: { [lang: string]: string };
    backgroundImage: string;
    ctaButtons: {
      text: { [lang: string]: string };
      link: string;
      variant: 'primary' | 'secondary';
    }[];
  };
  about: {
    title: { [lang: string]: string };
    description: { [lang: string]: string };
  };
  registration: {
    title: { [lang: string]: string };
    description: { [lang: string]: string };
    deadlineText: { [lang: string]: string };
  };
  abstract: {
    title: { [lang: string]: string };
    description: { [lang: string]: string };
    guidelines: { [lang: string]: string };
    deadline: Date;
  };
  footer: {
    organization: { [lang: string]: string };
    address: { [lang: string]: string };
    phone: { [lang: string]: string };
    email: { [lang: string]: string };
    businessNumber: { [lang: string]: string };
    representative: { [lang: string]: string };
  };
  labels: {
    [key: string]: { [lang: string]: string };
  };
}

export interface Speaker {
  id: string;
  name: { [key: string]: string } | string;
  organization: { [key: string]: string } | string;
  bio?: { [key: string]: string } | string;
  presentationTitle?: { [key: string]: string } | string;
  photoUrl?: string;
  order?: number;
}

export interface Agenda {
  id: string;
  date?: string; // Optional because we infer from startTime
  startTime: unknown; // Timestamp or Date or String
  endTime?: unknown; // Timestamp or Date or String
  title: string;
  speaker?: string;
  location?: string;
  category?: string;
  description?: string;
}

export interface ConferenceConfig { 
  id: string; 
  title: { [key: string]: string }; 
  subtitle?: { [key: string]: string }; 
  societyId: string; 

  // ✅ [수정] 중복 제거 및 통합 (유연한 타입 any 적용) 
  // 기존의 복잡한 period 정의를 제거하고 이거 하나만 남기세요. 
  period?: unknown; 
  
  // ✅ [신규] DB 변경 대응 필드 
  dates?: { 
    start: unknown; 
    end: unknown; 
  }; 
  welcomeMessage?: { [key: string]: string }; 

  // ✅ [공통] 나머지 필드들도 유연하게 처리 
  venue?: unknown; 
  visualAssets?: unknown; 
  pricing?: unknown[]; 
  agendas?: unknown[];
  speakers?: Speaker[]; // ✅ speakers 타입 추가
  society?: unknown; 

  // 🚨 [비상구] 정의되지 않은 다른 필드들이 들어와도 에러 내지 않도록 허용 
  [key: string]: unknown; 
}

export interface ConferenceTemplateProps {
  config: ConferenceConfig;
  content: ConferenceContent;
  currentLang: string;
  onLanguageChange: (lang: string) => void;
}

// Default Configuration Factory
export const createDefaultConferenceConfig = (): Partial<ConferenceConfig> => ({
  i18n: {
    default: 'ko',
    available: ['ko', 'en'],
    fallback: 'ko'
  },
  theme: {
    primary: '#003366',
    secondary: '#002244',
    accent: '#24669e',
    background: '#f0f5fa',
    text: '#1a202c',
    border: '#e2e8f0'
  },
  features: {
    showAbstract: true,
    showWideHero: true,
    showRegistration: true,
    showSchedule: false,
    showSpeakers: false,
    multiLanguageSupport: true,
    earlyBirdEnabled: true,
    onlineAttendance: false
  },
  layout: {
    type: 'wide',
    maxWidth: '7xl',
    columns: 3,
    sidebarEnabled: false
  },
  status: 'draft',
  version: '1.0.0'
});

// Legacy interface for backward compatibility
export interface ConferenceData {
  basic: {
    title: string;
    subTitle: string;
    venue: { name: string; address: string; mapUrl?: string };
    period: { start: string; end: string }; // Formatted date strings
  };
  registration: {
    prices: Record<string, number>; // e.g., { MEMBER: 100000, NON_MEMBER: 150000 }
    deadlines: { earlyBird: Date | null; pre: Date | null };
  };
  program: Array<{
    id: string;
    date: string; // '2026-04-15'
    startTime: string; // '09:00'
    title: string;
    speaker?: string;
    details?: string; // Adding details as it was used in previous code
  }>;
}
