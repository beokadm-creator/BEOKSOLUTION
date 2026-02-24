# Cloud Functions Backend - Firebase Server Logic

**Purpose**: 20 TypeScript files implementing payment processing, badge management, auth, migrations, and monitoring for the eRegi platform.

## STRUCTURE

```
functions/src/
├── index.ts              # Main entry point - exports all callable functions
├── payment/              # Payment gateway integrations
│   ├── nice.ts           # NicePay (domestic) - prepare, approve, cancel
│   └── toss.ts           # Toss Payments - approve, cancel
├── badge/                # Badge & registration lifecycle
│   └── index.ts          # Token validation, badge issuance, notifications
├── auth/                 # Authentication helpers
│   └── external.ts       # External attendee Firebase Auth creation
├── migrations/           # Data migration scripts
│   └── migrateRegistrationsForOptions.ts
├── monitoring/           # Health & integrity checks
│   ├── dataIntegrity.ts  # Registration/member code integrity monitors
│   ├── scheduledReports.ts # Daily/weekly reports
│   └── resolveAlert.ts   # Alert resolution handler
├── alimtalk/             # Kakao AlimTalk integration (Korea-specific)
├── services/             # Shared backend services
├── utils/                # Backend utilities
└── scripts/              # Admin/maintenance scripts
```

## WHERE TO LOOK

| Domain | File | Callable Functions |
|--------|------|-------------------|
| **Payment** | `payment/nice.ts` | `prepareNicePayment`, `confirmNicePayment` |
| | `payment/toss.ts` | `confirmTossPayment`, `cancelTossPayment` |
| **Badge** | `badge/index.ts` | `validateBadgePrepToken`, `issueDigitalBadge`, `resendBadgePrepToken`, `generateBadgePrepToken` |
| **Auth** | `auth/external.ts` | `generateFirebaseAuthUserForExternalAttendee` |
| **Migrations** | `migrations/*.ts` | `migrateRegistrationsForOptions`, `migrateRegistrationsForOptionsCallable` |
| **Monitoring** | `monitoring/*.ts` | `monitorRegistrationIntegrity`, `monitorMemberCodeIntegrity`, `dailyErrorReport`, `weeklyPerformanceReport` |

## CONVENTIONS

### Function Export Pattern
```typescript
// All callable functions exported from index.ts
export const confirmNicePayment = functions
    .runWith({ enforceAppCheck: false, ingressSettings: 'ALLOW_ALL' })
    .https.onCall(async (data, context) => {
        // Implementation
    });
```

### Admin SDK Usage
- Always use `admin.firestore()` (not frontend `db`)
- `admin.initializeApp()` called once in index.ts
- Never import from `@/firebase.ts` (frontend config)

### Payment Flow
1. **Prepare**: Frontend calls `prepareNicePayment` → returns signed params
2. **Payment Gateway**: User completes payment on NicePay/Toss
3. **Confirm**: Frontend calls `confirmNicePayment` → validates, creates registration, locks member code

### Badge Lifecycle
1. Registration created → `onRegistrationCreated` trigger
2. External attendee → `generateFirebaseAuthUserForExternalAttendee`
3. Badge prep token → `generateBadgePrepToken` (36-char UUID)
4. Validate token → `validateBadgePrepToken`
5. Issue badge → `issueDigitalBadge` (sets `badgeQr`)

### Error Handling
```typescript
try {
    const result = await someOperation();
    return result;
} catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    functions.logger.error("Operation failed:", errorMessage);
    throw new functions.https.HttpsError('internal', errorMessage);
}
```

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use frontend Firebase SDK (`@/firebase.ts`) - use `admin` SDK
- **NEVER** skip transaction locks for registration/member code updates
- **NEVER** hardcode payment amounts - use `data.amt` from frontend
- **NEVER** call payment APIs without validation
- **NEVER** leave `.backup` files in production (index.ts.backup exists - remove)
- **NEVER** use `any` - TypeScript strict mode enabled for functions

## NOTES

### Deployment
```bash
cd functions && npm run build    # Compile to lib/
firebase deploy --only functions # Deploy to Firebase
```

### Local Testing
```bash
firebase emulators:start --only functions
```

### Runtime
- Node.js 20 (specified in functions/package.json)
- TypeScript compiled to `lib/` directory

### Gotchas
1. **Payment Confirmation**: Must validate `ResultCode` ('3001', '4100', '4000' for NicePay success)
2. **Member Code Locking**: Once `used: true`, code is locked to `usedBy` user
3. **External Attendees**: Create Firebase Auth user before registration
4. **Badge Tokens**: Expire based on conference end date + 24h (or 7d fallback)
5. **Backup Files**: `index.ts.backup` exists - should be removed

### Monitoring
- `dailyErrorReport` - Runs daily, logs errors
- `weeklyPerformanceReport` - Weekly performance metrics
- `monitorRegistrationIntegrity` - Scheduled integrity check
- `monitorMemberCodeIntegrity` - Member code validation
