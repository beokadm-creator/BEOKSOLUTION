# Admin Pages - Conference Management UI

**Purpose**: 28 pages for super admin, society admin, and conference admin operations.

## STRUCTURE

```
pages/admin/
├── auth/                  # Admin authentication
├── conference/             # Conference-specific admin (kiosk routes)
│   └── attendance/         # Attendance subpages
├── DashboardPage.tsx       # Main admin dashboard
├── RegistrationListPage.tsx    # Registration management
├── RegistrationDetailPage.tsx   # Single registration view
├── AbstractManagerPage.tsx      # Abstract submission review
├── AgendaManager.tsx            # Agenda scheduling
├── MemberManagerPage.tsx        # Society member management
├── AttendanceLivePage.tsx       # Real-time attendance
├── AttendanceScannerPage.tsx     # QR scanner for check-in
├── AttendanceSettingsPage.tsx    # Attendance configuration
├── BadgeEditorPage.tsx          # Badge layout editor
├── ConferenceSettingsPage.tsx     # Conference configuration
├── RegistrationSettingsPage.tsx   # Registration periods + pricing
├── PageEditor.tsx               # CMS page editor
├── StatisticsPage.tsx            # Analytics dashboard
├── AdminRefundPage.tsx          # Refund processing
├── SuperAdminPage.tsx           # Global admin
└── TemplatesPage.tsx            # Template management
```

## WHERE TO LOOK

| Task | Page | Notes |
|------|-------|-------|
| Conference dashboard | DashboardPage | Stats, quick actions |
| Registration list | RegistrationListPage | Filters, bulk actions |
| Registration detail | RegistrationDetailPage | Single reg with all data |
| Abstract review | AbstractManagerPage | Accept/reject, review status |
| Member management | MemberManagerPage | Society member CRUD |
| Attendance check-in | AttendanceScannerPage.tsx | QR scanner for entry |
| Attendance kiosk | GatePage, InfodeskPage | Kiosk modes (conf/ route) |
| Badge design | BadgeEditorPage.tsx | Visual badge editor |
| Conference config | ConferenceSettingsPage | Basic info, dates, venue |
| Registration config | RegistrationSettingsPage | Periods, pricing, tiers |
| Page CMS | PageEditor | Rich text editor for pages |
| Admin auth | AdminLoginPage.tsx | Admin login |

## CONVENTIONS

### Layout Hierarchy
```
/admin/society/:sid/*      → SocietyLayout (SocietyContext)
/admin/conf/:cid/*         → ConfLayout (ConfContext)
/super/*                   → SuperLayout (GlobalContext)
```

### Admin Routing
- Society admin: `/admin/society/:sid`
- Conference admin: `/admin/conf/:cid`
- Kiosk routes: `/admin/conf/:cid/gate`, `/admin/conf/:cid/infodesk`

### Data Access
- Use custom hooks from `@/hooks` (never direct Firestore calls in pages)
- Admin state via `@/store/adminStore` (selectedConferenceId, etc.)
- Context providers wrap layouts, not pages

### Admin Guards
- `AdminGuard` component wraps admin routes
- Check permissions via context before rendering
- Redirect to login if not authenticated

### Statistics & Queries
- Collection group queries require indexes (check firestore.indexes.json)
- Real-time data: use Firestore listeners where needed
- Aggregation: maintain counters or use Firebase extensions

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** bypass AdminGuard for admin routes
- **NEVER** fetch Firestore directly in pages - use hooks
- **NEVER** hardcode conference IDs - use adminStore or context
- **NEVER** ignore permission checks - always verify role
- **NEVER** render admin UI without loading states
