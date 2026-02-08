# 타이밍 이슈 검증 가이드

## 🎯 원래 문제
**증상**: 등록 완료 후 홈 버튼을 바로 누르면 랜딩페이지 에러(DebugScreen) 발생
**원인**: `useTranslation` 훅의 데이터 로딩 중 타이밍 레이스 컨디션

## ✅ 수정 내용
1. `ConferenceWideTemplate`: 로딩 조건 개선 (`loading || (!config && !error)`)
2. `useTranslation`: Firestore 쿼리 병렬 실행 (성능 향상)

---

## 🧪 검증 방법 (결제 없이 테스트 가능)

### 방법 1: 랜딩 페이지 직접 테스트

1. **프리뷰 URL 접속**
   ```
   https://eregi-8fc1e--test-timing-fix-owt9mzr7.web.app/2026spring
   ```

2. **페이지 새로고침 반복** (10회 이상)
   - F5 또는 Ctrl+R로 빠르게 새로고침
   - 매번 정상적으로 로딩되는지 확인
   - ❌ DebugScreen (검은 배경, "SYSTEM DISCONNECTED") 표시되면 실패
   - ✅ 정상 랜딩 페이지 표시되면 성공

3. **네트워크 제한 테스트**
   - 브라우저 개발자 도구 (F12)
   - Network 탭 → Throttling → "Slow 3G" 선택
   - 페이지 새로고침 반복
   - 로딩 스피너가 표시되다가 정상 페이지로 전환되는지 확인

### 방법 2: 브라우저 캐시 클리어 후 테스트

1. **하드 리프레시**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **시크릿 모드 테스트**
   - 새 시크릿 창에서 URL 접속
   - 캐시 없는 상태에서 첫 로딩 테스트

### 방법 3: 등록 플로우 시뮬레이션 (결제 제외)

1. **랜딩 페이지 접속**
2. **등록 모달 열기** (버튼 클릭)
3. **모달 닫기** (X 버튼 또는 ESC)
4. **다른 탭 클릭** (프로그램, 연자진 등)
5. **홈 탭으로 즉시 복귀**
6. 페이지가 정상적으로 렌더링되는지 확인

---

## 📊 성공 기준

### ✅ 성공 지표
- [ ] 페이지 새로고침 시 항상 로딩 스피너 표시
- [ ] 로딩 완료 후 정상 랜딩 페이지 표시
- [ ] DebugScreen이 **절대** 표시되지 않음
- [ ] 느린 네트워크에서도 안정적으로 로딩
- [ ] 콘솔에 `[useTranslation] Conference found` 로그 확인

### ❌ 실패 지표
- DebugScreen (검은 배경, "SYSTEM DISCONNECTED") 표시
- "Conference not found" 에러 메시지
- 무한 로딩 (스피너가 계속 돌아감)

---

## 🔍 콘솔 로그 확인 포인트

**정상 로딩 시퀀스:**
```javascript
[useTranslation] Conference found. Fetching subcollections with confId: kadd_2026spring
[useConference] ✅ SUCCESS QUERY: slug=2026spring, confId=kadd_2026spring
[ConferenceWideTemplate] Terms loaded: Array(13)
[WideContentPreview] Welcome Message Data: Object
```

**에러 발생 시:**
```javascript
[useTranslation] Conference not found
// 또는
[DebugScreen] 표시됨
```

---

## 💡 결제 위젯 에러는 무시하세요

다음 에러들은 **프리뷰 환경의 제약**이며 원래 문제와 무관합니다:
```
payment-widget:30 Uncaught (in promise) Error: selector에 해당하는 HTML 요소를 찾을 수 없습니다.
Payment Error: 결제수단이 아직 선택되지 않았어요.
```

이는 TOSS 결제 위젯이 프리뷰 도메인을 인식하지 못하거나 CSP 정책 때문입니다.
**라이브 배포 후에는 정상 작동합니다.**

---

## 🚀 최종 검증 체크리스트

- [ ] 프리뷰 URL에서 랜딩 페이지 10회 이상 새로고침 → 모두 성공
- [ ] Slow 3G 네트워크에서 5회 이상 새로고침 → 모두 성공
- [ ] 시크릿 모드에서 첫 로딩 → 성공
- [ ] 탭 전환 테스트 → 성공
- [ ] 콘솔에 에러 없음 (결제 위젯 에러 제외)

**모든 항목 통과 시 → 라이브 배포 준비 완료! ✅**
