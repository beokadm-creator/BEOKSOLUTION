# Custom Hooks - Domain Logic Layer

**Purpose**: 20+ custom hooks encapsulating all conference registration domain logic - NO generic React patterns here.

## WHERE TO LOOK

| Domain | Hook | Use For |
|--------|-------|---------|
| Conference data | `useConference` | Load conference context (info, pages, agendas, speakers) by slug |
| Conference data | `useConferenceData` | Conference-specific data fetching with caching |
| Auth & Members | `useAuth` | Firebase Auth state + session management |
| Auth & Members | `useMemberVerification` | Member code validation + locking logic |
| Auth & Members | `useNonMemberAuth` | Anonymous user flows |
| Registration | `useRegistration` | Registration submission + payment flow |
| Registration | `useRegistrations` | Admin registration listing/filters |
| Admin | `useConferenceAdmin` | Conference admin operations + permission checks |
| Admin | `useSocietyAdmin` | Society-level admin operations |
| Admin | `useSuperAdmin` | Super admin operations |
| Admin | `useSuperAdminGuard` | Route guard for super admin access |
| Operations | `useCheckIn` | Attendance scanning + badge QR validation |
| Operations | `useAbstracts` | Abstract submission + review workflows |
| Operations | `useCMS` | Page/Agenda/Speaker CMS operations |
| Operations | `useExcel` | Excel import/export for admin data |
| Vendors | `useVendor` | Vendor dashboard + booth visit tracking |
| Utils | `useTranslation` | i18n (ko/en) translations |
| Utils | `useSubdomain` | Extract society from hostname |

## CONVENTIONS

### Hook Signature
```typescript
// All hooks return: { data, loading, error } OR specific domain fields
export const useConference = (targetId?: string) => {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  // fetch, update state
  return state;
};
```

### Data Fetching
- Always use Firebase Firestore directly in hooks
- Collection group queries: check firestore.indexes.json before use
- Timeout pattern: 10s timeout with error state
- Loading states required before render

### Member Code Pattern
- `verifyMemberCode` → searches all `societies/{sid}/members` (collection group)
- Once verified: mark `used: true, usedBy: userId` to prevent reuse
- Re-verification: allowed only by same user

### Admin Hooks
- Always check permissions via context (SuperAdmin/SocietyAdmin/ConfContext)
- Admin operations separate from public hooks
- Admin-specific hooks prefixed: `useConferenceAdmin`, `useSocietyAdmin`

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** use `any` - import from `@/types/schema`
- **NEVER** fetch Firestore data directly in components - use hooks
- **NEVER** skip loading states - always handle `{ loading }` before render
- **NEVER** duplicate business logic - extract to hook if used >1 component
- **NEVER** mix UI logic in hooks - pure domain logic only
