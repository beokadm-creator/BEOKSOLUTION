---
precedence: 72
required-for: []
optional-for:
  - repo-orientation
memory-type: reference
token-estimate: 4221
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Normalized under the repository markdown governance schema.
---

<!-- STATIC:BEGIN -->

# Security & Validation Policies for eRegi Print System
## Document Protection and Access Control

---

## 1. Document Security Architecture

### 1.1 Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔐 LAYER 1: Authentication & Authorization                │
│  └─ User Session Validation                                 │
│  └─ Role-Based Access Control                               │
│                                                             │
│  🔒 LAYER 2: Document Verification                           │
│  └─ Document ID & Watermark                                 │
│  └─ QR Code Authentication                                   │
│                                                             │
│  🛡️ LAYER 3: Access Control                                 │
│  └─ Owner Validation                                        │
│  └─ URL Manipulation Protection                             │
│                                                             │
│  📝 LAYER 4: Audit & Monitoring                              │
│  └─ Access Logging                                          │
│  └─ Security Event Tracking                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Authorization

### 2.1 User Session Validation

```typescript
interface SessionValidation {
  // 세션 확인
  validateSession: (sessionId: string) => Promise<SessionResult>;
  
  // 사용자 권한 확인
  checkUserPermission: (userId: string, action: string, targetId: string) => boolean;
  
  // 세션 만료 처리
  handleSessionExpiry: (sessionId: string) => void;
  
  // 관리자 권한 확인
  isAdminUser: (userId: string) => boolean;
  hasPrintPermission: (userId: string, conferenceId: string) => boolean;
}

// 세션 검증 미들웨어
const validatePrintAccess = async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.cookies.sessionId;
  const userId = req.session?.userId;
  
  if (!sessionId || !userId) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }
  
  const sessionValid = await validateSession(sessionId);
  if (!sessionValid) {
    return res.status(401).json({ error: 'Session expired' });
  }
  
  next();
};
```

### 2.2 Role-Based Access Control (RBAC)

```typescript
enum UserRole {
  ATTENDEE = 'attendee',
  SPEAKER = 'speaker',
  ORGANIZER = 'organizer',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

interface PermissionMatrix {
  [key: string]: {
    printOwnBadge: boolean;
    printOtherBadge: boolean;
    batchPrint: boolean;
    printReceipt: boolean;
    printCertificate: boolean;
    accessPrintQueue: boolean;
    managePrintSettings: boolean;
  };
}

const permissions: PermissionMatrix = {
  [UserRole.ATTENDEE]: {
    printOwnBadge: true,
    printOtherBadge: false,
    batchPrint: false,
    printReceipt: true,
    printCertificate: true,
    accessPrintQueue: false,
    managePrintSettings: false
  },
  [UserRole.ADMIN]: {
    printOwnBadge: true,
    printOtherBadge: true,
    batchPrint: true,
    printReceipt: true,
    printCertificate: true,
    accessPrintQueue: true,
    managePrintSettings: true
  }
  // ... 다른 역할들
};
```

---

## 3. Document Verification & Anti-Forgery

### 3.1 Document Watermarking System

```typescript
interface DocumentWatermark {
  // 워터마크 데이터 구조
  watermark: {
    documentId: string;           // 고유 문서 ID
    issuedAt: string;             // 발급 일시
    issuedBy: string;             // 발급자
    ipAddress: string;            // 발급 IP
    sessionId: string;            // 세션 ID
    checksum: string;             // 데이터 무결성 검증
  };
  
  // 워터마크 생성
  generateWatermark: (data: DocumentData, session: SessionData) => WatermarkData;
  
  // 워터마크 검증
  verifyWatermark: (watermark: WatermarkData) => VerificationResult;
  
  // 워터마크 렌더링
  renderWatermark: (watermark: WatermarkData, type: 'visible' | 'invisible') => string;
}

// 워터마크 생성 로직
const generateWatermark = (data: DocumentData, session: SessionData): WatermarkData => {
  const timestamp = new Date().toISOString();
  const documentId = generateUUID();
  const checksum = calculateSHA256({
    documentId,
    registrationId: data.registrationId,
    userId: session.userId,
    timestamp
  });
  
  return {
    documentId,
    issuedAt: timestamp,
    issuedBy: session.userId,
    ipAddress: session.ipAddress,
    sessionId: session.id,
    checksum
  };
};
```

### 3.2 QR Code Authentication

```typescript
interface QRAuthentication {
  // QR 코드 데이터 구조
  qrData: {
    type: 'badge' | 'certificate' | 'receipt';
    documentId: string;
    registrationId: string;
    verificationUrl: string;
    timestamp: string;
    signature: string; // 서명된 데이터
  };
  
  // QR 코드 생성
  generateQRCode: (data: DocumentData, session: SessionData) => QRCodeData;
  
  // QR 코드 검증
  verifyQRCode: (qrData: QRCodeData) => VerificationResult;
  
  // 온라인 검증
  verifyOnline: (documentId: string) => Promise<OnlineVerificationResult>;
}

// QR 코드 생성
const generateQRCode = (data: DocumentData, session: SessionData): QRCodeData => {
  const payload = {
    type: data.documentType,
    documentId: data.documentId,
    registrationId: data.registrationId,
    verificationUrl: `${process.env.API_URL}/verify/${data.documentId}`,
    timestamp: new Date().toISOString()
  };
  
  const signature = signData(payload, process.env.QR_PRIVATE_KEY);
  
  return {
    ...payload,
    signature
  };
};
```

---

## 4. Access Control Validation

### 4.1 Document Ownership Verification

```typescript
interface AccessValidation {
  // 소유권 확인
  validateDocumentOwnership: (
    userId: string,
    documentId: string,
    documentType: string
  ) => Promise<OwnershipResult>;
  
  // 접근 권한 확인
  validateAccessPermission: (
    userId: string,
    targetUserId: string,
    action: string
  ) => Promise<PermissionResult>;
  
  // URL 조작 방지
  validateURLAccess: (userId: string, requestUrl: string) => URLValidationResult;
}

// 문서 접근 검증 미들웨어
const validateDocumentAccess = async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  const { documentId, documentType } = req.params;
  
  // 자신의 문서인지 확인
  const isOwner = await validateDocumentOwnership(userId, documentId, documentType);
  
  if (!isOwner) {
    // 관리자 권한 확인
    const isAdmin = await checkAdminPermission(userId);
    if (!isAdmin) {
      logSecurityEvent(userId, 'UNAUTHORIZED_DOCUMENT_ACCESS', {
        documentId,
        documentType,
        requestUrl: req.url
      });
      return res.status(403).json({ error: 'Access denied' });
    }
  }
  
  next();
};
```

### 4.2 URL Manipulation Protection

```typescript
interface URLProtection {
  // 의심스러운 URL 패턴
  suspiciousPatterns: RegExp[];
  
  // URL 검증
  validateURL: (url: string, userId: string) => URLValidationResult;
  
  // Rate limiting
  checkRateLimit: (userId: string, endpoint: string) => RateLimitResult;
  
  // IP 기반 차단
  checkIPBlacklist: (ipAddress: string) => boolean;
}

// URL 조작 탐지
const detectURLManipulation = (requestUrl: string, userId: string): boolean => {
  const suspiciousPatterns = [
    /\.\.\/\.\.\/g,                    // Path traversal
    /[?&]id=[^&]*[^0-9a-f\-]/g,        // Invalid ID format
    /[?&]user_id=[^&]*[^0-9a-f\-]/g,   // Invalid user ID
    /[?&]document_id=[^&]*[^0-9a-f\-]/g // Invalid document ID
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(requestUrl));
};
```

---

## 5. Audit & Monitoring

### 5.1 Security Event Logging

```typescript
interface SecurityEventLogger {
  // 이벤트 로깅
  logSecurityEvent: (
    userId: string,
    eventType: SecurityEventType,
    details: EventDetails
  ) => Promise<void>;
  
  // 접근 기록
  logDocumentAccess: (
    userId: string,
    documentId: string,
    accessType: string,
    result: 'success' | 'failure'
  ) => Promise<void>;
  
  // 인쇄 기록
  logPrintActivity: (
    userId: string,
    documentId: string,
    printType: string,
    metadata: PrintMetadata
  ) => Promise<void>;
}

// 보안 이벤트 타입
enum SecurityEventType {
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  URL_MANIPULATION_ATTEMPT = 'URL_MANIPULATION_ATTEMPT',
  FORGED_DOCUMENT_ATTEMPT = 'FORGED_DOCUMENT_ATTEMPT',
  SUSPICIOUS_PRINT_PATTERN = 'SUSPICIOUS_PRINT_PATTERN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SESSION_HIJACK_ATTEMPT = 'SESSION_HIJACK_ATTEMPT'
}

// 보안 이벤트 로깅
const logSecurityEvent = async (
  userId: string,
  eventType: SecurityEventType,
  details: EventDetails
): Promise<void> => {
  const event = {
    timestamp: new Date().toISOString(),
    userId,
    eventType,
    details,
    userAgent: details.userAgent,
    ipAddress: details.ipAddress,
    sessionId: details.sessionId,
    severity: getEventSeverity(eventType)
  };
  
  await SecurityEventModel.create(event);
  
  // 심각한 이벤트는 관리자에게 알림
  if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
    await notifySecurityTeam(event);
  }
};
```

### 5.2 Anomaly Detection

```typescript
interface AnomalyDetection {
  // 비정상 패턴 탐지
  detectAnomalousPatterns: (userId: string, activities: Activity[]) => AnomalyResult;
  
  // 인쇄 패턴 분석
  analyzePrintPatterns: (userId: string, timeWindow: number) => PatternAnalysis;
  
  // 지리적 위치 기반 탐지
  detectLocationAnomaly: (userId: string, ipAddress: string) => LocationAnomaly;
  
  // 시간 기반 이상 행동 탐지
  detectTemporalAnomaly: (userId: string, timestamp: Date) => TemporalAnomaly;
}

// 비정상 인쇄 패턴 탐지
const detectSuspiciousPrintPatterns = (userId: string): boolean => {
  const recentPrints = getRecentPrintActivities(userId, 60 * 60 * 1000); // 1시간
  
  // 1시간 내 10개 이상 문서 인쇄
  if (recentPrints.length > 10) {
    logSecurityEvent(userId, SecurityEventType.SUSPICIOUS_PRINT_PATTERN, {
      printCount: recentPrints.length,
      timeWindow: '1 hour'
    });
    return true;
  }
  
  // 다른 사용자 문서 다수 인쇄 시도
  const otherUserPrints = recentPrints.filter(print => print.ownerId !== userId);
  if (otherUserPrints.length > 5) {
    logSecurityEvent(userId, SecurityEventType.UNAUTHORIZED_ACCESS, {
      attemptedAccess: otherUserPrints.length,
      timeWindow: '1 hour'
    });
    return true;
  }
  
  return false;
};
```

---

## 6. Data Protection & Privacy

### 6.1 Personal Information Protection

```typescript
interface PrivacyProtection {
  // 개인정보 마스킹
  maskPersonalInfo: (data: PersonalData, viewerRole: UserRole) => MaskedData;
  
  // 데이터 최소화
  minimizeDataCollection: (requestData: PrintRequest) => MinimizedData;
  
  // 데이터 보존 정책
  applyDataRetentionPolicy: (documentId: string) => Promise<void>;
  
  // 동의 관리
  handleConsentManagement: (userId: string, consentType: string) => ConsentResult;
}

// 개인정보 마스킹 규칙
const maskPersonalInfo = (data: PersonalData, viewerRole: UserRole): PersonalData => {
  const maskingRules = {
    [UserRole.ATTENDEE]: {
      phone: (phone: string) => phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
      email: (email: string) => email.replace(/(.{2}).*(@.*)/, '$1****$2'),
      address: (address: string) => address.slice(0, 10) + '****'
    },
    [UserRole.ADMIN]: {
      // 관리자는 모든 정보 접근 가능
      phone: (phone: string) => phone,
      email: (email: string) => email,
      address: (address: string) => address
    }
  };
  
  const rules = maskingRules[viewerRole] || maskingRules[UserRole.ATTENDEE];
  
  return {
    ...data,
    phone: rules.phone(data.phone),
    email: rules.email(data.email),
    address: rules.address(data.address)
  };
};
```

### 6.2 GDPR Compliance

```typescript
interface GDPRCompliance {
  // 데이터 주체 권리
  handleDataSubjectRequest: (userId: string, requestType: GDPRRequestType) => Promise<void>;
  
  // 동의 철회
  withdrawConsent: (userId: string, consentId: string) => Promise<void>;
  
  // 데이터 이동성
  exportUserData: (userId: string) => Promise<UserDataExport>;
  
  // 데이터 삭제
  deleteUserData: (userId: string) => Promise<void>;
}

// 데이터 삭제 요청 처리
const handleDeleteRequest = async (userId: string): Promise<void> => {
  // 인쇄 기록에서 개인정보 삭제
  await PrintRecordModel.updateMany(
    { userId },
    { 
      $unset: { 
        personalInfo: 1,
        ipAddress: 1,
        userAgent: 1 
      },
      $set: { 
        deletedAt: new Date(),
        deletionReason: 'GDPR_DELETION_REQUEST'
      }
    }
  );
  
  // 문서 접근 기록에서 개인정보 삭제
  await AccessLogModel.updateMany(
    { userId },
    { 
      $unset: { userData: 1 },
      $set: { anonymized: true }
    }
  );
  
  // 삭제 완료 로그
  logDataDeletion(userId, 'GDPR_REQUEST');
};
```

---

## 7. Rate Limiting & DoS Protection

### 7.1 API Rate Limiting

```typescript
interface RateLimiting {
  // 레이트 리밋 규칙
  rateLimits: {
    [endpoint: string]: {
      windowMs: number;
      maxRequests: number;
      skipSuccessfulRequests?: boolean;
      skipFailedRequests?: boolean;
    };
  };
  
  // 제한 확인
  checkRateLimit: (userId: string, endpoint: string) => RateLimitResult;
  
  // 제한 적용
  applyRateLimit: (userId: string, endpoint: string) => Promise<void>;
  
  // 동적 제한 조정
  adjustRateLimits: (userId: string, behavior: UserBehavior) => void;
}

// 인쇄 API 레이트 리밋
const printRateLimits = {
  '/api/print/badge': {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 5,           // 최대 5개
    skipSuccessfulRequests: false
  },
  '/api/print/batch': {
    windowMs: 5 * 60 * 1000,  // 5분
    maxRequests: 3,           // 최대 3개 배치
    skipSuccessfulRequests: false
  },
  '/api/pdf/generate': {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 10,          // 최대 10개
    skipSuccessfulRequests: true
  }
};
```

### 7.2 DDoS Protection

```typescript
interface DDoSProtection {
  // IP 기반 차단
  ipBlacklist: Set<string>;
  
  // 의심스러운 활동 탐지
  detectSuspiciousActivity: (ipAddress: string, requests: Request[]) => SuspiciousActivityResult;
  
  // 자동 차단
  autoBlockIP: (ipAddress: string, duration: number, reason: string) => Promise<void>;
  
  // CAPTCHA 표시
  showCAPTCHA: (userId: string, reason: string) => Promise<void>;
}

// DDoS 탐지 규칙
const detectDDoSPatterns = (ipAddress: string): boolean => {
  const recentRequests = getRecentRequests(ipAddress, 60 * 1000); // 1분
  
  // 1분 내 100개 이상 요청
  if (recentRequests.length > 100) {
    autoBlockIP(ipAddress, 60 * 60 * 1000, 'EXCESSIVE_REQUESTS');
    return true;
  }
  
  // 비정상적인 User-Agent 패턴
  const userAgents = new Set(recentRequests.map(req => req.userAgent));
  if (userAgents.size === 1 && recentRequests.length > 50) {
    autoBlockIP(ipAddress, 30 * 60 * 1000, 'SUSPICIOUS_USER_AGENT');
    return true;
  }
  
  return false;
};
```

---

## 8. Implementation Checklist

### 8.1 Security Implementation Items

**Authentication & Authorization:**
- [ ] Session validation middleware
- [ ] Role-based access control implementation
- [ ] JWT token security
- [ ] Multi-factor authentication for admin

**Document Protection:**
- [ ] Document watermarking system
- [ ] QR code authentication
- [ ] Digital signature implementation
- [ ] Document verification API

**Access Control:**
- [ ] URL manipulation protection
- [ ] Document ownership validation
- [ ] Rate limiting implementation
- [ ] IP-based access control

**Audit & Monitoring:**
- [ ] Security event logging
- [ ] Anomaly detection system
- [ ] Real-time security dashboard
- [ ] Security alert system

**Privacy & Compliance:**
- [ ] Personal data masking
- [ ] GDPR compliance features
- [ ] Data retention policy implementation
- [ ] Consent management system

### 8.2 Testing Security Features

**Security Testing Checklist:**
- [ ] Unauthorized access testing
- [ ] URL manipulation attack testing
- [ ] Rate limit bypass testing
- [ ] Document forgery testing
- [ ] Session hijacking testing
- [ ] XSS and CSRF protection testing
- [ ] SQL injection prevention testing
- [ ] Privacy compliance testing

---

이 보안 정책은 eRegi 인쇄 시스템의 모든 문서를 보호하고, 무단 접근을 방지하며, 개인정보보호 규정을 준수하는 것을 목표로 합니다.

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
