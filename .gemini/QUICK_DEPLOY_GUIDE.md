# 외부 참석자 마이페이지 수정 - 빠른 배포 가이드

## 🚀 1단계: Functions 배포 (2-3분 소요)

```bash
# Functions 디렉토리로 이동
cd functions

# 배포 (특정 함수만)
firebase deploy --only functions:generateFirebaseAuthUserForExternalAttendee,functions:migrateExternalAttendeeParticipations
```

**배포 완료 확인:**
- ✅ "Deploy complete!" 메시지 확인
- ✅ Firebase Console → Functions에서 함수 확인

---

## 🔄 2단계: 기존 데이터 마이그레이션

### Firebase Console에서 실행하기

1. **Firebase Console 접속**
   - https://console.firebase.google.com
   - 프로젝트 선택

2. **Functions 섹션 이동**
   - 왼쪽 메뉴 → Functions

3. **마이그레이션 함수 찾기**
   - `migrateExternalAttendeeParticipations` 검색

4. **Dry-run 실행 (시뮬레이션)**
   - 테스트 탭 클릭
   - 다음 JSON 입력:
   ```json
   {
     "confId": "kadd_2026spring",
     "dryRun": true
   }
   ```
   - "테스트" 버튼 클릭
   - 결과 확인:
     ```json
     {
       "success": true,
       "dryRun": true,
       "results": {
         "total": 10,
         "updated": 8,
         "skipped": 2,
         "errors": []
       },
       "message": "DRY RUN: Would update 8 participation records"
     }
     ```

5. **실제 마이그레이션 실행**
   - `dryRun`을 `false`로 변경:
   ```json
   {
     "confId": "kadd_2026spring",
     "dryRun": false
   }
   ```
   - "테스트" 버튼 클릭
   - 완료 확인

---

## ✅ 3단계: 검증

### 테스트 1: 신규 외부 참석자
1. 외부 참석자 관리에서 새 참석자 등록
2. 계정 생성 확인
3. 해당 계정으로 로그인
4. **마이페이지에서 학술대회 표시 확인** ✅

### 테스트 2: 기존 외부 참석자
1. 기존 외부 참석자 계정으로 로그인
2. **마이페이지에서 학술대회 표시 확인** ✅

### 테스트 3: 전체 플로우
- [x] 바우처 페이지 접근
- [x] 인포데스크 체크인
- [x] 디지털 명찰 발행
- [x] 입출입 QR 스캔

---

## 🔍 문제 해결

### 배포 실패 시
```bash
# Firebase 로그인 확인
firebase login

# 프로젝트 확인
firebase use --add

# 다시 배포
firebase deploy --only functions:generateFirebaseAuthUserForExternalAttendee,functions:migrateExternalAttendeeParticipations
```

### 마이그레이션 실패 시
1. Firebase Console → Functions → Logs 확인
2. 에러 메시지 확인
3. 필요시 다시 실행 (멱등성 보장)

### 여전히 표시되지 않는 경우
1. 브라우저 캐시 삭제
2. 재로그인
3. Firestore에서 `users/{uid}/participations` 직접 확인

---

## 📞 지원

문제 발생 시:
1. Firebase Console → Functions → Logs 확인
2. 에러 메시지 캡처
3. `.gemini/EXTERNAL_ATTENDEE_FIX_SUMMARY.md` 참조

---

**예상 소요 시간: 총 5-10분**
- 배포: 2-3분
- 마이그레이션: 1-2분
- 검증: 2-5분
