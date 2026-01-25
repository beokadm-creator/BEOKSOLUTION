
export const DEFAULT_SOCIETY_FEATURES = {
  dashboard: true,
  infra: true,
  identity: true,
  members: true,
  templates: true,
  users: true,
  config: true,
  payment: true, // Implied from prompt
  cms: true, // Implied
};

export const APP_VERSION = 'v356';

export const SUPER_ADMINS = ['aaron@beoksolution.com', 'test@eregi.co.kr', 'any@eregi.co.kr'];

// ==========================================
// Footer Constants
// ==========================================

export const FOOTER_INFO = {
  company: 'Hong Communication',
  companyKr: '(주)홍커뮤니케이션',
  bizRegNumber: '264-81-48344',
  address: '서울시 송파구 송파대로 167, B동 319호 (문정동, 문정역테라타워)',
  phone: '02-6959-3871~3',
  fax: '02-2054-3874',
  support: 'Hong Communication',
  year: '2026',
};

// ==========================================
// UI Text Constants
// ==========================================

export const UI_TEXT = {
  upcomingEvents: {
    title: {
      ko: 'Upcoming Events',
      en: 'Upcoming Events'
    },
    subtitle: {
      ko: 'Active Conferences',
      en: 'Active Conferences'
    },
    description: {
      ko: '현재 등록 및 접수 중인 주요 학술대회 목록입니다.',
      en: 'List of currently accepting conferences.'
    }
  },
  upcomingPlans: {
    title: {
      ko: 'Upcoming Plans',
      en: 'Upcoming Plans'
    },
    subtitle: {
      ko: 'Scheduled for the Future',
      en: 'Scheduled for the Future'
    }
  },
  conference: {
    default: {
      ko: '학술대회',
      en: 'Conference'
    }
  }
};
