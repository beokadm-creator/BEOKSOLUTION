---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 1697
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# eRegi Slug 및 Conference ID 표준 규칙

> 이 문서는 eRegi 시스템에서 학술대회를 생성할 때 반드시 준수해야 하는 Slug와 Document ID 규칙을 정의합니다.

---

## 📌 핵심 원칙

### 1. 일관성 (Consistency)
- 모든 학술대회는 동일한 명명 규칙을 따라야 함
- 대소문자, 구분자 사용을 엄격히 준수

### 2. 유일성 (Uniqueness)
- `slug` 필드는 URL에서 사용되므로 유일해야 함
- 동일한 `slug`를 가진 문서가 2개 이상 존재하면 안 됨

### 3. 예측 가능성 (Predictability)
- URL을 통해 어떤 학술대회인지 쉽게 예측 가능해야 함
- `year` + `season` 조합을 사용

---

## 🏗️ 규칙 정의

### 문서 ID (Document ID)

```
형식: {societyId}_{year}{season}

예시:
- kadd_2026spring  (KADD 2026년 봄 학술대회)
- kadd_2026fall    (KADD 2026년 가을 학술대회)
- kadd_2027spring  (KADD 2027년 봄 학술대회)
- kap_2026spring   (KAP 2026년 봄 학술대회)
```

**규칙:**
| 구분 | 설명 | 규칙 |
|------|--------|------|
| **societyId** | 학회 코드 | 소문자 (`kadd`, `kap` 등) |
| **year** | 연도 | 4자리 (`2026`, `2027`) |
| **season** | 시기 | 소문자 (`spring`, `fall`) |
| **구분자** | 하이픈 | `_` (언더스코어) |

### Slug 필드

```
형식: {year}{season}

예시:
- "2026spring"  (2026년 봄 학술대회)
- "2026fall"    (2026년 가을 학술대회)
- "2027spring"  (2027년 봄 학술대회)
```

**규칙:**
| 구분 | 설명 | 규칙 |
|------|--------|------|
| **year** | 연도 | 4자리 (`2026`, `2027`) |
| **season** | 시기 | 소문자 (`spring`, `fall`) |
| **구분자** | 없음 | 없음 (연속 작성) |

---

## 📊 Firestore 데이터 구조

### Conference 문서 경로

```
collections/conferences/{confId}
```

### 필수 필드

| 필드명 | 타입 | 설명 | 예시 |
|--------|--------|--------|------|
| `id` | string | **(내부 필드, 사용하지 않음)** 문서 내부에 저장된 ID (삭제 권장) | "kadd_2026spring" |
| `slug` | string | URL 식별자 (유일해야 함) | "2026spring" |
| `societyId` | string | 학회 ID | "kadd" |
| `title` | LocalizedText | 학술대회 제목 | `{ko: "제00회 KADD 학술대회", en: "..."}` |
| `dates` | object | 시작/종료일 | `{start: Timestamp, end: Timestamp}` |
| `status` | string | 학술대회 상태 | "OPEN", "CLOSED", "ARCHIVED" |

### 서브컬렉션 구조

```
conferences/
└── {confId}/
    ├── agendas/              # 아젠다 (프로그램)
    ├── speakers/             # 연자 정보
    ├── settings/
    │   ├── registration/     # 등록 설정 (기간별 등록비)
    │   ├── identity/        # 식별 설정
    │   ├── visual/          # 시각 설정
    │   └── attendance/     # 출석 설정
    └── registrations/       # 등록 내역
```

---

## ⚠️ 금지사항 (Critical Rules)

### 1. 중복 slug 금지

```json
❌ 잘못된 예시:

// conferences/kadd_2026
{
  "id": "kadd_2026",
  "slug": "2026spring",  // ⚠️ 다른 문서와 중복!
  "societyId": "kadd"
}

// conferences/kadd_2026spring
{
  "id": "kadd_2026spring",
  "slug": "2026spring",  // ⚠️ 위와 동일한 slug!
  "societyId": "kadd"
}
```

**결과:** 쿼리 시 첫 번째 문서(`kadd_2026`)가 선택되어 데이터가 비어있음

```json
✅ 올바른 예시:

// conferences/kadd_2026spring (유일한 문서)
{
  "id": "kadd_2026spring",
  "slug": "2026spring",  // ✅ 유일한 slug
  "societyId": "kadd"
}
```

### 2. 내부 id 필드 사용 금지

**문서 내부에 `id` 필드를 저장하지 마세요.**
- Firestore는 이미 문서 ID(`doc.id`)를 관리합니다.
- 내부 `id` 필드는 혼란을 일으킬 수 있습니다.

```json
❌ 잘못된 예시:
{
  "id": "kadd_2026spring",  // ⚠️ 불필요한 내부 필드
  "slug": "2026spring",
  ...
}

✅ 올바른 예시:
{
  "slug": "2026spring",  // ✅ 내부 id 필드 없음
  "societyId": "kadd",
  ...
}
```

### 3. 대소문자 혼합 금지

```json
❌ 잘못된 예시:
{
  "id": "kap_2026Spring",  // ⚠️ S 대문자
  "slug": "2026Spring"       // ⚠️ S 대문자
}

✅ 올바른 예시:
{
  "id": "kap_2026spring",   // ✅ 소문자
  "slug": "2026spring"       // ✅ 소문자
}
```

---

## 🛠️ 개발 시 준수 사항

### 1. 쿼리 방식

코드에서 `slug` 필드로 쿼리해야 합니다:

```typescript
// ✅ 올바른 방법
const q = query(
  collection(db, 'conferences'),
  where('slug', '==', '2026spring')
);
const querySnap = await getDocs(q);
if (!querySnap.empty) {
  const docId = querySnap.docs[0].id;  // 문서 ID 추출
  const confId = docId;  // kadd_2026spring
}

// ❌ 잘못된 방법 (URL slug를 문서 ID로 직접 사용)
const docRef = doc(db, 'conferences', '2026spring');
// 이것은 실패할 수 있음 (문서 ID와 slug가 다르기 때문)
```

### 2. 서브컬렉션 경로

서브컬렉션은 **문서 ID(confId)**를 사용해야 합니다:

```typescript
// ✅ 올바른 방법
const agendasRef = collection(db, 'conferences', confId, 'agendas');
// confId = kadd_2026spring

// ❌ 잘못된 방법 (slug 사용)
const agendasRef = collection(db, 'conferences', slug, 'agendas');
// slug = 2026spring (문서 ID와 다름)
```

### 3. URL 라우팅

URL은 `slug`를 사용하지만, 데이터 로딩은 `confId`(문서 ID)를 사용합니다:

```typescript
// URL: https://kadd.eregi.co.kr/2026spring
const { slug } = useParams<{ slug: string }>();
// slug = "2026spring"

// 쿼리로 confId 찾기
const q = query(collection(db, 'conferences'), where('slug', '==', slug));
const snap = await getDocs(q);
const confId = snap.docs[0].id;  // kadd_2026spring

// 서브컬렉션 로딩 (confId 사용)
const agendas = await getDocs(collection(db, 'conferences', confId, 'agendas'));
```

---

## 📋 새 학술대회 생성 체크리스트

### Firestore Console에서 직접 생성 시

- [ ] **문서 ID 형식 확인**: `{societyId}_{year}{season}`
  - 예: `kadd_2026spring`
- [ ] **slug 필드 확인**: `{year}{season}`
  - 예: `"2026spring"`
- [ ] **societyId 필드 확인**: 학회 코드
  - 예: `"kadd"`
- [ ] **중복 slug 확인**: 동일한 `slug`를 가진 다른 문서가 없는지 확인
- [ ] **내부 id 필드 제거**: 문서 내부에 `id` 필드를 저장하지 않음
- [ ] **서브컬렉션 생성**: `agendas`, `speakers`, `settings/registration`

### 코드로 생성 시

- [ ] **문서 ID 생성**: `{societyId}_{year}{season}`
- [ ] **slug 필드 추가**: `{year}{season}`
- [ ] **societyId 필드 추가**: 학회 코드
- [ ] **중복 체크**: 이미 같은 slug가 존재하는지 확인
- [ ] **내부 id 필드 제거**: `id` 필드 추가하지 않음

---

## 🚨 문제 발생 시 진단 방법

### 1. 데이터가 안 보일 때

```
콘솔 로그:
[useTranslation] Query by slug result: FOUND (2 docs)
[useTranslation] Found via slug query. confId: kadd_2026  ← 잘못된 ID
```

**해결:**
- 중복된 `slug`를 가진 문서를 확인
- 올바른 문서만 남기고 삭제

### 2. 쿼리 실패 시

```
콘솔 로그:
[useTranslation] Query by slug result: NOT FOUND
```

**해결:**
- `slug` 필드 값 확인
- URL과 `slug`가 일치하는지 확인

### 3. 서브컬렉션이 비어있을 때

```
콘솔 로그:
[useTranslation] Agendas fetched: EMPTY
```

**해결:**
- 서브컬렉션 경로 확인: `conferences/{confId}/agendas`
- `confId`가 올바른 문서 ID인지 확인
- 실제로 데이터가 있는지 확인

---

## 📞 참고 문서

- `src/types/schema.ts` - Firestore 스키마 정의
- `src/hooks/useTranslation.ts` - Conference 데이터 로딩 로직
- `src/hooks/useConference.ts` - Conference 쿼리 로직
- `src/App.tsx` - 라우팅 설정

---

## 📌 버전 관리

- **작성일**: 2026년 1월 25일
- **버전**: 1.0.0
- **마지막 수정**: 2026년 1월 25일 (KADD 2026spring 데이터 로딩 문제 해결)

---

## ✅ 요약

| 항목 | 규칙 |
|------|--------|
| **문서 ID** | `{societyId}_{year}{season}` (예: `kadd_2026spring`) |
| **Slug** | `{year}{season}` (예: `"2026spring"`) |
| **societyId** | 학회 코드 (소문자, 예: `"kadd"`) |
| **시기** | `spring`, `fall` (소문자) |
| **년도** | 4자리 (예: `2026`) |
| **중복 slug** | ❌ 금지 |
| **내부 id 필드** | ❌ 금지 (불필요) |
| **대소문자** | ✅ 소문자만 사용 |

---

> **중요:** 이 규칙은 eRegi 시스템의 안정성과 유지보수성을 위해 반드시 준수해야 합니다.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
