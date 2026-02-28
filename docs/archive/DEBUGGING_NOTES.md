# User Data Loading - Debugging (2026-01-21)

## User Information
- **UID**: K2ufvNWpJsNc0KbyrGdZLf4PdU32
- **Issue**: Profile data not showing on `/mypage`
- **Domains**: Both eregi.co.kr and kadd.eregi.co.kr affected

## Enhanced Logging Added

Code now includes detailed console logs to trace data flow:

### In `useAuth.ts` (lines 77-128):
```typescript
console.log("[Auth] onSnapshot called for uid:", currentUser.uid, "exists:", docSnap.exists());
console.log("[Auth] User document data:", userData);
console.log("[Auth] User document MISSING for uid:", currentUser.uid);
```

### In `UserHubPage.tsx` (lines 464-520):
```typescript
console.log("[Profile Debug] Starting profile load for uid:", u.uid);
console.log("[Profile Debug] Initial auth fallback:", profileData);
console.log("[Profile Debug] users/{uid} document found/NOT found");
console.log("[Profile Debug] First participation found:", firstParticipation);
console.log("[Profile Debug] Final profile data being set:", profileData);
```

## Firestore Data Check Required

For UID: `K2ufvNWpJsNc0KbyrGdZLf4PdU32`

Check if these documents/subcollections exist:

1. **`users/{K2ufvNWpJsNc0KbyrGdZLf4PdU32}`** - User main document
   - Should contain: name, email, phone, affiliation, organization, licenseNumber
   - Type: Member (if exists) or Non-member (if doesn't exist)

2. **`users/{K2ufvNWpJsNc0KbyrGdZLf4PdU32}/participations`** - Participation history
   - Should contain: participation records from conferences
   - Fields: userName, userEmail, userPhone, userOrg, societyId, conferenceId, slug, createdAt
   - Expected to exist for all registered users

3. **`conferences/{confId}/registrations/{regId}`** - Registration records
   - Should have userId = K2ufvNWpJsNc0KbyrGdZLf4PdU32
   - May be split across different conference IDs

## Steps to Debug

### Step 1: Browser Console Check
1. Open https://eregi.co.kr/mypage (or kadd.eregi.co.kr/mypage)
2. Open DevTools (F12) → Console tab
3. Look for these log patterns:
   - `[Auth] onSnapshot called for uid: K2ufvNWpJsNc0KbyrGdZLf4PdU32 exists: true/false`
   - `[Auth] User document data: {...}` or `[Auth] User document MISSING`
   - `[Profile Debug] Starting profile load...`
   - `[Profile Debug] Final profile data being set: {...}`

### Step 2: Share Console Output
Capture and share the full console output with all `[Auth]` and `[Profile Debug]` logs

### Step 3: Firebase Console Check
1. Go to Firebase Console → eregi-8fc1e → Firestore
2. Navigate to `users` collection
3. Search for document ID: `K2ufvNWpJsNc0KbyrGdZLf4PdU32`
4. Check:
   - Does document exist? (Yes/No)
   - If yes, what fields are present?
   - If no, check `participations` subcollection (may exist without parent doc)

### Step 4: Check Participation Records
1. If `users/{K2ufvNWpJsNc0KbyrGdZLf4PdU32}` document missing
2. Go to `users` → `{K2ufvNWpJsNc0KbyrGdZLf4PdU32}` → `participations`
3. Check if any documents exist there
4. If yes, note down the fields: userName, userEmail, societyId, conferenceId

## Potential Root Causes

### 1. Security Rules Blocking
- User can't read `users/{uid}` due to permission denied
- Exception: If both user docs and participation docs are blocked

### 2. No User Document + No Participation Documents
- User exists in Firebase Auth but never registered for any conference
- Has UID but no related data in Firestore
- Solution: Create initial document or seed data

### 3. Participation Document Structure Mismatch
- Participation docs exist but don't have expected field names
- Code looks for: userName, userEmail, userPhone, userOrg
- May actually be stored as: name, email, phone, org (without "user" prefix)

### 4. Data Migration Issue
- User data split between old and new locations
- Some data in `users/{uid}`, some in participations
- Code needs to check both and merge

## Recommended Fix Based on Findings

### If participations exist:
Merge data from both sources with proper field name mapping

### If no participations exist:
- Check if user has confirmed email in Firebase Auth
- Create seed participation entry if needed
- Or display auth-derived data only (Firebase displayName, email, etc.)

### If security rules are the issue:
- Verify user UID matches request.auth.uid
- Check if email/token validation is interfering
- Test with super admin account (aaron@beoksolution.com) to confirm rule issue

## Notes

- Data structure: `UID + societyId + conferenceId` for all lookups
- All info indexed by these three IDs
- Expected to have multiple participations across different societies/conferences
- Non-members may have participations but no main `users/{uid}` document (this is normal and intended)
