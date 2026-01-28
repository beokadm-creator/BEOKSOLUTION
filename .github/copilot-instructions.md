# eRegi Copilot Instructions

**Project**: Multi-tenant conference registration & management platform (Korea-based societies: KAP, KADD)

## Architecture Overview

### Multi-Tenant Design
- **Root collections**: `societies`, `super_admins`, `global_users`
- **Tenant structure**: `conferences/{confId}/*` where `confId = ${societyId}_${slug}` (e.g., `kap_2026spring`)
- **Sub-collections**: `registrations`, `members`, `users`, `participations`, `pages`, `agendas`, `speakers`
- Domain-based routing: `kap.eregi.*` → KAP, `kadd.eregi.*` → KADD data isolation ([src/App.tsx#L76-L83](src/App.tsx#L76-L83))

### Role-Based Access (Context Providers)
- **GlobalContext** (super_admin flag) → Super Admin dashboard
- **ConfContext** (confId, conference data) → Conference-specific features
- **SocietyContext** → Society admin operations
- **VendorContext** → Payment/vendor integration ([src/contexts](src/contexts))

## Critical Data Flows

### User Lifecycle (Members vs Non-Members)
- **Member Path**: `societies/{sid}/members` → signup → `users/{uid}` created → register for conferences → `users/{uid}/participations/{regId}` created
- **Non-Member Path**: Register for conference (anonymous or email) → payment → `users/{uid}/participations/{regId}` created (but no `users/{uid}` doc yet) → optional: later upgrade to member (data migrates with consent)
- **Key Difference**: Both paths have `users/{uid}/participations` after registration. Only members have `users/{uid}` main document. Always handle both cases.

### Registration & Payment
1. User selects grade (Member/Non-Member) with member verification via `verifyMemberCode` function
2. `confirmNicePayment` or `confirmTossPayment` CloudFunction updates registration status, locks member code, logs participation history ([functions/src/index.ts#L146-L194](functions/src/index.ts#L146-L194))
3. Member code marked as used via `used: true, usedBy: userId` to prevent reuse
4. Post-payment: participation history saved to `users/{uid}/participations/{regId}` for user's "My Page" (works for both members and non-members)

### Data Access Patterns
- **Member verification**: Uses collection group query `verifyMemberCode()` → searches all `societies/{sid}/members` 
- **User registrations**: Query from `users/{uid}/participations` (no index required, works for both member and non-member paths)
- **Conference info**: Tenant-specific fetch from `conferences/{confId}/info` with societyId passthrough

## Project-Specific Patterns

### Custom Hooks Pattern
20+ hooks in [src/hooks](src/hooks) manage domain logic—not just state management:
- `useConference()`: Loads full conference context (info, pages, agendas, speakers) using URL slug
- `useConferenceAdmin()`, `useSuperAdmin()`: Role-specific operations with permission checks
- `useAuth()`, `useMemberVerification()`: Authentication flows with member code locking
- Each hook returns loading/error/data states; always check loading before render

### TypeScript Schema-First Development
- All Firestore models defined in [src/types/schema.ts](src/types/schema.ts)
- Use `Timestamp` from `firebase/firestore` for date fields (not `Date`)
- Interfaces for conference config, registration, participation, pages—refer to schema.ts for structure

### Build & Chunk Strategy
Vite config splits bundles aggressively ([vite.config.ts](vite.config.ts)):
- `react-vendor`: React/router/DOM
- `firebase-vendor`: Firebase SDK (heavy)
- `print-vendor`: html2canvas, jspdf (print/download features)
- `vendor`: Other dependencies
Prevents main bundle bloat; critical for fast page loads.

## Essential Workflows

### Local Development
```bash
npm run dev              # Vite dev server (HMR enabled)
npm run build           # TypeScript + Vite build
npm run lint            # ESLint check
firebase emulators:start --only functions  # Test CloudFunctions locally
```

### Functions Development
- Edit [functions/src/index.ts](functions/src/index.ts) for CloudFunctions, or modular files in `functions/src/{payment,scheduled,utils}`
- Run `npm run build` in functions/ to compile TypeScript → `lib/`
- Deploy: `firebase deploy --only functions` or use `firebase serve` locally
- Use `admin.firestore()` client in backend (not `db` from frontend); separate from [src/firebase.ts](src/firebase.ts)

### Firestore Rules & Indexes
- Security rules in [firestore.rules](firestore.rules); permission errors often mean missing indexes or rule conflicts
- Deploy both: `firebase deploy --only firestore:rules,firestore:indexes`
- Collection group queries require indexes defined in [firestore.indexes.json](firestore.indexes.json); check FIXES_APPLIED.md for deployment history

## Component Organization

### UI Components by Domain
```
src/components/
├── admin/          # Super & society admin dashboards
├── auth/           # Auth flows (login, recovery, guards)
├── conference/     # Conference data loading, context setup
├── payment/        # Toss/Nice payment handlers
├── print/          # Badge, certificate generation
├── eregi/          # Core registration UI
├── shared/         # Buttons, modals, utilities
└── ui/             # Radix UI primitives + Tailwind
```

### Layouts
- [SuperLayout](src/layouts/SuperLayout.tsx), [ConfLayout](src/layouts/ConfLayout.tsx): Route-level layout wrappers with providers
- Always wrap pages with appropriate layout to activate context providers

## Key Dependencies & Integrations

- **React 19 + React Router 7**: Modern hooks, v7 uses `useParams` (not v6 params API)
- **Firebase**: Auth (session persistence), Firestore, Cloud Storage, Cloud Functions
- **Radix UI + Tailwind**: Accessible component library + CSS-in-JS
- **Payment**: Toss (domestic), Nice (backup); use appropriate payment function based on config
- **Print/Export**: html2canvas + jspdf (WidePricing, certificates); recharts (analytics)
- **Notifications**: react-hot-toast (e.g., `toast.success()`)

## Common Gotchas

1. **Collection Group Queries**: Require proper Firestore indexes AND security rules. For user-scoped data, prefer direct subcollection queries like `users/{uid}/participations` instead (no index required, scoped by user ID in rules)
2. **Firestore Security Rules**: Must explicitly allow subcollection access. Example: `users/{uid}/participations/{docId}` needs `match /participations/{participationId}` rule in user document
3. **Optional Queries During Index Build**: Some queries may require indexes that take 5-15 minutes to build. For optional features (like user abstracts), consider disabling the query temporarily until the index is ready, rather than blocking the entire page
4. **Member Verification**: Once `used: true`, code locked to user (`usedBy`); re-verification allowed only by same user
5. **Domain-Based Isolation**: Confirm you're accessing correct confId based on hostname before making queries
6. **TypeScript**: Don't use `any` for Firestore models; refer to schema.ts interfaces
7. **Participation History**: Stored in `users/{uid}/participations/{regId}` for efficient user-scoped queries without collection group indexes; automatically saved by payment functions
8. **Non-Member User Documents**: Non-members who haven't completed eRegi signup may NOT have a `users/{uid}` document yet. Always use `try-catch` with fallback when fetching user profile data. Their data exists in participation records (`users/{uid}/participations`) even if the main user doc doesn't exist. Load profile from multiple sources: auth context, `users/{uid}` (if exists), and participation records (always exists after registration)

## Testing
- Jest config: [jest.config.js](jest.config.js) (preset: ts-jest, test environment: node)
- Test files: `**/*.test.ts` or `**/__tests__/**`
- Run: `npm test` (not currently in package.json; may need to add to scripts)
