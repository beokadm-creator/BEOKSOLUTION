# Firebase Dev 프로젝트 정보 입력 가이드

## 필요한 정보 찾는 방법

### 1. Firebase Console에서 프로젝트 열기
```
https://console.firebase.google.com/
→ eregi-dev-8fc1e 프로젝트 클릭
```

### 2. SDK 구성 정보 가져오기

#### 방법 A: 프로젝트 설정에서 (권장)
1. 좌측 **⚙️ Settings** (톱니바) 클릭
2. **General** 탭
3. 스크롤 내려서 **Your apps** 섹션 찾기
4. **Web** 아이콘 (</>) 클릭
5. **Firebase SDK snippet**에서 **Config** 확인

#### 방법 B: 앱 추가 없이 보기
1. **프로젝트 개요** 페이지
2. **</> (Web 앱에 Firebase 추가)** 아이콘 클릭
3. 앱 닉네임 임의로 입력 (예: "temp")
4. **Firebase SDK 구성** 표시에서 **config** 객체 복사

---

## 필요한 값들

### 필수 값 (7개)
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",                    // 1. API Key
  authDomain: "eregi-dev-8fc1e.firebaseapp.com",  // 2. Auth Domain
  projectId: "eregi-dev-8fc1e",           // 3. Project ID
  storageBucket: "eregi-dev-8fc1e.appspot.com",  // 4. Storage Bucket
  messagingSenderId: "123456789",        // 5. Messaging Sender ID
  appId: "1:123456789:web:abcdef",      // 6. App ID
  measurementId: "G-XXXXXXXXXX"          // 7. Measurement ID (선택)
};
```

---

## 알려주시면 될 값들

### 방법 1: config 객체 전체 복사 (가장 쉬움)
```javascript
{
  "apiKey": "...",
  "authDomain": "...",
  ...
}
```

### 방법 2: 개별 값 입력
1. **API Key**: `AIzaSy...`로 시작
2. **Auth Domain**: `eregi-dev-8fc1e.firebaseapp.com`
3. **Project ID**: `eregi-dev-8fc1e` (확인용)
4. **Storage Bucket**: `eregi-dev-8fc1e.appspot.com` 또는 `firebasestorage.app`
5. **Messaging Sender ID**: 숫자 9자리
6. **App ID**: `1:숫자:web:문자열` 형식

---

## 입력 방법

### 이 리플에 복사해서 주시면 됩니다:
```
apiKey: ...
authDomain: ...
projectId: ...
storageBucket: ...
messagingSenderId: ...
appId: ...
measurementId: ...
```

또는

```javascript
const firebaseConfig = { ... }
```

전체를 복사해서 주셔도 됩니다!
