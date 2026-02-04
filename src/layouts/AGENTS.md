# Layout Components - Route-Level Wrappers

**Purpose**: 5 layout components that wrap route segments to provide domain-specific context providers, navigation, and authentication guards.

## OVERVIEW

Layouts form the critical architectural layer that sits between React Router routes and page components. Each layout wraps specific route segments to supply appropriate context providers (GlobalContext, SocietyContext, ConfContext, VendorContext), navigation chrome, and authentication guards. Layouts are NOT nested - each wraps its own route tree independently.

## STRUCTURE

```
layouts/
├── SuperLayout.tsx            # Super admin routes (/super/*)
├── SocietyLayout.tsx          # Society admin routes (/admin/society/:sid/*)
├── ConfLayout.tsx             # Conference admin routes (/admin/conf/:cid/*)
├── VendorLayout.tsx           # Vendor dashboard (/vendor/:vid/dashboard)
└── MembershipPaymentLayout.tsx # Society membership payment (/society/:slug/membership)
```

## WHERE TO LOOK

| Layout | Wraps | Context | Purpose |
|--------|-------|---------|---------|
| `SuperLayout` | `/super/*` | GlobalContext | Super admin operations, cross-society access |
| `SocietyLayout` | `/admin/society/:sid/*` | SocietyContext | Society-level admin, member management |
| `ConfLayout` | `/admin/conf/:cid/*` | ConfContext | Conference-specific admin (CMS, registrations, agendas) |
| `VendorLayout` | `/vendor/:vid/dashboard` | VendorContext | Vendor dashboard, booth visit tracking |
| `MembershipPaymentLayout` | `/society/:slug/membership` | SocietyContext | Society membership fee payment flow |

## CONVENTIONS

### Layout Composition Pattern
```typescript
// Each layout wraps its own routes independently (NOT nested)
<Route path="/super/*" element={<SuperLayout />} />
<Route path="/admin/society/:sid/*" element={<SocietyLayout />} />
<Route path="/admin/conf/:cid/*" element={<ConfLayout />} />

// Inside each layout:
<LayoutProvider>
  <NavigationChrome>
    <Outlet />  {/* React Router v7 outlet for child routes */}
  </NavigationChrome>
</LayoutProvider>
```

### Provider Initialization
- **SuperLayout**: Wraps with `GlobalProvider`, checks `isSuperAdmin`
- **SocietyLayout**: Wraps with `SocietyProvider`, fetches society data
- **ConfLayout**: Wraps with `ConfProvider`, fetches conference info (info, pages, agendas, speakers)
- **VendorLayout**: Wraps with `VendorProvider`, fetches vendor data
- **MembershipPaymentLayout**: Wraps with `SocietyProvider`, payment-specific UI

### Navigation Chrome
- **SuperLayout**: Left navigation with super admin sections (societies, global users, security)
- **SocietyLayout**: Left navigation with society sections (members, conferences, settings)
- **ConfLayout**: Left navigation with conference sections (registrations, agendas, speakers, statistics)
- **VendorLayout**: Vendor-specific navigation (booth info, visit tracking)
- **MembershipPaymentLayout**: Minimal chrome, focused on payment flow

### Authentication Guards
- **SuperLayout**: AdminGuard component (requires super admin role)
- **SocietyLayout**: AdminGuard + society access check
- **ConfLayout**: AdminGuard + conference access check
- **VendorLayout**: Vendor authentication check
- **MembershipPaymentLayout**: Society member authentication

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** nest layouts - each wraps its own route tree independently
- **NEVER** consume context outside its layout subtree - data will be undefined
- **NEVER** skip loading states before accessing context data - check `{ loading }` first
- **NEVER** use ConfContext for society-level operations - use SocietyContext instead
- **NEVER** use GlobalContext for regular admin operations - only super admin features
- **NEVER** render page content without authentication check for protected routes

## UNIQUE STYLES

### Multi-Tenant Layout Routing
Each layout corresponds to a domain routing branch in App.tsx:
```typescript
// Society subdomain → SocietyLayout
if (hostname.includes('kap.eregi.co.kr')) {
  return <SocietyLayout />;
}

// Admin domain → SuperLayout
if (hostname.includes('admin.eregi.co.kr')) {
  return <SuperLayout />;
}

// Conference admin routes → ConfLayout
if (path.startsWith('/admin/conf/')) {
  return <ConfLayout />;
}
```

### Context Data Fetching
Layouts fetch data on mount and expose it via context:
```typescript
// ConfLayout example
useEffect(() => {
  if (!targetConfId) return;
  const loadConference = async () => {
    setLoading(true);
    try {
      const [info, pages, agendas, speakers] = await Promise.all([
        fetchConferenceInfo(targetConfId),
        fetchPages(targetConfId),
        fetchAgendas(targetConfId),
        fetchSpeakers(targetConfId),
      ]);
      setConferenceData({ info, pages, agendas, speakers });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  loadConference();
}, [targetConfId]);
```

### Permission Checks
```typescript
// SocietyLayout pattern
const canAccessSociety = (societyId: string) => {
  if (isSuperAdmin) return true;  // GlobalContext override
  return userSocietyId === societyId;
};
```

## NOTES

### Gotchas
1. **Context Not Available**: If you see "Cannot read properties of undefined", you're consuming context outside its layout
2. **Loading State Required**: Always check `if (loading) return <Spinner />` before accessing context data
3. **confId Mismatch**: URL confId must match context confId - mismatches cause data corruption
4. **Super Admin Override**: GlobalContext `isSuperAdmin` bypasses society restrictions - handle explicitly

### Performance
- Layouts fetch data on mount, so navigating between routes in the same layout reuses data
- Use React.memo for layout consumers to prevent re-renders
- Conference data fetching uses Promise.all for parallel requests

### Testing
- Mock contexts in tests using `createContext` + custom mock provider
- Test loading/error states for layout-dependent components
- Layout components should be tested with React Router's MemoryRouter

## RELATED DOCUMENTATION

- `src/contexts/AGENTS.md` - Context providers used by layouts
- `src/pages/admin/AGENTS.md` - Admin pages that use these layouts
- `src/hooks/AGENTS.md` - Custom hooks for accessing context data
- Root `AGENTS.md` - Architecture patterns and routing overview
