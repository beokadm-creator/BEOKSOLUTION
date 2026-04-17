# 버그 수정 확인 체크리스트

## KIOSK_GATE 테스트 (GatePage.tsx)

### 테스트 시나리오 1: 다일 컨퍼런스에서 퇴장
1. 사용자 A가 4월 17일 09:00에 ENTER
2. 사용자 A가 4월 17일 13:00에 EXIT
3. **기대값**: recognizedMinutes = 240분 (4시간)
4. **확인**: `logs` 서브컬렉션의 EXIT 로그에서 `recognizedMinutes` 확인
5. **확인**: registration 문서의 `totalMinutes` 확인
6. **확인**: registration 문서의 `dailyMinutes.2026-04-17` 확인

### 테스트 시나리오 2: zone 별 퇴장
1. Main Hall에서 09:00 ENTER
2. 11:00에 Main Hall에서 EXIT → 120분 인정
3. 11:01에 Breakout Room에서 ENTER
4. 13:00에 Breakout Room에서 EXIT → 119분 인정
5. **기대값**: totalMinutes = 239분

### 테스트 시나리오 3: 동일 zone에서 재입장/재퇴장
1. Main Hall에서 09:00 ENTER
2. 10:00에 Main Hall에서 EXIT → 60분 인정
3. 10:05에 Main Hall에서 ENTER
4. 12:00에 Main Hall에서 EXIT → 55분 인정
5. **기대값**: totalMinutes = 115분

## 관리자 페이지 테스트 (AttendanceLivePage.tsx)

### 테스트 시나리오 1: 수동 입장/퇴장
1. 관리자가 사용자 선택
2. [입장] 클릭 → ENTER 로그 생성
3. [퇴장] 클릭 → EXIT 로그 생성, 시간 계산
4. **기대값**: 정상적인 시간 계산

### 테스트 시나리오 2: 퇴장 시간 조정 (⚠️ 버그 있음)
1. 사용자가 INSIDE 상태
2. [시간 조정] 클릭
3. 퇴장 시간 입력
4. **현재 버그**: 다른 날짜의 zone rule이 적용될 수 있음
5. **기대값**: 오늘 날짜의 zone rule이 적용되어야 함

## 영향 받았던 사용자 복구 확인

### 대상 사용자
- 기은정 (tamara2251@naver.com)
- 천해명 (tatagata2@hanmail.net)

### 확인 방법
```javascript
// Firebase Console에서 실행
db.collection('conferences')
  .doc('YOUR_CONF_ID')
  .collection('registrations')
  .where('totalMinutes', '==', 0)
  .get()
  .then(snap => {
    snap.forEach(doc => {
      const data = doc.data();
      console.log('ID:', doc.id);
      console.log('이름:', data.userName);
      console.log('lastCheckOut:', data.lastCheckOut?.toDate());
      console.log('logs 확인 필요');
    });
  });
```

### 복구 방법
1. 스크립트 사용: `/scripts/recalculate-affected-users.ts`
2. 수동 복구: 각 사용자의 logs를 확인 후 재계산

## 배포 후 확인

### Smoke Test
1. 테스트 사용자 등록 (또는 기존 사용자 활용)
2. KIOSK_GATE에서 스캔
3. 입장 확인
4. 1분 대기
5. 퇴장 스캔
6. **기대값**: 1분 이상 인정

### 롤백 계획
버그 발견 시:
1. 이전 버전으로 git revert
2. Firestore rules에서 어제 날짜의 zones 비우기 (임시 조치)
3. 재배포
