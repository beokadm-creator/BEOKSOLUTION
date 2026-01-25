# 2027년 시나리오 검토: 순수 슬러그 URL 아키텍처

## 현재 구조 (방안 1 적용 후)

### URL 경로와 Firestore 문서 ID의 분리

```
URL 경로:        /2026spring
URL 슬러그:     2026spring (useParams에서 추출)
hostname:        kadd.eregi.co.kr
societyId:       kadd (hostname에서 추출)
Firestore 문서 ID: kadd_2026spring
```

### 라우팅 구조

```typescript
// App.tsx
<Route path="/:slug" element={<ConferenceLoader />} />
// URL: kadd.eregi.co.kr/2026spring → slug = '2026spring'
```

### 데이터 로드 방식

```typescript
// useConference hook (ConferenceLoader, RegistrationPage 등)
1. URL 슬러그 추출: params.slug = '2026spring'
2. hostname에서 societyId 추출: 'kadd'
3. Firestore 검색 시도 순서:
   - societies/kadd/conferences/2026spring
   - conferences/kadd_2026spring
   - conferences/2026spring (fallback by slug field)
4. confId = 찾은 문서의 ID ('kadd_2026spring')
```

```typescript
// useTranslation hook (ConferenceWideTemplate 등)
1. slug 인자: '2026spring' (ConferenceLoader에서 전달)
2. Firestore 검색:
   - conferences/2026spring (by slug field)
3. confId = '2026spring' 또는 실제 문서 ID
4. urlSlug = '2026spring' (URL 경로용)
```

## 2027년 시나리오

### 시나리오 1: 순수 슬러그 URL 유지 (권장)

```
URL 경로:        /2027spring
URL 슬러그:     2027spring
hostname:        kadd.eregi.co.kr
societyId:       kadd
Firestore 문서 ID: kadd_2027spring
```

**필요한 작업:**

1. **Firestore 문서 생성**:
   ```javascript
   // Firestore에 새 문서 생성
   await setDoc(doc(db, 'conferences', 'kadd_2027spring'), {
     id: 'kadd_2027spring',
     societyId: 'kadd',
     slug: '2027spring',
     title: { ko: '2027년 춘계학술대회', en: '2027 Spring Conference' },
     dates: {
       start: Timestamp.fromDate(new Date('2027-03-15')),
       end: Timestamp.fromDate(new Date('2027-03-17'))
     },
     // ... 기타 설정
   });
   ```

2. **하위 컬렉션 생성**:
   ```
   conferences/kadd_2027spring/
   ├── registrations
   ├── agendas
   ├── speakers
   ├── pages
   ├── settings
   │   ├── registration
   │   └── basic
   └── info
       └── general
   ```

3. **코드 수정 불필요**:
   - `getConferenceIdByDomain()` 함수는 여전히 `kadd_2026spring` 반환
   - 하지만 URL 경로는 `/:slug`이므로 `/2027spring`도 자동 처리
   - useConference/useTranslation 훅이 자동으로 올바른 문서 찾음

**장점:**
- ✅ 코드 수정 불필요 (자동 확장)
- ✅ URL 단순화 (`kadd.eregi.co.kr/2027spring`)
- ✅ 일관된 패턴 유지
- ✅ 호환성 보장 (backward/forward compatibility)

### 시나리오 2: Composite 슬러그 URL (비권장)

```
URL 경로:        /kadd_2027spring
URL 슬러그:     kadd_2027spring
hostname:        kadd.eregi.co.kr
societyId:       kadd
Firestore 문서 ID: kadd_2027spring
```

**필요한 작업:**

1. Firestore 문서 생성 (시나리오 1과 동일)

2. 코드 수정 필요 없음 (현재도 composite 슬러그 지원)

**단점:**
- ❌ URL 불필요하게 복잡함
- ❌ hostname에서 이미 societyId 알 수 있음 (중복)

## 검토 결과

### ✅ 2027년에 이상 없음

방안 1(순수 슬러그 아키텍처) 적용 후:

1. **자동 확장 가능**:
   - `/2027spring` URL 접근 → 자동으로 `conferences/kadd_2027spring` 문서 검색
   - 코드 수정 불필요

2. **유연한 검색 로직**:
   - `useConference`: 다중 경로 검색 (`societies/kadd/conferences/2027spring`, `conferences/kadd_2027spring`, `conferences/2027spring`)
   - `useTranslation`: slug 필드 검색 (`conferences/2027spring`)

3. **호환성 보장**:
   - 순수 슬러그 (`2027spring`) ✅
   - Composite 슬러그 (`kadd_2027spring`) ✅ (이전 버전과 호환)

4. **다른 학회도 동일 패턴**:
   - `kap.eregi.co.kr/2027spring` → `conferences/kap_2027spring`
   - `kadd.eregi.co.kr/2027spring` → `conferences/kadd_2027spring`

### 향후 학술대회 추가 가이드

1. **Firestore 문서 생성**:
   ```bash
   # 문서 ID: ${societyId}_${year}${season}
   # 예: kadd_2027spring, kap_2027fall
   ```

2. **URL 접근**:
   ```
   https://{societyId}.eregi.co.kr/${year}${season}
   # 예: https://kadd.eregi.co.kr/2027spring
   ```

3. **서브도메인 구성**:
   ```
   DNS 설정: kadd.eregi.co.kr → eRegi 플랫폼
   kap.eregi.co.kr → eRegi 플랫폼
   ```

4. **코드 수정 불필요**:
   - 라우팅: `/:slug` 패턴으로 모든 슬러그 처리
   - 데이터 로드: useConference/useTranslation 훅이 자동 검색

## 결론

**방안 1 적용 후 2027년 시나리오는 문제 없음.**

- ✅ 순수 슬러그 URL (`/2027spring`) 자동 지원
- ✅ 코드 수정 불필요
- ✅ 다른 학회 확장 가능
- ✅ 호환성 보장

장기적으로는 방안 3(아키텍처 재설계)을 고려할 수 있으나, 현재 구조로도 충분히 확장 가능합니다.
