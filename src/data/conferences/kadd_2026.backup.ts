import { ConferenceConfig, createDefaultConferenceConfig } from '../../types/conference';

export const kadd_2026: ConferenceConfig = {
  ...createDefaultConferenceConfig(),
  id: 'kadd_2026',
  societyId: 'kadd',
  slug: '2026spring',
  title: {
    ko: '2026년 춘계 학술대회',
    en: '2026 Spring Conference'
  },
  period: {
    start: new Date('2026-04-15'),
    end: new Date('2026-04-17'),
    abstractDeadline: new Date('2026-02-28'),
    earlyBirdDeadline: new Date('2026-03-15')
  },
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
    showSchedule: true,
    showSpeakers: true,
    multiLanguageSupport: true,
    earlyBirdEnabled: true,
    onlineAttendance: false
  },
  pricing: [
    {
      id: 'early_bird',
      name: 'Early Bird',
      prices: {
        'Member (Specialist)': 100000,
        'Member (Resident)': 50000,
        'Non-Member': 150000
      },
      currency: 'KRW',
      period: {
        start: new Date('2026-01-01'),
        end: new Date('2026-03-15')
      },
      isBestValue: true,
      discountPercentage: 20
    },
    {
      id: 'pre_registration',
      name: 'Pre-registration',
      prices: {
        'Member (Specialist)': 120000,
        'Member (Resident)': 60000,
        'Non-Member': 180000
      },
      currency: 'KRW',
      period: {
        start: new Date('2026-03-16'),
        end: new Date('2026-04-10')
      }
    },
    {
      id: 'onsite',
      name: 'On-site',
      prices: {
        'Member (Specialist)': 150000,
        'Member (Resident)': 80000,
        'Non-Member': 200000
      },
      currency: 'KRW',
      period: {
        start: new Date('2026-04-15'),
        end: new Date('2026-04-17')
      }
    }
  ],
  content: {
    hero: {
      title: {
        ko: '2026년 춘계 학술대회',
        en: '2026 Spring Conference'
      },
      subtitle: {
        ko: '새로운 도약, 함께하는 미래',
        en: 'New Leap, Future Together'
      },
      description: {
        ko: '2026년 춘계 학술대회에 오신 것을 환영합니다.',
        en: 'Welcome to the 2026 Spring Conference.'
      },
      backgroundImage: '/assets/images/kadd_2026_hero.jpg',
      ctaButtons: [
        {
          text: { ko: '사전등록하기', en: 'Register Now' },
          link: '/register',
          variant: 'primary'
        }
      ]
    },
    about: { 
      title: { ko: '학술대회 소개', en: 'About Conference' }, 
      description: { ko: '이번 학술대회는...', en: 'This conference...' } 
    },
    registration: { 
      title: { ko: '등록 안내', en: 'Registration' }, 
      description: { ko: '등록을 서두르세요.', en: 'Register early.' }, 
      deadlineText: { ko: '마감: 2026년 4월 10일', en: 'Deadline: April 10, 2026' } 
    },
    abstract: { 
      title: { ko: '초록 접수', en: 'Abstract Submission' }, 
      description: { ko: '초록을 제출해주세요.', en: 'Please submit your abstract.' }, 
      guidelines: { ko: '가이드라인...', en: 'Guidelines...' }, 
      deadline: new Date('2026-02-28') 
    },
    footer: {
      organization: { ko: '대한피부과학회', en: 'KADD' },
      address: { ko: '서울시...', en: 'Seoul...' },
      phone: { ko: '02-123-4567', en: '+82-2-123-4567' },
      email: { ko: 'kadd@kadd.or.kr', en: 'kadd@kadd.or.kr' },
      businessNumber: { ko: '123-45-67890', en: '123-45-67890' },
      representative: { ko: '홍길동', en: 'Hong Gil-dong' }
    },
    labels: {
        login: { ko: '로그인', en: 'Login' },
        logout: { ko: '로그아웃', en: 'Logout' },
        signup: { ko: '회원가입', en: 'Sign Up' },
        register: { ko: '사전등록하기', en: 'Registration' },
        checkStatus: { ko: '비회원 등록 조회', en: 'Check Status' },
        abstracts: { ko: '초록 접수/수정', en: 'Abstract Submission/Edit' },
        fees: { ko: '등록비 안내', en: 'Registration Fees' },
        program: { ko: '프로그램 일정', en: 'Program Agenda' },
        speakers: { ko: '초청 연자', en: 'Invited Speakers' },
        date: { ko: '일시', en: 'Date' },
        venue: { ko: '장소', en: 'Venue' },
        category: { ko: '구분', en: 'Category' },
        amount: { ko: '금액', en: 'Amount' },
        speaker: { ko: '연자', en: 'Speaker' },
        save: { ko: '할인', en: 'Save' },
        bestValue: { ko: '최저가', en: 'Best Value' },
        refundPolicyTitle: { ko: '환불 규정', en: 'Refund Policy' },
        dday: { ko: 'D-', en: 'D-' },
        untilDeadline: { ko: '마감까지', en: 'left' }
    }
  },
  layout: {
    type: 'wide',
    maxWidth: '7xl',
    columns: 3,
    sidebarEnabled: false
  },
  badge: {
    dimensions: { width: '90mm', height: '110mm' },
    backgroundUrl: '/assets/images/badge_bg_kadd_2026.jpg',
    layout: {
      name: { x: '50%', y: '40mm', fontSize: '24px', fontWeight: 'bold', align: 'center', color: '#000' },
      org: { x: '50%', y: '55mm', fontSize: '16px', fontWeight: 'normal', align: 'center', color: '#333' },
      category: { x: '50%', y: '80mm', fontSize: '18px', fontWeight: 'bold', align: 'center', color: '#003366' }
    },
    qr: { x: '30mm', y: '70mm', size: 80 }
  },
  receipt: {
    issuerInfo: {
      name: '대한피부과학회',
      registrationNumber: '123-45-67890',
      address: '서울시 서초구 서초대로 123',
      ceo: '홍길동'
    },
    stampUrl: '/assets/images/kadd_stamp.png'
  },
  seo: {
    title: { ko: '2026년 춘계 학술대회', en: '2026 Spring Conference' },
    description: { ko: '2026년 춘계 학술대회 공식 홈페이지입니다.', en: 'Official website for the 2026 Spring Conference.' },
    keywords: { ko: ['학술대회', '2026', '춘계'], en: ['Conference', '2026', 'Spring'] },
    ogImage: '/assets/images/og_image.jpg'
  },
  status: 'published',
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0.0'
};
