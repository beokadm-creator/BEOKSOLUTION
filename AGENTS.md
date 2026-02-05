# 🚨 CRITICAL: VERSION CONTROL PROTECTION 🚨

**ALL AGENTS MUST READ THIS BEFORE STARTING ANY WORK**

## Current Production Baseline
- **Version**: v1.0.0 (Immutable)
- **Tracking**: `.DEPLOYED_VERSION` file
- **Release Notes**: `RELEASE_NOTES_v1.0.0.md`

## 🛡️ Rollback Prevention System (ENFORCED)

This codebase has **multi-layer protection** against accidental rollbacks:

### Layer 1: Git Tag Anchor
- **v1.0.0** is the production baseline (commit `35aaeed`)
- **NEVER** delete, move, or modify this tag
- All forward progress must be from this point

### Layer 2: Pre-commit Hooks (LOCAL ENFORCEMENT)
- **ESLint** must pass (no errors, no warnings)
- **Jest Tests** must pass (167 tests, 100% pass rate required)
- **Auto-fix** runs on staged files
- Hook location: `.husky/pre-commit`

### Layer 3: GitHub Branch Protection (SERVER ENFORCEMENT)
- **Direct push to `main`**: BLOCKED
- **PR required**: ALL changes must go through pull requests
- **CI/CD validation required**: ESLint + TypeScript + Tests + Build
- **Force push protection**: ENABLED

### Layer 4: CI/CD Pipeline (AUTOMATED VALIDATION)
- File: `.github/workflows/ci.yml`
- Runs on every PR to `main` or `develop`
- Checks: ESLint → TypeScript → Jest → Vite Build
- **ALL must pass** before merge button activates

## 📋 MANDATORY PRE-WORK CHECKLIST

**Before starting ANY work**, agents MUST:

1. **Read** `MANDATORY_WORKFLOW.md` (this file's continuation)
2. **Check** `.DEPLOYED_VERSION` to know current production version
3. **Create** feature branch: `git checkout -b feature/description`
4. **NEVER** work directly on `main` branch

## ⚠️ Consequences of Violation

- **Pre-commit hook failure**: Commit blocked
- **Direct push to main**: GitHub rejects with error
- **CI/CD failure**: PR cannot be merged
- **Rollback attempt**: Tag protection prevents deletion

## 🛠️ Emergency Recovery

If you accidentally cause issues:
1. **DO NOT** try to rollback
2. **DO** create a new feature branch with fix
3. **DO** follow normal PR workflow
4. **READ** `VERSION_CONTROL_POLICY.md` for detailed procedures

---

# AGENTS.md - eRegi AI Agent Guidelines

## Essential Commands

```bash
# Development & Build (uses rolldown-vite for faster builds)
npm run dev              # Vite dev server (HMR, port 5173)
npm run build           # TypeScript + Vite build (dist/)
npm run lint            # ESLint check on all TS/TSX files

# Testing (Jest: ts-jest preset, node env, 10s timeout)
npm test                # Run all Jest tests
npx jest --testPathPattern=MyComponent.test.ts  # Single file
npx jest --testNamePattern="should render"    # Single test

# Firebase Functions (functions/src/{payment,scheduled,utils})
cd functions && npm run build                      # Compile to lib/
firebase emulators:start --only functions          # Local emulator
firebase deploy --only functions                   # Deploy functions
```

---

## Code Style Guidelines

### Import Conventions
```typescript
// Firebase SDK - direct imports
import { collection, getDoc, doc, Timestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
// Local files - use @/ path alias
import { useConference } from '@/hooks/useConference';
import type { Conference, Registration } from '@/types/schema';
// External libraries
import { useState } from 'react';
import toast from 'react-hot-toast';
```

### Formatting & Linting
- **ESLint**: Flat config (ts-eslint + react-hooks + react-refresh)
- **No Prettier**: Formatting handled by ESLint only
- **Line length**: ~100 chars recommended, 120 soft limit
- **Quotes**: Double for JS/TS, backticks for templates
- **TypeScript**: strict mode is FALSE; use schema.ts interfaces, NOT 'any'

### TypeScript Best Practices
- Use schema.ts interfaces, NOT 'any'
- Firestore dates: Always use `Timestamp` from firebase/firestore
- Type assertion: `const data = doc.data() as Conference;`
- Optional chaining: `data.venue?.name || 'Unknown'`

### Naming Conventions
- **Variables/Functions**: camelCase (`conferenceId`, `handleSubmit`)
- **Components/Types**: PascalCase (`ConferenceDashboard`, `RegistrationData`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PAGE_SIZE`)

### Error Handling Patterns
```typescript
// Firestore operations with toast
try {
  await updateDoc(docRef, { status: 'active' });
  toast.success('업데이트 완료');
} catch (error) {
  console.error('Update failed:', error);
  toast.error('업데이트 실패했습니다.');
}

// Async with loading
const [loading, setLoading] = useState(false);
const handleAction = async () => {
  setLoading(true);
  try {
    await someAsyncOperation();
    toast.success('성공');
  } catch (error) {
    console.error(error);
    toast.error('오류 발생');
  } finally {
    setLoading(false);
  }
};

// Firebase auth errors
if (error.code === 'auth/user-not-found') toast.error('사용자를 찾을 수 없습니다.');
```

---

## Architecture Patterns

### Multi-Tenant Structure
- **Tenant ID**: `confId = ${societyId}_${slug}` (e.g., `kap_2026spring`)
- **Domain routing**: `kap.eregi.co.kr` → KAP, `kadd.eregi.co.kr` → KADD
- **Root collections**: `societies`, `users`, `super_admins`
- **Conference data**: `conferences/{confId}/registrations`, `agendas`, etc.

### Member vs Non-Member Paths
- **Members**: `societies/{sid}/members` → signup → `users/{uid}` doc exists
- **Non-members**: Register directly → `users/{uid}/participations/{regId}` exists, but `users/{uid}` may NOT exist
- **Always handle both cases** - check `users/{uid}` existence with try-catch, fallback to participation data

### Context Providers & Hooks
- `GlobalContext` → Super admin access
- `ConfContext` → Conference-specific data (confId, conference info)
- `SocietyContext` → Society admin operations
- `VendorContext` → Payment/vendor integration
- Wrap pages with appropriate layout to activate context
- **20+ custom hooks in src/hooks**: Use `useConference`, `useAuth`, `useConferenceAdmin` for domain logic
- Each hook returns `{ loading, error, data }` states; always check `loading` before render

### Data Access Patterns
```typescript
// User-scoped - subcollections (no index needed)
collection(db, 'users', uid, 'participations')
// Conference data - direct path
doc(db, 'conferences', confId)
// Collection group queries - require firestore.indexes.json
collectionGroup(db, 'submissions')
```

### Firestore Security Rules
- Collection group queries require indexes in firestore.indexes.json
- Deploy: `firebase deploy --only firestore:rules,firestore:indexes`
- Check FIXES_APPLIED.md for deployment history

---

## Component Organization

```
src/
├── components/
│   ├── admin/          # Super & society admin dashboards
│   ├── auth/           # Login, recovery, guards
│   ├── conference/     # Conference data loading, context
│   ├── payment/        # Toss/Nice payment handlers
│   ├── print/          # Badge, certificate generation
│   ├── eregi/          # Core registration UI
│   ├── shared/         # Common modals, utilities
│   └── ui/             # Radix UI primitives + Tailwind
├── contexts/          # React Context providers
├── hooks/             # Custom hooks (20+ domain logic hooks)
├── layouts/           # Route-level layout wrappers
├── pages/             # Page components
└── types/schema.ts     # All Firestore model definitions (USE THIS)
```

---

## Key Dependencies & Build

- **React 19 + React Router 7**: Uses `useParams` (v7 API, not v6)
- **Firebase**: Auth (session persistence), Firestore, Storage, Functions
- **Radix UI + Tailwind**: Accessible primitives + CSS-in-JS
- **Payment**: Toss (domestic), Nice (backup)
- **Notifications**: react-hot-toast, **Charts**: recharts
- **Build Strategy**: Vite manual chunks - react-vendor, firebase-vendor, print-vendor, vendor

---

## Critical Gotchas

1. **Collection Group Queries**: Require indexes; check firestore.indexes.json if queries fail
2. **Member Codes**: Once `used: true`, locked to `usedBy` user
3. **Firestore Timestamps**: Always use `Timestamp` from firebase/firestore, NOT `Date`
4. **Domain Isolation**: Verify confId from hostname before queries
5. **Non-Member Profiles**: `users/{uid}` may not exist - use try-catch with fallback to participation data
6. **Optional Fields**: Use optional chaining (`data.venue?.name`) for Firestore fields
7. **Payment Functions**: Use `confirmNicePayment` or `confirmTossPayment` CloudFunctions only
8. **Type Safety**: Never use `any` for Firestore models - import from schema.ts
9. **Optional Queries During Index Build**: Some queries require indexes that take 5-15 minutes to build. For optional features, consider disabling the query temporarily rather than blocking the page
