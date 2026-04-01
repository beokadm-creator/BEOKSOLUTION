---
precedence: 91
required-for:
  - path-specific-code-changes
optional-for:
  - repo-orientation
memory-type: policy
token-estimate: 899
@include:
  - ../../docs/shared/AI_DOC_SHARED_RULES.md
  - ../../docs/shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Aligned path-specific agent instructions to the shared markdown governance schema.
---

<!-- STATIC:BEGIN -->

# Component Library - Domain-Specific UI

**Purpose**: 67 components organized by business domain - Radix UI primitives + custom domain components.

## STRUCTURE

```
components/
├── admin/              # Admin-specific widgets (GlobalSearch, ConferenceSelector)
├── auth/               # Auth guards (AdminGuard)
├── common/             # Shared UI (LoadingSpinner, EmptyState, ErrorBoundary)
├── conference/         # Conference pages (RegistrationModal, AgreementModals)
│   └── wide/           # Wide layout components (WideHero, WidePricing, etc.)
├── eregi/              # Core registration UI (EregiForm, EregiNavigation)
├── layout/             # Layout components (Header)
├── payment/            # Payment handlers (NicePaymentForm, PaymentSuccessHandler)
├── print/              # Print templates (BadgeTemplate, ReceiptTemplate)
├── shared/             # Cross-domain utilities (PaymentIntegrationCenter)
└── ui/                # Radix UI primitives (button, dialog, card, etc.)
```

## WHERE TO LOOK

| Domain | Directory | Key Components |
|--------|-----------|----------------|
| Admin UI | admin/ | GlobalSearch, ConferenceSelector, ContextSwitcher |
| Auth guards | auth/ | AdminGuard |
| Shared UI | common/ | LoadingSpinner, EmptyState, GlobalErrorBoundary |
| Conference | conference/ | ConferenceLoader, RegistrationModal, LegalAgreementModal |
| Conference Landing | conference/wide/ | WideHero, WidePricing, WideProgram, WideSpeakers, WideFooter |
| Registration | eregi/ | EregiForm, EregiNavigation, DataWidget |
| Layouts | layout/ | Header |
| Payment | payment/ | NicePaymentForm, PaymentSuccessHandler |
| Print | print/ | BadgeTemplate, ReceiptTemplate, PrintHandler |
| Radix UI | ui/ | button, card, dialog, input, table, etc. |

## CONVENTIONS

### Component Organization
- **ui/**: Radix UI primitives - generic, reusable across all domains
- **eregi/**: Core registration UI - domain-specific, used in registration flow
- **conference/**: Conference-specific components - modals, loaders
- **conference/wide/**: Wide layout landing page components (not narrow mobile)
- **admin/**: Admin dashboard widgets and controls
- Domain components import from ui/, never other domain components

### UI Primitives (ui/)
- Radix UI + Tailwind CSS
- Consistent props: `className`, `children`, `variant` (if applicable)
- No business logic - pure UI components

### Domain Components
- Can have business logic (e.g., EregiForm handles form submission)
- Import from `@/types/schema` for Firestore types
- Use hooks from `@/hooks` for data fetching
- State: controlled components with React state

### Print Components
- html2canvas + jspdf for PDF generation
- BadgeTemplate: printable badge layout
- ReceiptTemplate: payment receipt

### Styling
- Tailwind CSS classes (no CSS files except src/styles/)
- Bilingual support via `@/components/ui/bilingual-*` components
- Responsive design: Tailwind breakpoints (md, lg, xl)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** import domain components into ui/ directory
- **NEVER** mix domains (e.g., admin/ imports from eregi/)
- **NEVER** duplicate UI primitives - use existing ui/ components
- **NEVER** inline styles - use Tailwind classes
- **NEVER** fetch Firestore directly in components - use hooks
- **NEVER** skip error boundaries for admin pages

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
