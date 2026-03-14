# e-Regi 웹사이트 콘텐츠 가이드

## 🎯 웹사이트 구조 제안

이 문서는 e-Regi 시스템 소개를 위한 웹사이트 콘텐츠를 구조화한 것입니다. 각 섹션을 그대로 HTML로 변환하거나 웹페이지 디자인에 활용할 수 있습니다.

---

## 🦸 히어로 섹션 (Hero Section)

### 구성 요소
```html
<section class="hero">
  <h1>학술 행사의 모든 것을 하나로</h1>
  <p class="subtitle">
    등록부터 출결, 배지 발급까지 완전한 통합 플랫폼
  </p>
  <p class="description">
    e-Regi는 학술 단체 및 컨퍼런스 운영을 위한 종합 이벤트 관리 시스템입니다.
    수작업을 자동화하고, 실시간으로 현황을 파악하며,
    참가자와 파트너 모두에게 최고의 경험을 제공하세요.
  </p>
  <div class="cta-buttons">
    <button class="btn-primary">데모 요청</button>
    <button class="btn-secondary">더 알아보기</button>
  </div>
</section>
```

### 디자인 포인트
- **배경**: 깔끔한 그라데이션 또는 행사 현장 사진
- **강조 색상**: 브랜드 컬러 (예: #1A2980)
- **아이콘**: 등록, 결제, 출결, 배지 아이콘을 배치하여 통합感 강조

---

## 🔥 문제점 & 해결책 섹션

### 레이아웃 제안
```
┌─────────────────────────────────────────────────────────┐
│  😓 기존 방식의 문제점                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 여러 시스템│  │ 수작업    │  │ 현장 혼란 │              │
│  │ 병행      │  │ 반복      │  │          │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                         │
│              ⬇️  e-Regi로 해결                          │
│                                                         │
│  ✨ e-Regi의 해결책                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 완전한    │  │ QR코드   │  │ 실시간    │              │
│  │ 통합 플랫폼│  │ 출결      │  │ 모니터링  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

### HTML 구조
```html
<section class="problems-solutions">
  <h2>왜 e-Regi인가요?</h2>

  <div class="problems">
    <h3>😓 기존 방식의 문제점</h3>
    <div class="problem-grid">
      <div class="problem-card">
        <div class="icon">📊</div>
        <h4>여러 시스템 병행</h4>
        <p>등록은 홈페이지, 결제는 PG사, 출결은 엑셀...</p>
      </div>
      <div class="problem-card">
        <div class="icon">✍️</div>
        <h4>수작업 반복</h4>
        <p>참가자 정보를 여러 시스템에 수동 입력</p>
      </div>
      <div class="problem-card">
        <div class="icon">⏰</div>
        <h4>현장 혼란</h4>
        <p>종이 명부로 기다림과 오류 발생</p>
      </div>
    </div>
  </div>

  <div class="arrow-down">⬇️</div>

  <div class="solutions">
    <h3>✨ e-Regi의 해결책</h3>
    <div class="solution-grid">
      <div class="solution-card">
        <div class="icon">🎯</div>
        <h4>완전한 통합 플랫폼</h4>
        <p>모든 과정이 하나의 시스템에서 연동</p>
      </div>
      <div class="solution-card">
        <div class="icon">📱</div>
        <h4>QR코드 출결</h4>
        <p>10배 빠른 입장 처리 (30초 → 3초)</p>
      </div>
      <div class="solution-card">
        <div class="icon">📊</div>
        <h4>실시간 모니터링</h4>
        <p>행사 현황을 즉시 파악</p>
      </div>
    </div>
  </div>
</section>
```

---

## 🚀 핵심 기능 섹션

### 탭형 또는 카드형 레이아웃
```html
<section class="features">
  <h2>핵심 기능</h2>
  <p class="section-desc">
    행사 운영에 필요한 모든 것을 하나의 시스템으로
  </p>

  <div class="feature-tabs">
    <button class="tab active" data-tab="registration">📝 등록 & 결제</button>
    <button class="tab" data-tab="attendance">📱 출결 관리</button>
    <button class="tab" data-tab="badge">🎨 배지 시스템</button>
    <button class="tab" data-tab="society">🏛️ 학회 포털</button>
    <button class="tab" data-tab="partner">🤝 파트너 관리</button>
    <button class="tab" data-tab="analytics">📊 통계 & 분석</button>
  </div>

  <div class="feature-content">
    <!-- 등록 & 결제 -->
    <div class="feature-panel active" id="registration">
      <div class="feature-image">
        <img src="/images/feature-registration.png" alt="등록 화면">
      </div>
      <div class="feature-details">
        <h3>통합 등록 & 결제 시스템</h3>
        <ul>
          <li>✅ 회원 등급별 자동 요금 계산</li>
          <li>✅ 다양한 옵션 선택 (식사, 세션 등)</li>
          <li>✅ NICEPAY/토스페이먼츠 연동</li>
          <li>✅ 즉시 결제 승인 및 영수증 발급</li>
        </ul>
      </div>
    </div>

    <!-- 출결 관리 -->
    <div class="feature-panel" id="attendance">
      <div class="feature-image">
        <img src="/images/feature-attendance.png" alt="출결 화면">
      </div>
      <div class="feature-details">
        <h3>QR코드 기반 스마트 출결</h3>
        <ul>
          <li>✅ 3초 만에 빠른 입장 처리</li>
          <li>✅ 실시간 참가 현황 모니터링</li>
          <li>✅ 중복 체크 자동 방지</li>
          <li>✅ 모바일 스캐너로 언제 어디서나</li>
        </ul>
      </div>
    </div>

    <!-- 배지 시스템 -->
    <div class="feature-panel" id="badge">
      <div class="feature-image">
        <img src="/images/feature-badge.png" alt="배지 화면">
      </div>
      <div class="feature-details">
        <h3>커스텀 배지 발급</h3>
        <ul>
          <li>✅ 드래그앤드롭 배지 에디터</li>
          <li>✅ 휴대용 프린터 즉시 출력</li>
          <li>✅ PDF 다운로드 및 디지털 배지</li>
          <li>✅ 알림톡으로 배지 발송</li>
        </ul>
      </div>
    </div>

    <!-- 파트너 관리 -->
    <div class="feature-panel" id="partner">
      <div class="feature-image">
        <img src="/images/feature-partner.png" alt="파트너 화면">
      </div>
      <div class="feature-details">
        <h3>파트너(밴더) 지원 시스템</h3>
        <ul>
          <li>✅ 파트너 전용 독립 포털</li>
          <li>✅ QR코드로 자동 리드 수집</li>
          <li>✅ 실시간 방문자 데이터 확인</li>
          <li>✅ 스태프 간 실시간 협업</li>
        </ul>
      </div>
    </div>

    <!-- 학회 포털 -->
    <div class="feature-panel" id="society">
      <div class="feature-image">
        <img src="/images/feature-society.png" alt="학회 포털 화면">
      </div>
      <div class="feature-details">
        <h3>학회(Society) 전용 포털</h3>
        <ul>
          <li>✅ 학회별 독립 웹사이트 자동 생성</li>
          <li>✅ 서브도메인 지원 (kadd.eregi.co.kr)</li>
          <li>✅ 회원 데이터베이스 및 등급 관리</li>
          <li>✅ 모든 행사를 통합 관리</li>
        </ul>
      </div>
    </div>

    <!-- 통계 & 분석 -->
    <div class="feature-panel" id="analytics">
      <div class="feature-image">
        <img src="/images/feature-analytics.png" alt="통계 화면">
      </div>
      <div class="feature-details">
        <h3>실시간 통계 & 분석</h3>
        <ul>
          <li>✅ 라이브 대시보드로 현황 파악</li>
          <li>✅ 참가율, 결제 현황 실시간 집계</li>
          <li>✅ 엑셀로 데이터 내보내기</li>
          <li>✅ 다음 행사 기획에 활용</li>
        </ul>
      </div>
    </div>
  </div>
</section>
```

---

## 📈 도입 효과 섹션

### 수치로 보여주기 (Big Numbers)
```html
<section class="impact">
  <h2>도입 효과</h2>
  <p class="section-desc">
    실제 사용자들의 경험을 바탕으로 검증된 효과
  </p>

  <div class="impact-grid">
    <div class="impact-card">
      <div class="big-number">90%</div>
      <div class="label">업무 시간 단축</div>
      <div class="description">
        자동화된 시스템으로 운영진의 수작업을 획기적으로 줄이세요
      </div>
    </div>

    <div class="impact-card">
      <div class="big-number">10배</div>
      <div class="label">빨라진 입장 처리</div>
      <div class="description">
        30초 → 3초로 대기 시간을 획기적으로 단축
      </div>
    </div>

    <div class="impact-card">
      <div class="big-number">99%</div>
      <div class="label">오류 감소</div>
      <div class="description">
        수작업으로 인한 데이터 오류를 거의 완전히 제거
      </div>
    </div>

    <div class="impact-card">
      <div class="big-number">200h+</div>
      <div class="label">연간 절감 시간</div>
      <div class="description">
        연간 4회 행사 운영 시 약 200시간 이상 절감
      </div>
    </div>
  </div>
</section>
```

### CSS 스타일 제안
```css
.impact-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.impact-card {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 1rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
}

.big-number {
  font-size: 4rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.label {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.description {
  font-size: 1rem;
  opacity: 0.9;
}
```

---

## 🔄 비교 섹션

### 비교표 디자인
```html
<section class="comparison">
  <h2>다른 시스템과 비교</h2>
  <p class="section-desc">
    e-Regi만의 차별점을 한눈에 확인하세요
  </p>

  <div class="comparison-table-wrapper">
    <table class="comparison-table">
      <thead>
        <tr>
          <th>구분</th>
          <th class="highlight">e-Regi</th>
          <th>엑셀 + 종이</th>
          <th>타 플랫폼 A</th>
          <th>타 플랫폼 B</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>통합 관리</td>
          <td class="highlight">✅ 완전 통합</td>
          <td>❌ 각기 다름</td>
          <td>⚠️ 부분 통합</td>
          <td>⚠️ 일부만</td>
        </tr>
        <tr>
          <td>QR 출결</td>
          <td class="highlight">✅ 기본 제공</td>
          <td>❌ 수기 체크</td>
          <td>❌ 없음</td>
          <td>⚠️ 유료</td>
        </tr>
        <tr>
          <td>학회 특화</td>
          <td class="highlight">✅ 회원 등급 관리</td>
          <td>❌ 수동 계산</td>
          <td>❌ 범용</td>
          <td>❌ 범용</td>
        </tr>
        <tr>
          <td>실시간 대시보드</td>
          <td class="highlight">✅ 라이브 데이터</td>
          <td>❌ 불가능</td>
          <td>⚠️ 지연 발생</td>
          <td>❌ 없음</td>
        </tr>
        <tr>
          <td>알림톡 자동화</td>
          <td class="highlight">✅ 기본 제공</td>
          <td>❌ 수동 발송</td>
          <td>❌ 없음</td>
          <td>⚠️ 유료</td>
        </tr>
        <tr>
          <td>파트너 포털</td>
          <td class="highlight">✅ 자체 포털</td>
          <td>❌ 별도 관리</td>
          <td>❌ 없음</td>
          <td>❌ 없음</td>
        </tr>
        <tr>
          <td>리드 수집</td>
          <td class="highlight">✅ 자동 수집</td>
          <td>❌ 수동 입력</td>
          <td>❌ 없음</td>
          <td>❌ 없음</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
```

### CSS 스타일 제안
```css
.comparison-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 2rem;
}

.comparison-table th,
.comparison-table td {
  padding: 1rem;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
}

.comparison-table th.highlight {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 1.2rem;
}

.comparison-table td.highlight {
  background: #f0f9ff;
  font-weight: 600;
  color: #1e40af;
}
```

---

## 🎯 타겟 고객 섹션

### 퍼소나별 메시지
```html
<section class="target-customers">
  <h2>이런 분들께 추천드려요</h2>

  <div class="customer-grid">
    <!-- 학회 사무국장 -->
    <div class="customer-card">
      <div class="avatar">👩‍💼</div>
      <h3>학회 사무국장님</h3>
      <p class="quote">
        "연간 행사 준비하면서
        회원 관리와 등록비 계산부터
        출결 통계까지 하나로 관리하고 싶어요"
      </p>
      <ul class="benefits">
        <li>회원 등급별 자동 요금 계산</li>
        <li>통합 회원 데이터베이스</li>
        <li>연간 행사 일관성 있는 운영</li>
      </ul>
    </div>

    <!-- 행사 운영 스태프 -->
    <div class="customer-card">
      <div class="avatar">👨‍💻</div>
      <h3>행사 운영 스태프</h3>
      <p class="quote">
        "현장에서 입장 처리하고
        참가자 응대하느라
        데이터 입력까지는 무리인데..."
      </p>
      <ul class="benefits">
        <li>QR코드로 3초 입장 처리</li>
        <li>실시간 참가 현황 확인</li>
        <li>자동으로 데이터 정리</li>
      </ul>
    </div>

    <!-- 후원사 담당자 -->
    <div class="customer-card">
      <div class="avatar">🤝</div>
      <h3>후원사 담당자</h3>
      <p class="quote">
        "부스 방문자 정보를
        빠르고 정확하게 수집하고
        바로 엑셀로 받고 싶어요"
      </p>
      <ul class="benefits">
        <li>QR코드로 자동 리드 수집</li>
        <li>자체 포털에서 실시간 확인</li>
        <li>엑셀로 바로 내보내기</li>
      </ul>
    </div>
  </div>
</section>
```

---

## 🛠️ 기술 스택 섹션 (신뢰도)

### 신뢰할 수 있는 기술 강조
```html
<section class="tech-stack">
  <h2>검증된 기술로 안정적으로</h2>
  <p class="section-desc">
    최신 기술 스택으로 구축되어 안정적이고 확장 가능합니다
  </p>

  <div class="tech-categories">
    <div class="tech-category">
      <h3>Frontend</h3>
      <div class="tech-items">
        <span class="tech-tag">React 19</span>
        <span class="tech-tag">TypeScript</span>
        <span class="tech-tag">TailwindCSS</span>
      </div>
    </div>

    <div class="tech-category">
      <h3>Backend</h3>
      <div class="tech-items">
        <span class="tech-tag">Firebase</span>
        <span class="tech-tag">Cloud Functions</span>
        <span class="tech-tag">Node.js 20</span>
      </div>
    </div>

    <div class="tech-category">
      <h3>결제</h3>
      <div class="tech-items">
        <span class="tech-tag">NICEPAY</span>
        <span class="tech-tag">토스페이먼츠</span>
      </div>
    </div>

    <div class="tech-category">
      <h3>보안</h3>
      <div class="tech-items">
        <span class="tech-tag">Firebase Auth</span>
        <span class="tech-tag">App Check</span>
        <span class="tech-tag">HTTPS</span>
      </div>
    </div>
  </div>
</section>
```

---

## 📞 CTA 섹션

### 데모 요청 폼
```html
<section class="cta-section">
  <div class="cta-container">
    <div class="cta-content">
      <h2>지금 바로 시작하세요</h2>
      <p>
        무료 데모를 통해 e-Regi의 강력한 기능을
        직접 경험해보세요
      </p>

      <form class="demo-form">
        <input type="text" placeholder="이름" required>
        <input type="email" placeholder="이메일" required>
        <input type="text" placeholder="학회/기관명" required>
        <select required>
          <option value="">관심 기능 선택</option>
          <option value="registration">등록 & 결제</option>
          <option value="attendance">출결 관리</option>
          <option value="badge">배지 시스템</option>
          <option value="partner">파트너 관리</option>
          <option value="all">모든 기능</option>
        </select>
        <button type="submit" class="btn-submit">
          데모 요청하기
        </button>
      </form>

      <p class="privacy-note">
        🔒 개인정보는 데모 목적으로만 사용되며,
        안전하게 보관됩니다.
      </p>
    </div>

    <div class="cta-image">
      <img src="/images/cta-illustration.png" alt="데모 신청">
    </div>
  </div>
</section>
```

---

## 📋 푸터 섹션

```html
<footer class="site-footer">
  <div class="footer-content">
    <div class="footer-section">
      <h3>e-Regi</h3>
      <p>학술 행사의 모든 것을 하나로</p>
    </div>

    <div class="footer-section">
      <h4>제품</h4>
      <ul>
        <li><a href="#features">주요 기능</a></li>
        <li><a href="#pricing">요금제</a></li>
        <li><a href="#case-studies">도입 사례</a></li>
      </ul>
    </div>

    <div class="footer-section">
      <h4>지원</h4>
      <ul>
        <li><a href="#documentation">문서</a></li>
        <li><a href="#contact">문의하기</a></li>
        <li><a href="#faq">자주 묻는 질문</a></li>
      </ul>
    </div>

    <div class="footer-section">
      <h4>연락처</h4>
      <ul>
        <li>📧 support@eregi.com</li>
        <li>📞 02-1234-5678</li>
        <li>🕐 평일 09:00 - 18:00</li>
      </ul>
    </div>
  </div>

  <div class="footer-bottom">
    <p>&copy; 2026 e-Regi. All rights reserved.</p>
    <div class="legal-links">
      <a href="#privacy">개인정보처리방침</a>
      <a href="#terms">이용약관</a>
    </div>
  </div>
</footer>
```

---

## 🎨 디자인 가이드라인

### 색상 팔레트
```css
:root {
  /* Primary Colors */
  --primary: #1A2980;
  --primary-light: #26D0CE;
  --primary-dark: #0F1847;

  /* Accent Colors */
  --accent: #FF6B6B;
  --accent-hover: #EE5A52;

  /* Neutral Colors */
  --gray-50: #F9FAFB;
  --gray-100: #F3F4F6;
  --gray-200: #E5E7EB;
  --gray-300: #D1D5DB;
  --gray-800: #1F2937;
  --gray-900: #111827;

  /* Status Colors */
  --success: #10B981;
  --warning: #F59E0B;
  --error: #EF4444;
  --info: #3B82F6;
}
```

### 타이포그래피
```css
:root {
  /* Font Families */
  --font-primary: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-code: 'Fira Code', monospace;

  /* Font Sizes */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;
  --text-5xl: 3rem;

  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### 스페이싱
```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;
}
```

---

## 📱 반응형 디자인

### 브레이크포인트
```css
/* Mobile First Approach */
.container {
  width: 100%;
  padding: 0 var(--space-4);
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    max-width: 768px;
    margin: 0 auto;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }
}

/* Large Desktop */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
  }
}
```

---

## ⚡ 성능 최적화 팁

### 이미지 최적화
```html
<!-- WebP 형식 사용 + 반응형 이미지 -->
<picture>
  <source
    srcset="/images/hero-image.webp"
    type="image/webp">
  <source
    srcset="/images/hero-image.jpg"
    type="image/jpeg">
  <img
    src="/images/hero-image.jpg"
    alt="e-Regi 대시보드"
    loading="lazy"
    width="1200"
    height="600">
</picture>
```

### 코드 스플리팅
```javascript
// Lazy loading for feature sections
const loadFeatureSection = () => {
  import('./components/FeatureSection.js')
    .then(module => {
      // Initialize feature section
    });
};

// Load when user scrolls near
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      loadFeatureSection();
      observer.unobserve(entry.target);
    }
  });
});
```

---

## 🔍 SEO 가이드

### 메타 태그
```html
<head>
  <!-- Primary Meta Tags -->
  <title>e-Regi - 학술 행사 통합 관리 플랫폼</title>
  <meta name="title" content="e-Regi - 학술 행사 통합 관리 플랫폼">
  <meta name="description"
        content="등록, 결제, 출결, 배지 발급까지 학술 행사 운영에 필요한 모든 것을 하나로. QR코드 기반 출결 시스템으로 빠르고 정확한 참가자 관리.">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://eregi.com/">
  <meta property="og:title" content="e-Regi - 학술 행사 통합 관리 플랫폼">
  <meta property="og:description"
        content="등록부터 출결까지 완전한 통합 플랫폼으로 효율적인 행사 운영을 경험하세요.">
  <meta property="og:image" content="https://eregi.com/images/og-image.png">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://eregi.com/">
  <meta property="twitter:title" content="e-Regi - 학술 행사 통합 관리 플랫폼">
  <meta property="twitter:description"
        content="등록부터 출결까지 완전한 통합 플랫폼">
  <meta property="twitter:image" content="https://eregi.com/images/twitter-image.png">
</head>
```

### 구조화된 데이터
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "e-Regi",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "KRW"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "50"
  }
}
</script>
```

---

## 🚀 배포 체크리스트

### 런칭 전 확인사항
- [ ] 모든 링크가 정상 작동하는지 확인
- [ ] 모든 이미지가 최적화되었는지 확인
- [ ] 모바일 반응형 테스트 완료
- [ ] 크로스 브라우징 테스트 (Chrome, Firefox, Safari, Edge)
- [ ] 접근성 검사 (WCAG 2.1 AA 준수)
- [ ] 페이지 로드 속도 확인 (3초 이내)
- [ ] SEO 메타 태그 확인
- [ ] 폼 제출 테스트
- [ ] 애널리틱스 설치 (Google Analytics 등)
- [ ] SSL 인증서 확인
- [ ] 백업 및 복구 절차 확인

---

## 📝 추가 리소스

### 추천 라이브러리
- **애니메이션**: Framer Motion, GSAP
- **폼**: React Hook Form, Zod
- **이미지**: next/image (Next.js), lazysizes
- **아이콘**: Lucide React, Heroicons
- **차트**: Recharts, Chart.js

### 이미지 리소스
- 일러스트: Undraw, Storyset
- 아이콘: Iconify, Noun Project
- 사진: Unsplash, Pexels

---

이 문서를 바탕으로 웹사이트를 제작하시거나, 각 섹션을 필요에 맞게 커스터마이징하여 사용하실 수 있습니다. 디자인 시스템과 코드 예시가 포함되어 있어 개발팀이 바로 작업을 시작할 수 있습니다!
