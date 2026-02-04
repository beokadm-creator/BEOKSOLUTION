# React Context Providers - State Management Layer

**Purpose**: 4 React Context providers that enable domain-based data sharing and role-based access control across the eRegi platform.

## OVERVIEW

Context providers form the critical state management layer for multi-tenant conference operations. Each provider wraps specific route segments (via layouts) to supply domain-specific data, user roles, and permissions to all child components.

## STRUCTURE

```
contexts/
├── GlobalContext.tsx      # Super admin access (god mode)
├── SocietyContext.tsx     # Society-level admin operations
├── ConfContext.tsx        # Conference-specific data & operations
└── VendorContext.tsx      # Vendor dashboard & booth management
```

## WHERE TO LOOK

| Context | Provider | Consumed By | Purpose |
|---------|----------|-------------|---------|
| `GlobalContext` | `GlobalProvider` | SuperLayout | Super admin privileges, cross-society access |
| `SocietyContext` | `SocietyProvider` | SocietyLayout | Society admin operations, member management |
| `ConfContext` | `ConfProvider` | ConfLayout | Conference data (info, pages, agendas, speakers) |
| `VendorContext` | `VendorProvider` | VendorLayout | Vendor dashboard, booth visit tracking |

## CONVENTIONS

### Context Composition Pattern
```typescript
// Layout hierarchy (NOT nested - separate layouts):
<SuperLayout>          {/* Wraps /super/* routes */}
  <GlobalProvider>...</GlobalProvider>
</SuperLayout>

<SocietyLayout>        {/* Wraps /admin/society/:sid/* routes */}
  <SocietyProvider>...</SocietyProvider>
</SocietyLayout>

<ConfLayout>           {/* Wraps /admin/conf/:cid/* routes */}
  <ConfProvider>...</ConfProvider>
</ConfLayout>
```

### Provider Data Structure
All providers expose:
- `loading: boolean` - Initial data fetch state
- `error: string | null` - Error message if fetch failed
- Domain-specific data (conference, society, etc.)
- Domain-specific operations (create, update, delete)

### ConfContext (Most Complex)
- Loads conference by `confId` from URL or context
- Fetches: info, pages, agendas, speakers, registrations
- Provides CRUD operations for CMS (pages, agendas, speakers)
- **Critical**: `confId` must match URL parameter or context

### GlobalContext (Super Admin)
- Provides `isSuperAdmin: boolean` flag
- Enables cross-society access (bypasses society restrictions)
- Used for: society creation, super admin dashboard, global user management

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** nest providers - each layout wraps its own routes independently
- **NEVER** consume context outside of its layout subtree - data will be undefined
- **NEVER** skip loading states before accessing context data - check `{ loading }` first
- **NEVER** use ConfContext for society-level operations - use SocietyContext instead
- **NEVER** use GlobalContext for regular admin operations - only super admin features

## UNIQUE STYLES

### Multi-Tenant Context Routing
- **Society Subdomain** → SocietyLayout → SocietyContext
- **Admin Domain** → SuperLayout → GlobalContext
- **Conference Routes** → ConfLayout → ConfContext
- **Vendor Routes** → VendorLayout → VendorContext

### Context Initialization
```typescript
// ConfContext initialization pattern
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
// SocietyContext pattern
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
- Context providers fetch data on mount
- Use React.memo for context consumers to prevent re-renders
- Conference data fetching uses Promise.all for parallel requests

### Testing
- Mock contexts in tests using `createContext` + custom mock provider
- Test loading/error states for context-dependent components
