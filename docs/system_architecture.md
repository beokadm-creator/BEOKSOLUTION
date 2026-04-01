---
precedence: 82
required-for:
  - architecture-review
optional-for:
  - repo-orientation
memory-type: architecture
token-estimate: 1208
@include:
  - shared/AI_DOC_SHARED_RULES.md
  - shared/ESSENTIAL_POST_COMPACT.md
changelog:
  - version: 1.0.0
    date: 2026-04-02
    summary: Normalized under the repository markdown governance schema.
---

<!-- STATIC:BEGIN -->

# eRegi System Architecture & Composition Research

## 1. System Overview
The eRegi platform is a Multi-Tenant Conference and Society Management System built as a Single Page Application (SPA). It serves various roles including Super Admins, Society Admins, Conference Admins, Vendors, and normal Users (Attendees/Members). 

### Core Tech Stack
- **Frontend Framework**: React 19 with Vite (using `rolldown-vite` for faster builds).
- **Routing**: React Router DOM v7.
- **State Management**: Zustand (Contexts are also heavily used for domain-specific states).
- **Styling**: Tailwind CSS v4, Radix UI (accessible headless primitives), `lucide-react` for icons.
- **Backend/Infrastructure**: Firebase Ecosystem
  - **Firebase Hosting**: Serves the frontend application.
  - **Firebase Functions**: Backend logic (e.g., payments processing like Toss/Nice, scheduled tasks).
  - **Firestore**: NoSQL Database for storing societies, conferences, users, registrations, and sub-collections.
  - **Firebase Auth**: Manages user authentication and session persistence.
- **Testing & Quality Assurance**: 
  - Jest & React Testing Library for unit/integration testing.
  - Playwright for E2E scenario testing.
  - ESLint, Husky for pre-commit linting and validation.

## 2. Multi-Tenant Architecture & Routing
The platform handles multitenancy primarily through two mechanisms: domains/subdomains and URL routing logic (managed in `src/App.tsx`).

### Tenant Identification
1. **Subdomains**: The application determines the active society or admin context by inspecting the hostname or `useSubdomain()` hook.
   - `admin.eregi.*` -> Routes to the Super Admin or general Admin login portal.
   - `<society_id>.eregi.co.kr` (e.g., `kap.eregi.co.kr`) -> Dedicates the site to a specific society.
2. **URL Parameters**: In development mode, `?society=xxx` is used to simulate subdomains.
3. **URL Slugs**: `/:slug/...` is used for specific conference data mapping (e.g., `/2026spring/register`).

### Route Priorities & Layouts
The React Router is configured with explicit Route Guards (`AdminGuard`) and Layouts:
- **L0 (Super Layout)**: Base level access (`/super`) for Super Admins.
- **L1 (Society Layout)**: Society Admin dashboard (`/admin/society/:sid`) managing infra, templates, members, and content.
- **L2 (Conference Layout)**: Conference-specific admin dashboards (`/admin/conf/:cid`) handling registrations, agenda, statistics, gate/infodesk operations.
- **L3 (Vendor Layout)**: Vendor-specific dashboards (`/admin/vendor/:vid`).
- **User Domains**: Handled via public routes like `/:slug/register`, `/:slug/badge`, `/:slug/abstracts`, and `/mypage`.

## 3. Data Flow and State Management
- **Custom Hooks**: 20+ hooks in `src/hooks/` (e.g., `useConference`, `useAuth`, `useConferenceAdmin`) encapsulate Firebase logic and provide standard `{ loading, error, data }` structures to avoid UI freezing or unsafe data access.
- **Firestore Schema**: 
  - Uses `src/types/schema.ts` for strict typing. `any` type is strictly discouraged.
  - **Root Collections**: `societies`, `users`, `super_admins`.
  - **Sub-collections / Derived Collections**: Data scoped under specific conferences (e.g., `conferences/{confId}/registrations`).
  - **Fallback Mechanisms**: Handles users who are non-members; in such cases, it gracefully falls back to `participations` documents rather than throwing errors if a `users/{uid}` document doesn't exist.

## 4. Key Components and Modules
- **`src/components/`**: Divided strictly by domain:
  - `admin/`: Super & society admin components.
  - `auth/`: Login, guards, and account recovery.
  - `conference/`: Conference loaders and contexts.
  - `payment/`: Integration handling components for Toss and Nice payments.
  - `print/`: Badge & certificate generation (uses `html2canvas`, `jspdf`, `react-to-print`).
  - `ui/`: Radix-based low-level reusable components.

## 5. Security & Deployment Strategy
- **Layered Checks**: Relies heavily on GitHub Branch protection, CI/CD pipelines (`.github/workflows/ci.yml`), and Husky pre-commit hooks containing strict rules (TypeScript compiler + ESLint).
- **Firestore Integrity**: Requires exact indexing. Collection Group Queries are utilized and strictly rely on `firestore.indexes.json`.
- **Safe Deployment**: Custom deployment scripts (`scripts/safe-deploy.js`, `scripts/pre-deploy-check.js`) wrap the Firebase CLI deployment steps `firebase deploy --only hosting,functions` to prevent regressions.

---
*Generated via automated research script for codebase documentation maintainability.*

<!-- STATIC:END -->

<!-- DYNAMIC:BEGIN -->

Update this section only for volatile facts such as current status, versions, owners, or execution notes.

<!-- DYNAMIC:END -->
