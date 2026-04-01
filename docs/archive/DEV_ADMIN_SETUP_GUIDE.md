---
precedence: 15
required-for: []
optional-for:
  - historical-reference
memory-type: archive
token-estimate: 822
@include:
  - ../shared/AI_DOC_SHARED_RULES.md
  - ../shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Classified as historical archive under the markdown governance schema.
---

<!-- STATIC:BEGIN -->

# Dev 환경 관리자 계정 설정 가이드

## 목표
- **이메일**: aaron@beoksolution.com
- **역할**: 슈퍼관리자 + 학회 관리자 (예시용)
- **환경**: eregi-dev (개발 환경)

---

## 🎯 Firebase Console 작업 단계

### 1. Firebase Console 접속
```
https://console.firebase.google.com/
→ eregi-dev 프로젝트 선택
```

### 2. Authentication에서 사용자 생성

#### 2.1 Authentication 페이지 이동
1. 좌측 메뉴 **Build** → **Authentication**
2. **Get started** 또는 **Sign-in method** 탭
3. **Email/Password** 활성화 (안 된 경우)
4. **Users** 탭 클릭

#### 2.2 사용자 추가
1. **Add user** 버튼 클릭
2. **User email**: `aaron@beoksolution.com`
3. **Password**: (임시 비밀번호 생성, 예: `Dev@2024!`)
4. **Phone number**: (선택사항, 생략 가능)
5. **Add user** 클릭

### 3. User UID 복사
생성된 사용자를 클릭하여 **User UID** 복사
- 예: `dJxKkabc123XYZ` 같은 형식
- 이 UID가 필요합니다!

---

## 📊 Firestore 데이터베이스 설정

Firebase Console에서 Firestore Database 설정:

### 1. Firestore Console 접속
```
eregi-dev → Build → Firestore Database
→ Collections 클릭
```

### 2. 슈퍼관리자 설정

#### 2.1 super_admins 컬렉션 생성/추가
1. **Start collection** 클릭
2. **Collection ID**: `super_admins`
3. **Auto-ID** 클릭하여 문서 ID 생성
4. **Field 추가**:
   - **Field name**: `email`
   - **Field type**: string
   - **Field value**: `aaron@beoksolution.com`
5. **Save** 클릭

완성된 문서 구조:
```javascript
{
  "email": "aaron@beoksolution.com",
  "createdAt": Firestore Timestamp (자동)
}
```

### 3. 학회 관리자 설정 (예시)

#### 3.1 societies 컬렉션에 학회 추가
1. **Start collection** 클릭
2. **Collection ID**: `societies`
3. **Auto-ID** 클릭 (예: `test_society`)
4. **Field 추가**:
   - **Field name**: `name`
   - **Field type**: string
   - **Field value**: `Test Society`
5. **Save** 클릭

#### 3.2 하위 컬렉션에 관리자 추가
`societies/test_society` 문서에서:
1. **Subcollection** 클릭
2. **Collection ID**: `admins`
3. **Add document**
4. **Field 추가**:
   - **Field name**: `email`
   - **Field type**: string
   - **Field value**: `aaron@beoksolution.com`
5. **Field 추가**:
   - **Field name**: `role`
   - **Field type**: string
   - **Field value**: `admin`
6. **Save** 클릭

완성된 구조:
```
societies/{societyId}
├── name: "Test Society"
└── admins/{uid}
    ├── email: "aaron@beoksolution.com"
    └── role: "admin"
```

---

## 🔐 보안 설정

### 비밀번호
- 생성한 비밀번호를 안전하게 저장
- 나중에 로그인 테스트에 사용

### User UID
- 이 UID로 Firestore 권한 설정
- 슈퍼관리자 문서와 학회 관리자 문서에 사용

---

## ✅ 완료 후 검증

### 1. 로그인 테스트
```
https://eregi-dev.web.app
→ 로그인 페이지
→ aaron@beoksolution.com / 설정한 비밀번호
```

### 2. 슈퍼관리자 접근
- admin.eregi-dev.web.app (또는 ?admin=true 파라미터)
- 대시보드 접근 가능해야 함

### 3. 학회 관리자 접근
- test-society.eregi-dev.web.app (또는 ?society=test_society)
- 학회 대시보드 접근 가능해야 함

---

## 📝 필요한 정보

Firebase Console에서 작업 완료 후 알려주세요:

1. **User UID**: (Authentication에서 생성된 UID)
2. **생성된 비밀번호**: (기억하기 쉬운 것으로 변경 가능)

이 두 가지만 알려주시면 추가 설정을 도와드리겠습니다!

---

## 🎯 참고: 현재 프로젝트 구조

### Firestore 구조
```
eregi-dev (Firestore Database)
├── super_admins/{uid}
│   └── email: "aaron@beoksolution.com"
│
└── societies/{societyId}
    ├── name: "학회 이름"
    └── admins/{uid}
        ├── email: "aaron@beoksolution.com"
        └── role: "admin"
```

### 역할 정의
- **슈퍼관리자**: 모든 학회 관리, 전체 설정
- **학회 관리자**: 자신 학회의 회원, 등록, 설정

---

Firebase Console에서 사용자 생성 완료 후 **User UID**를 알려주세요! 🚀

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
