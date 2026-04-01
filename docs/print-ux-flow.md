---
precedence: 72
required-for: []
optional-for:
  - repo-orientation
memory-type: reference
token-estimate: 3150
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Normalized under the repository markdown governance schema.
---

<!-- STATIC:BEGIN -->

# UX Flow Specifications for eRegi Print System
## Admin Desk & User MyPage Workflows

---

## 1. Admin Desk (Fast Track Print Station)

### 1.1 User Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN DESK - PRINT STATION                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 FAST SEARCH                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [📝 Name/Reg#/Phone] [🔍 Search] [📱 QR Scan]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📋 SEARCH RESULTS                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ 2024-001 | 김철수 | 연사원 | 등록완료    [🖨️]    │   │
│  │ ☑ 2024-002 | 이영희 | 참가자 | 등록완료    [🖨️]    │   │
│  │ ☑ 2024-003 | 박지민 | 후원사 | 등록완료    [🖨️]    │   │
│  │ ☐ 2024-004 | 최준호 | 학생   | 미수령    [🖨️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🔧 ACTIONS                                                 │
│  [🖨️ Batch Print Selected] [📱 Mobile View] [⚙️ Settings]   │
│                                                             │
│  📊 STATUS SUMMARY                                           │
│  총 등록: 150명 | 수령 완료: 89명 | 미수령: 61명            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Search Functionality

**Fast Search Inputs:**
- **Name Search:** 한글/영문 이름으로 실시간 검색
- **Registration Number:** "2024-001" 형식으로 정확 검색
- **Phone Number:** 뒷 4자리로 빠른 검색 (예: "****1234")

**Search Performance:**
- 실시간 디바운싱 (300ms)
- 최대 100명까지 한번에 표시
- 검색 결과는 등록 상태별로 정렬 (미수령 우선)

### 1.3 Print Workflow

**One-Click Print Flow:**
1. 검색 결과에서 [🖨️] 버튼 클릭
2. 인쇄 미리보기 팝업 표시 (2초 자동 닫힘)
3. 브라우저 인쇄 대화상자 자동 열림
4. 인쇄 완료 후 상태 자동 업데이트

**Batch Print Flow:**
1. 체크박스로 다수 선택
2. [🖨️ Batch Print] 버튼 클릭
3. 인쇄 개수 확인 팝업
4. 시트 인쇄 (2x4 레이아웃)

### 1.4 Mobile View Integration

```typescript
interface AdminPrintActions {
  // Search functionality
  searchAttendees(query: SearchQuery): Promise<Attendee[]>;
  scanQRCode(): Promise<Attendee>;
  
  // Print functionality
  printSingleBadge(attendeeId: string): Promise<void>;
  printBatchBadges(attendeeIds: string[]): Promise<void>;
  printReceipt(attendeeId: string): Promise<void>;
  
  // Status management
  markAsPrinted(attendeeId: string): Promise<void>;
  getPrintStatistics(): Promise<PrintStats>;
}
```

---

## 2. User MyPage Document Access

### 2.1 Conditional Document Access Logic

```typescript
interface DocumentAccessRules {
  // 영수증: 결제 완료 시 항상 가능
  canPrintReceipt: (registration: Registration) => 
    registration.paymentStatus === 'PAID';
  
  // 명찰: 이수증과 동일 조건 또는 관리자 설정
  canPrintBadge: (registration: Registration, settings: EventSettings) =>
    settings.allowSelfBadgePrint || 
    registration.attendanceCompletionRate >= settings.minAttendanceRate;
  
  // 이수증: 행사 종료 + 출석 조건 충족
  canPrintCertificate: (registration: Registration, event: Event) => {
    const eventEnded = new Date() > new Date(event.endDate);
    const attendanceMet = registration.attendanceCompletionRate >= 75;
    const paymentComplete = registration.paymentStatus === 'PAID';
    
    return eventEnded && attendanceMet && paymentComplete;
  };
}
```

### 2.2 User MyPage Layout

```
┌─────────────────────────────────────────────────────────────┐
│                        내 등록 정보                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  👤 김철수님 (2024-001)                                     │
│  🏢 대한의료AI학회 | 👨‍💼 연사원                              │
│  💳 등록완료 | ✅ 출석률 85%                                 │
│                                                             │
│  📄 발급 가능 서류                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ [📄 영수증]           발급일: 2024.03.15          │   │
│  │ ✅ [🖨️ 명찰]             발급일: 2024.03.20          │   │
│  │ ⏳ [🏆 이수증]           조건: 행사 종료 후          │   │
│  │ ❌ [📋 증명서]          권한 없음                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📱 모바일 명찰                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 [📱 모바일 명찰 보기]                 │   │
│  │              (QR 코드 포함)                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Document Button States

**영수증 (Receipt):**
```typescript
// 항상 활성화 (결제 완료 시)
<ReceiptButton 
  status={registration.paymentStatus === 'PAID' ? 'active' : 'disabled'}
  onClick={() => printReceipt(registration.id)}
  disabled={registration.paymentStatus !== 'PAID'}
>
  📄 영수증
</ReceiptButton>
```

**명찰 (Badge):**
```typescript
// 조건부 활성화
<BadgeButton 
  status={canPrintBadge ? 'active' : 'pending'}
  onClick={() => printBadge(registration.id)}
  disabled={!canPrintBadge}
  tooltip={!canPrintBadge ? '출석률 75% 이상 필요' : undefined}
>
  🖨️ 명찰
</BadgeButton>
```

**이수증 (Certificate):**
```typescript
// 행사 종료 + 조건 충족 시 활성화
<CertificateButton 
  status={canPrintCertificate ? 'active' : 'locked'}
  onClick={() => printCertificate(registration.id)}
  disabled={!canPrintCertificate}
  tooltip={!canPrintCertificate ? getCertificateMessage() : undefined}
>
  🏆 이수증
</CertificateButton>
```

---

## 3. Print Preview Modal

### 3.1 Preview Modal Design

```typescript
interface PrintPreviewModal {
  isOpen: boolean;
  documentType: 'badge' | 'certificate' | 'receipt';
  attendeeData: Attendee;
  onPrint: () => void;
  onCancel: () => void;
}
```

**Modal Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                    🖨️ 인쇄 미리보기                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │           [명찰 미리보기 영역]                        │   │
│  │                                                     │   │
│  │           김철수                                     │   │
│  │       대한의료AI학회 연사원                           │   │
│  │                                                     │   │
│  │           [QR Code]                                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📋 인쇄 설정                                              │
│  매수: [1▼] 방향: [가로▼]                                   │
│                                                             │
│  🔘 [🖨️ 바로 인쇄]  🔘 [💾 PDF 저장]  ❌ [취소]               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Auto-close Behavior

- **관리자 모드:** 미리보기 2초 후 자동 인쇄
- **사용자 모드:** 미리보기 계속 표시 (사용자 선택)
- **모바일:** PDF 저장 우선 옵션

---

## 4. Mobile Badge View

### 4.1 Mobile Badge Component

```typescript
interface MobileBadgeProps {
  attendee: Attendee;
  qrCode: string;
  isVisible: boolean;
  onClose: () => void;
}
```

**Mobile Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                      🔙 모바일 명찰                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              대한의료AI학회 2024                       │   │
│  │                                                     │   │
│  │                                                   │   │
│  │                 김철수                               │   │
│  │               연사원 / 2024-001                      │   │
│  │                                                   │   │
│  │                                                   │   │
│  │           [QR Code - 스캔하여 인증]                   │   │
│  │                                                     │   │
│  │           📱 2024.03.20 발급                          │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [💾 이미지 저장] [📤 공유] [🖨️ 인쇄] [❌ 닫기]               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Mobile QR Integration

- **카메라 스캔:** 다른 사용자가 QR 스캔하여 정보 확인
- **NFC 태그:** NFC 지원 기기에서 탭하여 정보 전송
- **공유 기능:** 카카오톡, 문자 등으로 명찰 공유

---

## 5. Error Handling & Edge Cases

### 5.1 Print Failures

```typescript
interface PrintErrorHandling {
  // 프린터 연결 실패
  handlePrinterError: () => {
    showNotification('프린터를 연결할 수 없습니다. PDF로 저장됩니다.');
    fallbackToPDF();
  };
  
  // 용지 부족
  handlePaperError: () => {
    showNotification('용지를 보충해주세요.');
    pauseQueue();
  };
  
  // 인쇄 품질 문제
  handleQualityError: () => {
    showNotification('인쇄 품질이 낮습니다. 설정을 확인해주세요.');
    openPrintSettings();
  };
}
```

### 5.2 Access Control Violations

```typescript
interface SecurityHandling {
  // 권한 없는 접근
  handleUnauthorizedAccess: (userId: string, targetId: string) => {
    logSecurityEvent(userId, 'UNAUTHORIZED_PRINT_ACCESS', targetId);
    showSecurityAlert('접근 권한이 없습니다.');
    blockAccess();
  };
  
  // URL 조작 시도
  handleURLManipulation: (suspiciousURL: string) => {
    logSecurityEvent('URL_MANIPULATION_ATTEMPT', suspiciousURL);
    redirectToSafePage();
  };
}
```

---

## 6. Performance Optimization

### 6.1 Print Queue Management

```typescript
interface PrintQueueManager {
  // 인쇄 대기열
  queue: PrintJob[];
  maxConcurrentJobs: number = 3;
  
  // 대기열 관리
  addToQueue: (job: PrintJob) => void;
  processQueue: () => Promise<void>;
  pauseQueue: () => void;
  resumeQueue: () => void;
  
  // 우선순위 처리
  prioritizeUrgentJobs: () => void;
  estimateWaitTime: () => number;
}
```

### 6.2 Mobile Performance

```typescript
interface MobileOptimization {
  // 이미지 최적화
  optimizePrintImages: (images: ImageData[]) => Promise<OptimizedImage[]>;
  
  // 배치 처리
  batchPrintRequests: (requests: PrintRequest[]) => Promise<BatchResult>;
  
  // 캐싱
  cachePrintTemplates: () => Promise<void>;
  getCachedTemplate: (templateId: string) => Promise<Template>;
}
```

---

## 7. Accessibility Features

### 7.1 Screen Reader Support

```typescript
interface AccessibilityFeatures {
  // 키보드 내비게이션
  keyboardNavigation: {
    tabOrder: string[];
    shortcuts: Record<string, Action>;
  };
  
  // 스크린 리더 안내
  ariaLabels: {
    printButton: '명찰 인쇄하기';
    previewModal: '인쇄 미리보기 모달';
    searchInput: '참가자 검색';
  };
  
  // 고대비 모드
  highContrastMode: {
    enabled: boolean;
    customStyles: CSSProperties;
  };
}
```

### 7.2 Multi-language Support

```typescript
interface I18nPrint {
  labels: {
    badge: '명찰' | 'Badge' | '名札';
    certificate: '이수증' | 'Certificate' | '修了証';
    receipt: '영수증' | 'Receipt' | '領収書';
  };
  
  printInstructions: {
    ko: '인쇄 버튼을 눌러 명찰을 출력하세요';
    en: 'Click print button to output badge';
    ja: '印刷ボタンをクリックして名札を出力してください';
  };
}
```

---

## 8. Testing Strategy

### 8.1 User Acceptance Testing

**Test Scenarios:**
1. 관리자가 참가자를 검색하여 명찰 인쇄
2. 사용자가 MyPage에서 영수증 다운로드
3. 모바일에서 QR 코드로 명찰 확인
4. 일괄 인쇄 기능 테스트
5. 권한 없는 사용자의 접근 차단

### 8.2 Performance Testing

**Metrics:**
- 인쇄 요청 응답 시간: < 2초
- 검색 결과 로딩 시간: < 1초
- PDF 생성 시간: < 5초
- 모바일 명찰 로딩 시간: < 3초

---

이 UX 명세는 eRegi 인쇄 시스템의 사용자 경험을 최적화하고, 직관적인 관리자 데스크와 사용자 MyPage를 구현하는 것을 목표로 합니다.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
