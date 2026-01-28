# 디자인 변경 지시서
## 회원 인증 관련 페이지 디자인 개편

---

## 📌 전제 조건

### 🔴 절대 변경 금지 사항
- **기능 로직**: 회원 인증 로직, 조건, 보안 체크 등 모든 기능 유지
- **데이터 플로우**: Firestore 쿼리, 상태 관리, 세션 처리 유지
- **유효성 검증**: 만료 체크, 사용 여부 확인, 소유자 확인 유지
- **제약 사항**: 모든 인증 제약 조건 (name + code, expiry, used 등) 유지

### ✅ 변경 가능 범위
- **UI/UX 디자인**: 레이아웃, 색상, 타이포그래피, 간격, 애니메이션
- **시각 요소**: 아이콘, 버튼, 카드, 모달, 배경
- **사용자 피드백**: 로딩 상태, 에러 메시지, 성공 메시지 디자인

---

## 🎨 디자인 가이드라인

### 1. 전반적인 분위기 (Tone & Atmosphere)
- **목표**: 학술대회에 걸맞는 전문적이고 세련된 디자인
- **키워드**: 신뢰감, 전문성, 세련됨, 명확성
- **기본 어조**: 정중하지만 편안한 톤앤매너

### 2. 컬러 팔레트 (Color Palette)
```css
/* Primary Colors (학술대회 테마) */
--primary: #003366;        /* 진파란색 (전문성) */
--primary-dark: #002244;    /* 더 어두운 파란색 */
--primary-light: #004d99;   /* 밝은 파란색 */

/* Accent Colors */
--accent: #24669e;          /* 청록색 (포인트) */
--accent-light: #3d8a94;    /* 밝은 청록색 */

/* Neutral Colors */
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;

/* Status Colors */
--success-bg: #d1fae5;
--success-text: #065f46;
--warning-bg: #fef3c7;
--warning-text: #92400e;
--error-bg: #fee2e2;
--error-text: #991b1b;
--info-bg: #dbeafe;
--info-text: #1e40af;
```

### 3. 타이포그래피 (Typography)
```css
/* Font Family */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-serif: 'Georgia', 'Times New Roman', serif;

/* Headings */
--h1-size: 2.25rem;      /* 36px */
--h1-weight: 700;
--h1-line-height: 1.2;

--h2-size: 1.75rem;      /* 28px */
--h2-weight: 600;
--h2-line-height: 1.3;

--h3-size: 1.375rem;     /* 22px */
--h3-weight: 600;
--h3-line-height: 1.4;

/* Body Text */
--body-size: 1rem;        /* 16px */
--body-weight: 400;
--body-line-height: 1.6;

/* Labels */
--label-size: 0.875rem;  /* 14px */
--label-weight: 500;
--label-line-height: 1.5;
```

### 4. 스페이싱 (Spacing)
```css
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */
--spacing-2xl: 3rem;     /* 48px */
--spacing-3xl: 4rem;     /* 64px */
```

### 5. 둥근처리 (Border Radius)
```css
--radius-sm: 0.375rem;   /* 6px */
--radius-md: 0.5rem;     /* 8px */
--radius-lg: 0.75rem;    /* 12px */
--radius-xl: 1rem;       /* 16px */
--radius-2xl: 1.5rem;    /* 24px */
--radius-full: 9999px;
```

### 6. 그림자 (Shadows)
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

---

## 📱 디자인 컴포넌트 가이드

### 1. 회원 인증 카드 (Member Verification Card)
```typescript
// 디자인 요구사항
- 최대 너비: 640px (max-w-xl)
- 패딩: 3rem (48px) 모든 방향
- 둥근처리: 1.5rem (24px)
- 배경: 흰색 (#ffffff)
- 그림자: large shadow
- 테두리: 1px solid var(--gray-200)
```

**구조**:
```
┌─────────────────────────────────────┐
│  [아이콘]                       │
│                                 │
│  h1: 회원 인증                  │
│                                 │
│  p: 설명 텍스트                  │
│                                 │
│  ┌─────────────────────────────┐  │
│  │ 이름 입력                │  │
│  └─────────────────────────────┘  │
│                                 │
│  ┌─────────────────────────────┐  │
│  │ 면허번호/회원코드 입력  │  │
│  └─────────────────────────────┘  │
│                                 │
│  [인증하기] [회원가입]          │
└─────────────────────────────────────┘
```

### 2. 버튼 디자인 (Button Design)
```css
/* Primary Button (인증하기) */
.button-primary {
  background: var(--primary);
  color: white;
  padding: 0.875rem 1.75rem;
  border-radius: var(--radius-lg);
  font-weight: 600;
  border: none;
  transition: all 0.2s ease;
}

.button-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* Secondary Button (회원가입) */
.button-secondary {
  background: white;
  color: var(--primary);
  padding: 0.875rem 1.75rem;
  border-radius: var(--radius-lg);
  font-weight: 500;
  border: 1px solid var(--primary);
  transition: all 0.2s ease;
}

.button-secondary:hover {
  background: var(--gray-50);
  border-color: var(--primary-dark);
}
```

### 3. 입력 필드 (Input Field)
```css
.input-field {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--gray-300);
  border-radius: var(--radius-md);
  font-size: var(--body-size);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
}

.input-label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: var(--label-size);
  font-weight: 500;
  color: var(--gray-700);
}

.input-hint {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--gray-500);
}
```

### 4. 아이콘 및 일러스트레이션 (Icons & Illustrations)
```typescript
// 상태 아이콘 크기
- 성공 아이콘: 4rem (64px)
- 오류 아이콘: 4rem (64px)
- 인증 아이콘: 3rem (48px)
- 소형 아이콘: 1.25rem (20px)

// 아이콘 색상
- 성공: var(--success-text) 배경 var(--success-bg)
- 오류: var(--error-text) 배경 var(--error-bg)
- 경고: var(--warning-text) 배경 var(--warning-bg)
- 정보: var(--info-text) 배경 var(--info-bg)
```

### 5. 로딩 상태 (Loading State)
```typescript
// 스피너 디자인
.spinner {
  width: 2.5rem (40px);
  height: 2.5rem;
  border: 3px solid var(--gray-200);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// 배경 오버레이
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
```

### 6. 에러 상태 (Error State)
```typescript
// 에러 카드 디자인
.error-card {
  max-width: 28rem (448px);
  padding: 2rem;
  border-radius: var(--radius-2xl);
  background: var(--error-bg);
  border: 1px solid rgba(153, 27, 27, 0.2);
  text-align: center;
}

.error-icon {
  width: 4rem;
  height: 4rem;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.error-title {
  font-size: var(--h2-size);
  font-weight: 700;
  color: var(--error-text);
  margin-bottom: 0.75rem;
}

.error-message {
  font-size: var(--body-size);
  color: var(--error-text);
  opacity: 0.9;
  margin-bottom: 2rem;
  line-height: var(--body-line-height);
}
```

### 7. 성공 상태 (Success State)
```typescript
// 성공 카드 디자인
.success-card {
  max-width: 32rem (512px);
  padding: 2.5rem;
  border-radius: var(--radius-2xl);
  background: white;
  border: 1px solid var(--gray-200);
  text-align: center;
  box-shadow: var(--shadow-xl);
}

.success-icon {
  width: 5rem;
  height: 5rem;
  background: var(--success-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  position: relative;
}

.success-icon::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--success-bg);
  opacity: 0.3;
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}

.success-title {
  font-size: var(--h1-size);
  font-weight: 800;
  color: var(--gray-900);
  margin-bottom: 0.75rem;
  letter-spacing: -0.025em;
}

.success-message {
  font-size: 1.125rem (18px);
  color: var(--gray-600);
  margin-bottom: 2rem;
  line-height: 1.7;
}
```

---

## 🎯 페이지별 디자인 요구사항

### 1. 회원 인증 페이지 (Member Verification Page)
```typescript
// 구조 요구사항
const structure = {
  header: {
    icon: 'shield-check', // Lucide 아이콘
    title: '회원 인증',
    subtitle: '소속된 학회 회원 정보를 확인합니다.'
  },
  form: {
    name: {
      label: '이름',
      placeholder: '실명을 입력해주세요',
      required: true
    },
    code: {
      label: '면허번호 또는 회원코드',
      placeholder: '면허번호 또는 회원코드 입력',
      required: true,
      hint: '회원가입 시 발급받은 코드를 입력해주세요.'
    }
  },
  actions: {
    primary: {
      text: '인증하기',
      variant: 'primary'
    },
    secondary: {
      text: '회원가입',
      variant: 'secondary',
      link: '/auth?mode=signup'
    },
    help: {
      text: '회원 인증이 안되시나요?',
      link: '/help'
    }
  }
};

// 디자인 속성
const styles = {
  container: {
    background: 'linear-gradient(135deg, #f0f5fa 0%, #dbeafe 100%)',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem'
  },
  card: {
    maxWidth: '42rem',
    width: '100%',
    padding: '3rem',
    borderRadius: '1.5rem',
    background: 'white',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    border: '1px solid rgba(0, 51, 102, 0.1)'
  }
};
```

### 2. 등록 완료 페이지 (Registration Completion Page)
```typescript
// 디자인 요구사항
const design = {
  theme: {
    primary: '#003366',      // 학술대회 테마색
    accent: '#24669e',       // 포인트 컬러
    background: 'linear-gradient(135deg, #f0f5fa 0%, #dbeafe 50%, #d1fae5 100%)'
  },
  consistency: {
    // 모든 완료 페이지에 동일한 패턴 적용
    headerIcon: 'check-circle',
    successAnimation: 'confetti',
    cardStyle: 'elevated'
  },
  elements: {
    successIcon: {
      size: '5rem',
      background: '#d1fae5',
      iconColor: '#065f46',
      animation: 'bounce-in 0.6s ease-out'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: '800',
      color: '#111827',
      letterSpacing: '-0.02em'
    },
    content: {
      fontSize: '1.125rem',
      color: '#4b5563',
      lineHeight: '1.75',
      maxWidth: '42rem'
    },
    details: {
      background: '#f3f4f6',
      padding: '1.5rem',
      borderRadius: '1rem',
      border: '1px solid #e5e7eb'
    }
  }
};
```

### 3. 회원가입 완료 페이지 (Signup Completion Page)
```typescript
// 디자인 요구사항
const design = {
  theme: {
    primary: '#003366',
    accent: '#24669e',
    background: 'linear-gradient(135deg, #dbeafe 0%, #d1fae5 100%)'
  },
  consistency: {
    // 등록 완료와 동일한 패턴
    headerIcon: 'user-plus',
    successAnimation: 'fade-in-up'
  },
  elements: {
    welcomeMessage: {
      fontSize: '1.75rem',
      fontWeight: '700',
      color: '#111827',
      marginBottom: '0.5rem'
    },
    instructions: {
      fontSize: '1rem',
      color: '#6b7280',
      marginBottom: '2rem'
    },
    nextSteps: {
      title: '다음 단계',
      items: [
        { icon: 'mail', text: '이메일 인증', description: '발송된 이메일을 확인해주세요.' },
        { icon: 'user-check', text: '회원 인증', description: '회원 정보를 완성해주세요.' },
        { icon: 'calendar', text: '학술대회 등록', description: '참가 신청을 진행해주세요.' }
      ]
    }
  }
};
```

### 4. 접근 거부 페이지 (Access Denied Page)
```typescript
// 디자인 요구사항
const design = {
  theme: {
    primary: '#991b1b',      // 에러 테마
    background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
  },
  elements: {
    errorIcon: {
      size: '4rem',
      background: 'rgba(255, 255, 255, 0.5)',
      iconColor: '#991b1b'
    },
    title: {
      fontSize: '2rem',
      fontWeight: '700',
      color: '#991b1b',
      marginBottom: '1rem'
    },
    message: {
      fontSize: '1rem',
      color: '#7f1d1d',
      marginBottom: '2rem',
      lineHeight: '1.7'
    },
    actions: {
      loginButton: {
        text: '로그인',
        variant: 'primary',
        theme: 'error'
      },
      homeButton: {
        text: '홈으로 이동',
        variant: 'secondary'
      }
    }
  }
};
```

---

## 📐 레이아웃 가이드라인

### 1. 반응형 디자인 (Responsive Design)
```css
/* Mobile (default) */
.card {
  padding: 1.5rem;
  max-width: 100%;
}

/* Tablet (768px+) */
@media (min-width: 768px) {
  .card {
    padding: 2rem;
    max-width: 42rem;
  }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .card {
    padding: 3rem;
  }
}

/* Typography Scale */
@media (max-width: 640px) {
  :root {
    --h1-size: 1.75rem;
    --h2-size: 1.5rem;
    --body-size: 0.9375rem;
  }
}
```

### 2. 접근성 (Accessibility)
```css
/* Focus States */
*:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* High Contrast Mode */
@media (prefers-contrast: high) {
  :root {
    --primary: #002244;
    --gray-500: #374151;
  }
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3. 애니메이션 (Animations)
```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide Up */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale In */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* Pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 적용
.animate-fade-in {
  animation: fadeIn 0.4s ease-out;
}

.animate-slide-up {
  animation: slideUp 0.5s ease-out;
}

.animate-scale-in {
  animation: scaleIn 0.3s ease-out;
}
```

---

## 🎨 시각적 일관성 (Visual Consistency)

### 1. 완료 페이지 패턴 (Completion Page Pattern)
```
모든 완료 페이지는 다음 구조를 따르세요:

1. 성공 아이콘 (왼쪽 상단 중앙)
   - 크기: 5rem
   - 배경: 테마 컬러
   - 애니메이션: 페이드인 + 퍼즐 효과

2. 제목 (H1)
   - 폰트: 2.5rem
   - 굵기: 800
   - 색상: 진한 회색
   - 간격: 하단 0.75rem

3. 메시지
   - 폰트: 1.125rem
   - 색상: 중간 회색
   - 간격: 하단 2rem
   - 줄 높이: 1.7

4. 상세 정보 (선택사항)
   - 배경: 회색 라이트
   - 패딩: 1.5rem
   - 둥근처리: 1rem
   - 테두리: 1px solid 라이트 그레이

5. 액션 버튼
   - 프라이머리: 테마 컬러
   - 세컨더리: 투명 배경
   - 간격: 버튼 간 1rem
```

### 2. 인증 페이지 패턴 (Auth Page Pattern)
```
모든 인증 페이지는 다음 구조를 따르세요:

1. 헤더 아이콘 (상단 중앙)
   - 크기: 3rem
   - 배경: 테마 라이트
   - 간격: 하단 1.5rem

2. 제목 (H1)
   - 폰트: 2rem
   - 굵기: 700
   - 정렬: 중앙

3. 부제목 (선택사항)
   - 폰트: 1rem
   - 색상: 중간 회색
   - 정렬: 중앙
   - 간격: 하단 2rem

4. 폼 필드
   - 라벨: 왼쪽 정렬
   - 힌트: 필드 하단
   - 간격: 필드 간 1.5rem

5. 액션 버튼
   - 전체 너비
   - 세컨더리 버튼: 프라이머리 하단
```

---

## 🎯 구현 우선순위 (Priority)

### 우선순위 1: 핵심 페이지 디자인 개편
1. ✅ 회원 인증 페이지 (Member Verification)
2. ✅ 등록 완료 페이지 (Registration Completion)
3. ✅ 회원가입 완료 페이지 (Signup Completion)

### 우선순위 2: 공통 컴포넌트 디자인
1. ✅ 버튼 컴포넌트 (Button Component)
2. ✅ 입력 필드 컴포넌트 (Input Field Component)
3. ✅ 카드 컴포넌트 (Card Component)
4. ✅ 스피너 컴포넌트 (Loading Spinner Component)

### 우선순위 3: 애니메이션 및 트랜지션
1. ✅ 페이지 전환 애니메이션
2. ✅ 성공 상태 애니메이션
3. ✅ 로딩 상태 애니메이션

---

## 🔧 기술적 요구사항 (Technical Requirements)

### 1. 프레임워크 호환성
```typescript
// Tailwind CSS 기본 클래스 활용
className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-gray-200"

// CSS 변수 사용 (커스텀 스타일 필요 시)
style={{ '--primary': '#003366' } as React.CSSProperties}
```

### 2. 아이콘 라이브러리
```typescript
// Lucide React 아이콘 사용 (이미 설치됨)
import { ShieldCheck, CheckCircle, AlertCircle, UserPlus, Mail, Calendar } from 'lucide-react';

// 아이콘 크기 가이드
<ShieldCheck size={48} />  // 3rem
<CheckCircle size={64} /> // 4rem
<AlertCircle size={40} /> // 2.5rem
```

### 3. 다크 모드 지원 (선택사항)
```css
/* Light Mode (default) */
:root {
  --primary: #003366;
  --gray-50: #f9fafb;
  --gray-900: #111827;
}

/* Dark Mode (선택사항) */
@media (prefers-color-scheme: dark) {
  :root {
    --primary: #3d8a94;
    --gray-50: #1f2937;
    --gray-900: #f9fafb;
  }
}
```

---

## 📋 체크리스트 (Implementation Checklist)

### 디자인 체크리스트
- [ ] 모든 완료 페이지에 동일한 성공 아이콘 패턴 적용
- [ ] 모든 인증 페이지에 동일한 카드 레이아웃 적용
- [ ] 일관된 컬러 팔레트 사용
- [ ] 일관된 타이포그래피 적용
- [ ] 일관된 스페이싱 적용
- [ ] 일관된 둥근처리 적용
- [ ] 일관된 그림자 적용

### 기능 체크리스트 (변경 금지)
- [ ] 회원 인증 로직 유지 (name + code 검증)
- [ ] 만료 체크 유지 (expiryDate 확인)
- [ ] 사용 여부 확인 유지 (used 플래그)
- [ ] 소유자 확인 유지 (usedBy 체크)
- [ ] 즉시 락킹 유지 (lockNow 지원)
- [ ] 비회원 경로 유지 (non-member auth)
- [ ] 데이터 플로우 유지 (Firestore 쿼리)

### 애니메이션 체크리스트
- [ ] 성공 애니메이션 (페이드인 + 스케일)
- [ ] 로딩 애니메이션 (스피너)
- [ ] 버튼 호버 애니메이션
- [ ] 페이지 전환 애니메이션

### 접근성 체크리스트
- [ ] 키보드 탐색 지원
- [ ] 스크린 리더 호환
- [ ] 고대비 모드 지원
- [ ] 감소된 모션 지원
- [ ] 포커스 상태 표시

---

## 🎨 디자인 샘플 (Design Samples)

### 샘플 1: 회원 인증 페이지
```tsx
<div className="min-h-screen bg-gradient-to-br from-[#f0f5fa] to-[#dbeafe] flex items-center justify-center p-4">
  <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-12 border border-blue-100">
    {/* 아이콘 */}
    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
      <ShieldCheck className="w-8 h-8 text-[#003366]" />
    </div>

    {/* 헤더 */}
    <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
      회원 인증
    </h1>
    <p className="text-center text-gray-600 mb-8">
      소속된 학회 회원 정보를 확인합니다.
    </p>

    {/* 폼 */}
    <form className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          이름
        </label>
        <input
          type="text"
          placeholder="실명을 입력해주세요"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          면허번호 또는 회원코드
        </label>
        <input
          type="text"
          placeholder="면허번호 또는 회원코드 입력"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
        <p className="mt-2 text-sm text-gray-500">
          회원가입 시 발급받은 코드를 입력해주세요.
        </p>
      </div>

      {/* 액션 */}
      <div className="space-y-3 pt-4">
        <button
          type="submit"
          className="w-full py-3 px-6 bg-[#003366] text-white font-semibold rounded-xl hover:bg-[#002244] transition-all shadow-lg hover:shadow-xl"
        >
          인증하기
        </button>
        <button
          type="button"
          className="w-full py-3 px-6 bg-white text-[#003366] font-semibold rounded-xl border-2 border-[#003366] hover:bg-gray-50 transition-all"
        >
          회원가입
        </button>
      </div>
    </form>
  </div>
</div>
```

### 샘플 2: 등록 완료 페이지
```tsx
<div className="min-h-screen bg-gradient-to-br from-[#f0f5fa] via-[#dbeafe] to-[#d1fae5] flex items-center justify-center p-4">
  <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-12 text-center">
    {/* 성공 아이콘 */}
    <div className="relative inline-flex mb-8">
      <div className="w-20 h-20 bg-[#d1fae5] rounded-full flex items-center justify-center animate-fade-in">
        <CheckCircle className="w-10 h-10 text-[#065f46]" />
      </div>
      <div className="absolute inset-0 bg-[#d1fae5] rounded-full animate-ping opacity-20"></div>
    </div>

    {/* 헤더 */}
    <h1 className="text-5xl font-black text-gray-900 mb-3 tracking-tight">
      등록 완료!
    </h1>
    <p className="text-xl text-gray-600 mb-10 leading-relaxed">
      학술대회 등록이 성공적으로 완료되었습니다.<br />
      아래 세부 정보를 확인해주세요.
    </p>

    {/* 세부 정보 */}
    <div className="bg-gray-50 rounded-2xl p-8 mb-8 border border-gray-200">
      {/* 등록 정보 표시 */}
    </div>

    {/* 액션 */}
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
      <button
        onClick={() => window.location.href = `/${slug}/`}
        className="w-full py-3 px-6 bg-[#003366] text-white font-semibold rounded-xl hover:bg-[#002244] transition-all shadow-lg hover:shadow-xl"
      >
        학술대회 홈페이지
      </button>
      <button
        onClick={() => window.location.href = `/${slug}/abstracts`}
        className="w-full py-3 px-6 bg-white text-[#003366] font-semibold rounded-xl border-2 border-[#003366] hover:bg-gray-50 transition-all"
      >
        초록 제출하기
      </button>
    </div>
  </div>
</div>
```

---

## 🎬 결론 (Conclusion)

### ✅ 구현 목표
1. **전문성**: 학술대회에 걸맞는 세련된 디자인
2. **일관성**: 모든 완료 페이지에 통일감 있는 디자인과 톤앤매너
3. **명확성**: 사용자가 다음 단계를 명확히 이해할 수 있는 UI/UX
4. **기능 유지**: 모든 기능 로직, 조건, 제약 사항 유지

### 🔴 절대 변경 금지
- 회원 인증 로직 (verifyMemberIdentity)
- 만료 체크 (expiryDate)
- 사용 여부 확인 (used 플래그)
- 소유자 확인 (usedBy)
- 즉시 락킹 (lockNow)
- 데이터 플로우 (Firestore 쿼리, 세션 관리)

### 📋 구현 우선순위
1. 핵심 페이지 디자인 개편 (회원 인증, 등록 완료, 회원가입 완료)
2. 공통 컴포넌트 디자인 (버튼, 입력 필드, 카드, 스피너)
3. 애니메이션 및 트랜지션

---

**이 지시서에 따라 디자인만 변경하고, 기능은 절대 변경하지 마세요.**
