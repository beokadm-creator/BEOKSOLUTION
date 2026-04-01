---
precedence: 83
required-for:
  - multi-tenant-routing
optional-for:
  - repo-orientation
memory-type: architecture
token-estimate: 803
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Normalized under the repository markdown governance schema.
---

<!-- STATIC:BEGIN -->

# eRegi 멀티 테넌트 아키텍처 (Multi-Tenant Architecture) 가이드

eRegi는 단일 코드베이스로 다수 학회의 시스템을 동시 운영할 수 있도록 설계된 **멀티 테넌트(Multi-Tenant) SaaS 플랫폼**입니다.
이 문서는 신규 합류한 개발자나 유지보수 담당자가 플랫폼의 핵심 아키텍처 원리인 **"동적 도메인 바인딩 매커니즘"**을 깊이 이해할 수 있도록 작성되었습니다.

---

## 1. 멀티 테넌시(Multi-Tenancy)의 종류와 채택 모델
eRegi 플랫폼은 최상위 도메인(`eregi.co.kr` 등)을 기준으로, 각 학회(Society)를 **서브도메인 기반 분할 구조**로 제공하고 있습니다.
* 예: 대한소화기내시경학회 → `kadd.eregi.co.kr`
* 예: 대한신장학회 → `ksn.eregi.co.kr`

### 1-1. 데이터베이스 구조 (Firebase Firestore)
모든 학회는 완전히 동일한 Firestore 데이터베이스 인스턴스를 공유합니다.
따라서 데이터를 조회할 때 필드 레벨이나 문서 ID(`{societyId}_{slug}`) 단에서 반드시 논리적 격리(Logical Isolation)를 보장해야 합니다.

---

## 2. 동적 도메인 라우팅 원리 (Domain-Driven Routing)

컴포넌트 단에서 하드코딩된 도메인(`abc.eregi.co.kr`)을 사용하지 않고, 호스트명에서 동적으로 학회 ID를 추출해 작동합니다.

### 2-1. `DOMAIN_CONFIG` 및 환경변수
루트 도메인 및 예외 처리 항목은 `src/utils/domainHelper.ts`에 상수 객체로 통합 관리됩니다.

```ts
export const DOMAIN_CONFIG = {
    IGNORED_SUBDOMAINS: ['www', 'admin', 'eregi'],
    IGNORED_SUFFIXES: ['.web.app', '.firebaseapp.com'],
    DEFAULT_SOCIETY: import.meta.env.VITE_DEFAULT_SOCIETY || '',
    BASE_DOMAIN: import.meta.env.VITE_BASE_DOMAIN || 'eregi.co.kr',
};
```

### 2-2. `extractSocietyFromHost(hostname)`
학회 ID(Society ID)는 사용자가 브라우저 URL 창에 입력한 도메인 명에서 추출됩니다.
* **사용 로직:** 
  1. 호스트명(예: `kadd.eregi.co.kr`)을 점(`.`)으로 파싱합니다.
  2. 첫 번째 파트(`kadd`)가 시스템 정의용 무시 키워드(`www`, `admin` 등)가 아닐 경우 학회 ID로 확정시킵니다.
  3. 실패하거나 알 수 없는 도메인일 경우 `DOMAIN_CONFIG.DEFAULT_SOCIETY` 값으로 폴백(Fallback) 됩니다. (단, 현재 프로덕션 안전을 위해 폴백은 빈 문자열로 강제되어, 잘못된 접근 시 빈 화면이 아닌 명확한 오류 페이지로 리다이렉트 시킵니다).

### 2-3. 인증 및 SSO (Single Sign-On)
세션 쿠키 및 권한 인증은 도메인 공유(Cross-Subdomain) 문제를 해결하기 위해 **루트 도메인 쿠키**로 구워집니다.
* **쿠키 로직 (`src/utils/cookie.ts`)**
  `const ROOT_DOMAIN = \`.\${DOMAIN_CONFIG.BASE_DOMAIN}\`;`
  모든 인증 토큰의 Cookie Domain은 `.eregi.co.kr`과 같이 루트 수준에 바인딩되므로, 사용자는 한 번 로그인하여 `a.eregi.co.kr`과 `b.eregi.co.kr` 양쪽 모두를 자유롭게 넘나들 수 있습니다(SSO 적용).

---

## 3. 개발/QA 가이드 (주의 사항)

기능 추가 또는 변경 시 다음 사항을 반드시 지켜주어야 시스템적 재앙(크로스 데이터 노출)을 막을 수 있습니다.

### 🛑 1. 절대 학회명 하드코딩 금지
모든 `if/else` 문과 초기 폴백 값에서 특정 학회의 텍스트(`kadd`)를 하드코딩하지 마세요.
* **Bad:** `if (!society) return 'kadd_2026spring'`
* **Good:** `const socId = extractSocietyFromHost() || ''; return \`\${socId}_2026spring\`;`

### 🛑 2. 절대 루트 도메인 하드코딩 금지
추후 납품 또는 서비스 이관 시 도메인이 `eregi.com` 등으로 바뀔 수 있음을 염두에 두십시오.
* **Bad:** `hostname === 'eregi.co.kr'`
* **Good:** `hostname === DOMAIN_CONFIG.BASE_DOMAIN`

### ✅ 3. URL Cross-Check
만약 시스템 내부에서 `window.location.replace` 등으로 리다이렉션을 발생시킨다면,
반드시 도착지의 링크가 올바른 `society`와 `DOMAIN_CONFIG.BASE_DOMAIN` 조합으로 구성되어 있는지 체크해주시기 바랍니다.

---

## 4. 로컬(Local) 개발 및 디버깅 팁
로컬 호스트(`localhost:5173`)에서는 서브도메인을 명시적으로 부여하기 어렵기 때문에 다음과 같은 두 가지 우회 방안이 적용되어 있습니다.

1. **로컬 URL Param 지원:** `?society=kadd` 형태의 Query String을 파싱해 내부적으로 `kadd` 도메인에 있는 것과 같은 효과를 제공합니다 (`App.tsx` 최상위 처리 참조).
2. **hosts 파일 조작 (Optional):** OS의 `hosts` 파일을 수정해 `127.0.0.1 kadd.eregi.local` 과 같은 형태로 편의에 맞게 테스트 로컬 도메인을 잡아 개발할 수 있습니다 (이 경우 `BASE_DOMAIN`을 `eregi.local` 로 설정).

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
