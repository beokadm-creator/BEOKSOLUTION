# Business Logic Utilities

**Purpose**: 19 pure functions implementing conference registration business logic - NO UI, NO state.

## WHERE TO LOOK

| Domain | Utility | Function |
|--------|----------|----------|
| Pricing | pricing.ts | `getApplicablePrice()` - calculate price based on period + tier |
| Attendance | attendance.ts | Check-in validation, QR scanning logic |
| Attendance | attendanceDataCleanup.ts | Cleanup/fix attendance data |
| Admin Auth | adminAuth.ts | Admin permission checks |
| Admin | PointsRuleEngine.ts | Points calculation for attendance tracking |
| Localization | localization.ts | Language helpers (ko/en) |
| Localization | gradeTranslator.ts | Tier/grade translation |
| Cookie | cookie.ts | Cookie management (auth tokens, etc.) |
| Printer | printer.ts | Bixolon printer integration |
| Recovery | recovery.ts | Account recovery helpers |
| Registration | registrationDeleteHandler.ts | Registration deletion logic |
| Safe Text | safeText.ts | XSS prevention, text sanitization |
| Transaction | transaction.ts | Payment transaction helpers |
| Whitelist | whitelist.ts | Whitelist validation |
| Path | pathHelper.ts | URL/path utilities |
| Performance | performanceMonitor.ts | Performance monitoring helpers |
| Logger | logger.ts | Logging utilities |

## CONVENTIONS

### Pure Functions
- All utilities: pure functions (no side effects)
- Input: parameters, Output: return value
- No React hooks, no state, no UI

### Pricing Logic (pricing.ts)
- `getApplicablePrice(settings, userTier)`: returns price based on active period
- Uses `Timestamp` from firebase/firestore for date comparison
- Returns 0 if no active period (registration closed)

### Attendance Utilities
- QR code validation: check against registration.badgeQr
- Check-in rules: prevent duplicate check-ins, validate timestamps
- Data cleanup: fix invalid attendance records

### Admin Auth (adminAuth.ts)
- Permission checks: `canEditConference()`, `canAccessSociety()`
- Role-based access: super admin, society admin, conference admin
- No Firebase calls in utils - just helper functions

### Security Utilities
- `safeText`: sanitize user input to prevent XSS
- `whitelist`: validate auth codes, member codes
- `cookie`: secure cookie handling for auth tokens

### Printer Integration (printer.ts)
- Bixolon thermal printer SDK integration
- Badge printing: format data, send to printer
- Receipt printing: generate receipt, print

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use React hooks in utils - pure functions only
- **NEVER** fetch Firestore directly in utils - caller should fetch
- **NEVER** store state in utils - no side effects
- **NEVER** use `any` - import types from `@/types/schema`
- **NEVER** mix UI logic in utils - no JSX, no styles
- **NEVER** skip input validation in security utils
- **NEVER** use `Date` - always use `Timestamp` from firebase/firestore
