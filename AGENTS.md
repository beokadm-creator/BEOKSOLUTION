---
precedence: 99
required-for:
  - all-code-changes
optional-for:
  - repo-orientation
memory-type: policy
token-estimate: 1972
@include:
  - docs/shared/AI_DOC_SHARED_RULES.md
  - docs/shared/ESSENTIAL_POST_COMPACT.md
  - docs/shared/VERSION_CONTROL_SHARED.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Aligned root agent instructions to the shared markdown governance schema.
---

<!-- STATIC:BEGIN -->

# 🚨 CRITICAL: VERSION CONTROL PROTECTION 🚨

**ALL AGENTS MUST READ THIS BEFORE STARTING ANY WORK**

## Current Production Baseline
- **Version**: v1.0.1 (check with `git describe --tags --abbrev=0`)
- **Baseline**: v1.0.0 at commit `35aaeed` (immutable)
- **NEVER** delete, move, or modify tags

## 🚨 [NEW] LIVE EVENT PROTECTION (DAY 2-3) 🚨
**NO BACKEND (FUNCTIONS) DEPLOYMENTS DURING LIVE EVENTS.**
- NEVER run `firebase deploy --only functions` or `npm run deploy:prod`.
- If a function MUST be deployed, use targeted deployments ONLY: `firebase deploy --only functions:<functionName>`
- If you see commented-out `export` statements in `functions/src/index.ts`, DO NOT deploy functions as they will be deleted from the live environment.

## Rollback Prevention System (ENFORCED)
This codebase has **multi-layer protection** against accidental rollbacks:

**Layer 1: Pre-commit Hooks** — ESLint (0 errors, 0 warnings) + Jest tests (all must pass)
**Layer 2: GitHub Branch Protection** — Direct push to `main` BLOCKED, PR required
**Layer 3: CI/CD Pipeline** — ESLint → TypeScript → Jest → Vite Build validation
**Layer 4: Git Tag Protection** — v1.0.0 is immutable production baseline

## MANDATORY Pre-Work Checklist
Before starting ANY work, agents MUST:
1. **Read** `MANDATORY_WORKFLOW.md` (primary workflow document)
2. **Check** current version: `git describe --tags --abbrev=0`
3. **Create** feature branch: `git checkout -b feature/description`
4. **NEVER** work directly on `main` branch
5. **Verify** Node version: `node --version` (standard runtime is 22.x)

---

# AGENTS.md - eRegi AI Agent Guidelines

## Essential Commands

```bash
# Development & Build (rolldown-vite for faster builds)
npm run dev              # Vite dev server (HMR, port 5173)
npm run build           # TypeScript + Vite build (dist/)
npm run lint            # ESLint check on all TS/TSX files

# Testing (Jest: ts-jest preset, jsdom env, 10s timeout)
npm test                # Run all Jest tests (10 test files)
npx jest --testPathPattern=MyComponent.test.ts  # Single file
npx jest --testNamePattern="should render"     # Single test
npx jest --listTests    # List all test files

# Firebase Functions (functions/src/ - Node 22 runtime)
cd functions && npm run build                      # Compile to lib/
firebase emulators:start --only functions          # Local emulator
firebase deploy --only functions                   # Deploy functions
```

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
- **ESLint**: Flat config (eslint.config.js) with ts-eslint + react-hooks + react-refresh
- **No Prettier**: Formatting handled by ESLint only
- **Line length**: ~100 chars recommended, 120 soft limit
- **Quotes**: Double for JS/TS, backticks for templates
- **TypeScript**: `strict: false` in tsconfig; use schema.ts interfaces, NEVER 'any'

### TypeScript Best Practices
- Use `schema.ts` interfaces for Firestore models, NOT 'any'
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

// Async with loading state
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

// Firebase auth error handling
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
- **Firebase**: Auth (session persistence), Firestore, Storage, Functions (Node 22 runtime)
- **Radix UI + Tailwind**: Accessible primitives + CSS-in-JS
- **Payment**: Toss (domestic), Nice (backup)
- **Notifications**: react-hot-toast, **Charts**: recharts
- **Build Strategy**: Rolldown-Vite (faster than standard Vite), manual chunks - react-vendor, firebase-vendor, print-vendor, vendor
- **Node Version**: use **22.x** for local development and Firebase Functions runtime

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

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
