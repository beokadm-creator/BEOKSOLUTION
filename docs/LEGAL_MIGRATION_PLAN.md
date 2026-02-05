# Legal & Footer Terms Migration Plan

## 1. Problem Identification
- **Current State**: The `LandingPage` footer uses hardcoded links to `TermsPage` and `PrivacyPage`.
- **Issue**: These pages currently contain placeholder English text/JSX, whereas the live Korean site requires specific Korean legal agreements.
- **Risk**: Hardcoding sensitive legal text involves deployment risks and makes updates difficult.

## 2. Objective
- Extract legal content into a managed configuration/data file (`src/data/legal.ts` or similar).
- Update `TermsPage` and `PrivacyPage` to render content dynamically.
- Ensure the Main Page footer correctly links to these pages.
- (Optional) Prepare `FOOTER_INFO` for dynamic updates if needed.

## 3. Implementation Strategy
### Step 1: Create Data Source
Create `src/data/legal_content.ts` containing the standard Korean "Terms of Service" and "Privacy Policy" text.
- Use a structured object: `{ termsOfService: { title, sections: [] }, privacyPolicy: { ... } }`.
- This ensures type safety and easy editing without touching UI logic.

### Step 2: Refactor Pages
- **TermsPage.tsx**: Replace hardcoded JSX with a loop that renders the `sections` from the data source.
- **PrivacyPage.tsx**: Similar refactoring.

### Step 3: Updates & Validation
- Update `LandingPage.tsx` to ensure it references the correct routes (already does).
- Verify `FOOTER_INFO` in `src/constants/defaults.ts` is accurate.

## 4. Safety & Rollback
- **Safety**: The changes are purely additive (new file) and strictly local to the two pages (`TermsPage`, `PrivacyPage` which are currently placeholders).
- **Rollback**: If issues occur, simply revert `TermsPage.tsx` and `PrivacyPage.tsx` to their previous state via Git.
