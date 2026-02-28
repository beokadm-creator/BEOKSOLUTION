# CRITICAL BUILD & DEPLOYMENT RULES

## 🚨 URGENT: DO NOT MODIFY VITE CONFIGURATION 🚨

**Status**: Active as of 2026-02-09
**Severity**: CRITICAL (Site Outage Risk)

### 1. MANDATORY: Usage of `rolldown-vite`
This project **MUST** use `rolldown-vite` instead of the standard `vite` package. This is configured in `package.json` via the `overrides` section:

```json
"overrides": {
  "vite": "npm:rolldown-vite@7.2.5"
}
```

**❌ FORBIDDEN ACTIONS:**
- **DO NOT** remove this override.
- **DO NOT** install standard `vite` (e.g., `npm install vite@latest`).
- **DO NOT** change the version unless you have verified it in a production-like environment.

**💥 CONSEQUENCES OF VIOLATION:**
Switching to standard `vite` causes **runtime ReferenceErrors** (e.g., `Cannot access 'Lx' before initialization`) in the production build. This leads to a **complete site outage** where no pages can be accessed.

---

### 2. Circular Dependencies
The project code contains circular dependencies (e.g., between UI components and utility libraries like `@/lib/utils`) that `rolldown-vite` handles gracefully but standard Vite or other bundlers may not.
- **Action**: When adding new UI components (like `alert.tsx`), ensure you do not introduce circular dependencies. 
- **Best Practice**: Inline simple utility functions (like `cn`) in the component file if importing them causes issues, or fix the architectural dependency cycle.

### 3. Deployment Safety Protocol
Before any deployment to production (`firebase deploy`):

1.  **Clean Install & Build**:
    ```bash
    rm -rf node_modules .vite dist
    npm install
    npm run build
    ```
2.  **Verify Output**: check that `dist/index.html` exists and assets are generated.
3.  **Local Preview**: Run `npm run preview` if possible to check for runtime errors before deploying.

---

**Reason for this rule**:
An incident on 2026-02-09 caused a production outage because the `rolldown-vite` override was removed to fix a minor build error. This resulted in a broken build being deployed. Always prioritize runtime stability over fixing minor build warnings by changing core infrastructure.
