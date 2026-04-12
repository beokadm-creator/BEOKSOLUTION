# Issues Log

## 2026-04-09: Double KST offset + feature flag default

### Issue A: exitLogger.ts double KST offset (line 226-227)
- `exitTime` from `autoCheckout.ts` is already shifted +9h (KST)
- Code was adding another +9h → wrong date (+18h total)
- Fix: use `exitTime.toISOString().split('T')[0]` directly
- This matches the existing pattern at line 135 (`const today = exitTime.toISOString().split('T')[0]`)

### Issue B: autoCheckout.ts feature flag defaults
- When `settings/auto_checkout` document doesn't exist, defaulted to `enabled: false, dryRun: true`
- This made auto-checkout completely useless without manual Firestore document creation
- Fix: changed all 3 default locations to `enabled: true, dryRun: false`
- Admin can still explicitly disable by setting `enabled: false` in Firestore

### Key pattern: KST handling in call chain
```
autoCheckout.ts: kstTime = now + 9h → passed as exitTime
exitLogger.ts: exitTime already KST-shifted → toISOString() gives correct KST date
Zone boundaries use +09:00 offset → duration math works correctly
```
