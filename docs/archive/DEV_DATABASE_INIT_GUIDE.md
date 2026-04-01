---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 564
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# Dev 환경 데이터베이스 초기화 가이드

## 문제 상황

### ✅ 작동하는 것
- Firebase Authentication: 사용자 생성 완료
- 로그인 성공: `aaron@beoksolution.com`
- 슈퍼관리자 권한 확인: `isSuperAdmin: true`

### ❌ 문제
- Firestore Database: 빈 상태
- societies 컬렉션: 없음
- 결과: "No sid provided" 에러

---

## 🔧 해결 방법 (3가지)

### 방법 1: Firestore Export/Import (가장 추천 - 데이터 정확히 복사)

#### 1-1. Live 데이터 내보내기
```bash
firebase use eregi-8fc1e
```

Firebase Console:
1. **Firestore Database** → **탭 표** (데이터베이스)
2. 상단에 **Export 데이터** (내보내기) 클릭
3. 다음 선택:
   - **Firestore 데이터베이스**
   - **전체 내보내기** 또는 **컬렉션만 내보내기**
   - societies 컬렉션 포함되어야 함
4. **내보내기** 클릭

#### 1-2. Dev 데이터 가져오기
```bash
firebase use eregi-dev
```

Firebase Console:
1. **Firestore Database** → **탭** (데이터베이스)
2. **Import 데이터** (가져오기) 클릭
3. 내보낸 JSON 파일 선택
4. **가져오기** 클릭

---

### 방법 2: 수동으로 테스트 학회 생성 (간단)

Firebase Console → Firestore Database → Start collection:

#### societies 컬렉션에 학회 추가

##### 1. KAP 학회
```
Collection ID: societies
Document ID: kap

Fields:
- name: "Korean Academy of Periodontology"
- slug: "kap"
- societyId: "kap"
```

##### 2. KADD 학회
```
Collection ID: societies
Document ID: kadd

Fields:
- name: "Korean Academy of Defective Dentistry"
- slug: "kadd"
- societyId: "kadd"
```

#### societies/{societyId}/admins 하위 컬렉션에 관리자 추가

```
Collection ID: admins
Document ID: (생성된 User UID 입력)

Fields:
- uid: (Firebase Authentication의 User UID)
- email: "aaron@beoksolution.com"
- role: "admin"
- name: "Aaron"
```

---

### 방법 3: 스크립트로 자동화 (파이썬)

데이터를 복사할 수 있는 스크립트 작성 필요합니다.

---

## 🎯 추천 방법

### 간단하게: 방법 2 (수동 생성)
1. societies 컬렉션에 KAP, KADD 추가
2. admins 하위 컬렉션에 aaron@beoksolution.com 추가
3. 즉시 테스트 가능

### 정확하게: 방법 1 (Export/Import) 안내
1. Live 데이터 전체 내보내기
2. Dev로 가져오기
3. 라이브와 동일한 상태로 유지

---

## 🔍 User UID 찾는 방법

Firebase Console:
1. **Authentication** → **Users** 탭
2. `aaron@beoksolution.com` 사용자 클릭
3. **User UID** 복사

---

## ✅ 완료 후 테스트

```
https://eregi-dev.web.app?society=kap
→ KAP 학회 대시보드 접근
```

---

어떤 방법으로 진행하고 싶으신가요?

1. **간단하게**: 제가 해드링으로 방법 2 안내
2. **정확하게**: 방법 1 (Export/Import) 안내
3. **자동화**: 스크립트 작성 (시간 소요)

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
