# Frontend Pages - Route Handlers

**Purpose**: 54 pages organized by domain - user registration, conference info, admin dashboards, and public content.

## OVERVIEW

All React Router v7 routes are defined in `src/App.tsx` with domain-based routing. Pages are organized by business domain and wrapped in appropriate layouts with context providers. This directory covers **non-admin pages only** - admin pages have their own AGENTS.md at `src/pages/admin/AGENTS.md`.

## STRUCTURE

```
pages/
├── admin/                 # Admin pages (see src/pages/admin/AGENTS.md)
├── auth/                  # Authentication & account management
├── vendor/                # Vendor dashboard & booth management
├── RegistrationPage.tsx           # Main conference registration flow
├── RegistrationSuccessPage.tsx    # Payment success confirmation
├── RegistrationFailPage.tsx       # Payment failure handling
├── ConferenceDetailHome.tsx       # Public conference info page
├── ConferenceBadgePage.tsx        # Digital badge display
├── BadgePrepPage.tsx              # Badge preparation (QR scan)
├── ProgramPage.tsx                # Conference agenda/program
├── AbstractSubmissionPage.tsx     # Abstract submission form
├── CheckStatusPage.tsx            # Registration status check
├── UserHubPage.tsx                # User dashboard (member)
├── NonMemberHubPage.tsx           # Non-member portal
├── SocietyLandingPage.tsx         # Society home page (public)
├── SocietyLoginPage.tsx           # Society member login
├── MembershipPaymentPage.tsx      # Society membership fee payment
├── FinalConferenceHome.tsx        # Conference landing (wide layout)
├── StandAloneBadgePage.tsx        # Standalone badge view (shareable)
├── LandingPage.tsx                # Platform landing page
├── PlatformLanding.tsx            # Platform intro
├── PlatformHome.tsx               # Platform home
├── NotFoundPage.tsx               # 404 error page
├── TermsPage.tsx                  # Terms of service
└── PrivacyPage.tsx                # Privacy policy
```

## WHERE TO LOOK

| Domain | Page | Purpose | Route Pattern |
|--------|-------|---------|---------------|
| **Registration Flow** | RegistrationPage | Main conference registration form | `/:slug/register` |
| | RegistrationSuccessPage | Post-payment success confirmation | `/:slug/success` |
| | RegistrationFailPage | Payment failure/error display | `/:slug/fail` |
| | BadgePrepPage | Badge preparation after registration | `/:slug/badge-prep/:token` |
| **Conference Info** | ConferenceDetailHome | Public conference information | `/:slug` |
| | ConferenceBadgePage | Digital badge display | `/:slug/badge` |
| | ProgramPage | Conference agenda/schedule | `/:slug/program` |
| | FinalConferenceHome | Wide layout conference landing | `/:slug/home` |
| | StandAloneBadgePage | Shareable badge view | `/badge/:badgeQr` |
| **Abstract** | AbstractSubmissionPage | Abstract submission form | `/:slug/abstract` |
| **Status Check** | CheckStatusPage | Registration status lookup | `/:slug/check-status` |
| **User Hub** | UserHubPage | Member dashboard (My Page) | `/hub` |
| | NonMemberHubPage | Non-member portal | `/guest-hub` |
| **Society** | SocietyLandingPage | Society public home page | `/society/:slug` |
| | SocietyLoginPage | Society member login | `/society/:slug/login` |
| | MembershipFeeSettingsPage | Membership fee payment | `/society/:slug/membership` |
| **Vendor** | VendorPage | Public vendor page | `/vendor/:vendorId` |
| | VendorDashboard | Vendor dashboard (booth visits) | `/vendor/:vendorId/dashboard` |
| **Auth** | AuthPage | Authentication portal | `/auth` |
| | NewAuthPortal | Unified auth (login/signup) | `/auth/new` |
| | AccountRecoveryPage | Password/account recovery | `/auth/recovery` |
| **Platform** | LandingPage | Platform landing | `/` |
| | PlatformLanding | Platform introduction | `/landing` |
| | PlatformHome | Platform home | `/home` |
| **Legal** | TermsPage | Terms of service | `/terms` |
| | PrivacyPage | Privacy policy | `/privacy` |
| **Error** | NotFoundPage | 404 page | `*` (catch-all) |

## CONVENTIONS

### Route Organization

**Domain-based routing** (defined in `src/App.tsx`):
```typescript
// Society subdomain routing (e.g., kap.eregi.co.kr)
if (hostname.includes(societyDomain)) {
  return <SocietyRoutes />;  // SocietyLandingPage, etc.
}

// Admin domain routing (e.g., admin.eregi.co.kr)
if (hostname.includes('admin')) {
  return <AdminRoutes />;    // Admin pages
}

// Main/user domain routing (default)
return <MainRoutes />;       // Registration, conference info, etc.
```

### URL Parameters

Common parameters across pages:
- `:slug` - Conference slug (e.g., `kap_2026spring`)
- `:token` - Badge prep token (36-char UUID)
- `:badgeQr` - Badge QR code for shareable links
- `:societyId` - Society identifier
- `:vendorId` - Vendor identifier

### Layout Hierarchy

Pages are wrapped by layouts that provide context providers:
```
SocietyLayout → SocietyContext → Society pages
ConfLayout → ConfContext → Conference-specific pages
VendorLayout → VendorContext → Vendor pages
(no layout) → Public pages (LandingPage, NotFoundPage, etc.)
```

### Data Access Patterns

**ALWAYS use hooks - never fetch Firestore directly in pages:**
```typescript
// ✅ CORRECT - Use custom hooks
const { conference, loading, error } = useConference(slug);
const { user } = useAuth();

// ❌ WRONG - Direct Firestore access in page
const doc = await getDoc(doc(db, 'conferences', confId));
```

### Payment Flow Pages

**Registration → Payment → Badge Prep sequence:**
1. `RegistrationPage` → User fills form, selects payment method
2. Payment gateway (Toss/Nice) → Redirects back to success/fail
3. `RegistrationSuccessPage` → Displays confirmation, redirects to BadgePrepPage
4. `BadgePrepPage` → Shows QR code for badge pickup
5. `ConferenceBadgePage` → Digital badge after issuance

### Loading States

**ALL pages must handle loading states:**
```typescript
if (loading) return <LoadingSpinner />;
if (error) return <EmptyState message={error} />;
if (!data) return <EmptyState message="데이터를 찾을 수 없습니다" />;
```

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** fetch Firestore directly in pages - use hooks from `@/hooks`
- **NEVER** hardcode conference IDs - use URL parameters or context
- **NEVER** skip loading states - always handle `{ loading, error, data }`
- **NEVER** use `any` for Firestore models - import from `@/types/schema`
- **NEVER** render page content without authentication check for protected routes
- **NEVER** mix domains (e.g., admin UI in public pages) - keep separation clear
- **NEVER** use `useNavigate` without proper error handling for invalid routes

## UNIQUE STYLES

### Multi-Domain Routing
Pages behave differently based on hostname:
- **Society subdomain** (`kap.eregi.co.kr`) → Society landing page
- **Admin domain** (`admin.eregi.co.kr`) → Admin dashboard
- **Main domain** (`eregi.co.kr`) → Conference registration & info

### Bilingual Content Support
Pages use bilingual components for Korean/English:
```typescript
import { BilingualInput } from '@/components/ui/bilingual-input';
import { BilingualImageUpload } from '@/components/ui/bilingual-image-upload';
```

### Member vs Non-Member Paths
Separate page flows:
- **Members**: `UserHubPage` → Full dashboard with society memberships
- **Non-members**: `NonMemberHubPage` → Limited portal with registration history only

### External Attendee Support
Special pages for external attendees (no Firebase Auth initially):
- `BadgePrepPage` with `isExternalAttendee` flag
- `StandAloneBadgePage` for shareable badge links
- Auto-created Firebase Auth via `generateFirebaseAuthUserForExternalAttendee` CloudFunction

### Conference Homepage Variants
Two different conference landing pages:
- `ConferenceDetailHome` - Standard conference info page
- `FinalConferenceHome` - Wide layout with hero, pricing, program, speakers (for production conferences)

## NOTES

### Gotchas
1. **Slug Validation**: Always validate conference slug before fetching data - invalid slugs should redirect to 404
2. **Badge Token Expiry**: Badge prep tokens expire based on conference end date + 24h (or 7d fallback)
3. **Payment Redirects**: Payment gateways redirect with query parameters - always validate payment success before showing confirmation
4. **Society Context**: Society pages require `SocietyContext` - don't render society-specific UI without it
5. **Vendor Authentication**: Vendor pages require vendor-specific authentication via `VendorContext`

### Performance
- Page-level code splitting via React Router v7 lazy loading
- Conference data cached in `ConfContext` to avoid re-fetching
- User session persisted via Firebase Auth with `browserSessionPersistence`

### Internationalization
- Korean (primary) and English (secondary) support
- `useTranslation` hook for i18n via `src/i18n/` (custom implementation, not react-i18next)
- Bilingual UI components for content management

### Testing
- Playwright E2E tests for critical flows (registration, payment)
- See `registration-guest.spec.ts` for test patterns
- Tests use environment variables (`BASE_URL`, `TEST_SLUG`) for flexibility
