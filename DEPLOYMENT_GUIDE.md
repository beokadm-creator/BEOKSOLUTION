# Voucher/Badge Scanning Fix - Deployment & Test Guide

## 🚀 Deployment Instructions

### Option 1: Deploy Only Badge Functions (Recommended)
```bash
firebase deploy --only functions:onRegistrationCreated,functions:issueDigitalBadge,functions:validateBadgePrepToken
```

### Option 2: Deploy All Functions
```bash
firebase deploy --only functions
```

### Option 3: Full Deployment (Functions + Firestore Rules)
```bash
firebase deploy --only functions,firestore
```

---

## ✅ Test Plan - Voucher to Badge Flow

### Pre-Deployment Checks
- [ ] Backup current Firestore data (especially registrations collection)
- [ ] Verify Firebase project is correct: `firebase use --list`
- [ ] Check current Firebase project: `firebase projects:list`

---

### Test Scenario 1: New Registration Voucher Scanning

**Setup:**
1. Create a new test registration (or use existing unissued registration)
2. Navigate to badge page: `https://kadd.eregi.co.kr/2026spring/badge?lang=ko`
3. Note: This should show VOUCHER state (not yet issued)

**Test Steps:**
1. **Check QR Code Display**
   - [ ] Voucher QR is displayed (not badge)
   - [ ] QR contains plain `regId` (NO CONF- prefix)
   - [ ] QR is scannable (visible and clear)

2. **Scan at InfoDesk**
   - [ ] Navigate to InfoDesk: `/admin/conf/{confId}/infodesk`
   - [ ] Scan the voucher QR code
   - [ ] System recognizes the registration
   - [ ] User name and affiliation are displayed correctly
   - [ ] Status shows "Registration NOT PAID" (if unpaid) or allows badge issuance (if paid)

3. **Issue Badge**
   - [ ] Click issue button (or trigger issuance)
   - [ ] Success message appears: "명찰이 정상적으로 발급되었습니다"
   - [ ] `badgeIssued: true` is set in registration
   - [ ] `badgeQr: "BADGE-{regId}"` is set

**Expected Result:**
✅ Voucher scanning works without "Invalid Registration Code" error
✅ Badge issuance completes successfully

---

### Test Scenario 2: Badge QR Entry/Exit Scanning

**Setup:**
1. Use a registration with issued badge (`badgeIssued: true`)
2. Navigate to badge page to see the issued badge QR

**Test Steps:**
1. **Check Badge QR Display**
   - [ ] Badge QR is displayed (green border, "DIGITAL BADGE ISSUED")
   - [ ] QR contains `BADGE-{regId}` format
   - [ ] Attendance status is shown (INSIDE/OUTSIDE)

2. **Scan at Gate/Entry Kiosk**
   - [ ] Navigate to Gate: `/admin/conf/{confId}/gate`
   - [ ] Select zone
   - [ ] Scan badge QR code
   - [ ] System recognizes registration (BADGE- prefix is stripped)
   - [ ] Check-in successful: "입장 완료 (Checked In)"
   - [ ] `attendanceStatus: "INSIDE"` is set
   - [ ] `currentZone` is updated

3. **Scan Again (Exit/Switch)**
   - [ ] Scan same badge QR again
   - [ ] System correctly identifies current status
   - [ ] Auto-checkout and zone-switch works (if applicable)
   - [ ] Exit successful: "퇴장 완료 (Checked Out)"
   - [ ] `attendanceStatus: "OUTSIDE"` is set

**Expected Result:**
✅ Badge scanning works for both entry and exit
✅ BADGE- prefix is correctly stripped
✅ Attendance tracking works properly

---

### Test Scenario 3: External Attendee Badge

**Setup:**
1. Use an external attendee registration (created via Admin > External Attendees)
2. External attendee ID format: `EXT-{random-id}`

**Test Steps:**
1. **Scan External Attendee QR at InfoDesk**
   - [ ] Scan external attendee QR
   - [ ] System correctly identifies as external attendee
   - [ ] Badge issuance succeeds
   - [ ] `badgeQr: "BADGE-EXT-{id}"` is set

2. **Scan External Badge at Gate**
   - [ ] Scan external attendee badge QR
   - [ ] Attendance tracking works for external attendees
   - [ ] No errors or crashes

**Expected Result:**
✅ External attendee badge flow works end-to-end

---

### Test Scenario 4: Backward Compatibility

**Setup:**
1. Find existing registration with old `confirmationQr: "CONF-{regId}"` format

**Test Steps:**
1. **Scan Old Format QR**
   - [ ] Old QR with CONF- prefix might not scan directly
   - [ ] If scanned, system should handle gracefully
   - [ ] Recommendation: Update old registrations by re-saving or using CloudFunction

**Note:** Old CONF- prefixed QRs won't scan with new system. If needed, run a migration:

```typescript
// Migration script to update old confirmationQr values
const db = admin.firestore();
const snapshot = await db.collection('conferences/{confId}/registrations')
  .where('confirmationQr', '>=', 'CONF-')
  .where('confirmationQr', '<', 'CONF-\uf8ff')
  .get();

const batch = db.batch();
snapshot.docs.forEach((doc, i) => {
  const oldQr = doc.data().confirmationQr;
  const newQr = oldQr.replace('CONF-', '');
  batch.update(doc.ref, { confirmationQr: newQr });
  if (i % 499 === 0) {
    await batch.commit();
    batch = db.batch();
  }
});
await batch.commit();
```

---

## 🔍 Debugging Tips

### If QR Scan Fails:

1. **Check QR Content**
   - Scan QR with phone camera to see actual string
   - Should be plain `regId` for vouchers
   - Should be `BADGE-{regId}` for badges

2. **Check Firestore**
   - Go to Firebase Console > Firestore > `conferences/{confId}/registrations/{regId}`
   - Verify fields:
     - `confirmationQr: regId` (no CONF- prefix)
     - `badgeQr: null` (before issuance) or `"BADGE-{regId}"` (after issuance)
     - `badgeIssued: false` (before) or `true` (after)

3. **Check CloudFunction Logs**
   ```bash
   firebase functions:log
   # or in Firebase Console > Functions > Logs
   ```

4. **Browser Console**
   - Open DevTools (F12)
   - Check for network errors
   - Look for CloudFunction call failures

---

## 📊 Success Criteria

All tests pass when:
- ✅ New voucher QRs scan successfully at InfoDesk
- ✅ Badge issuance works without errors
- ✅ Entry/exit scanning works for issued badges
- ✅ Both regular and external attendees work
- ✅ No "Invalid Registration Code" errors

---

## 🚨 Rollback Plan

If issues occur:

```bash
# Rollback functions to previous version
firebase deploy --only functions --force

# Or restore specific function version
firebase deploy --only functions:onRegistrationCreated --version <previous-version>
```

---

## 📝 Verification Checklist

After deployment:
- [ ] Run Test Scenario 1 (Voucher Scanning) - **CRITICAL**
- [ ] Run Test Scenario 2 (Badge Entry/Exit) - **CRITICAL**
- [ ] Run Test Scenario 3 (External Attendees)
- [ ] Check CloudFunction logs for errors
- [ ] Monitor Firestore for correct field values
- [ ] Test with real QR scanner hardware (if available)

---

## Contact

If you encounter issues:
1. Check Firebase Console logs
2. Verify all code changes are deployed
3. Test with a fresh registration
4. Check network/firewall settings
