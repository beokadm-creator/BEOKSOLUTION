I have completed the requested changes to fix the data mapping and display issues.

**Summary of Changes:**

1.  **Firestore Security Rules (`firestore.rules`)**:
    *   Added `allow read: if true;` for `agendas` and `speakers` subcollections to ensure program data is visible.

2.  **Components**:
    *   **Created `WideAbout.tsx`**: Implemented the About section component.
    *   **Created `WideFooter.tsx`**: Implemented the Footer component to display organization, address, email, and phone.
    *   **Updated `WideHero.tsx`**: Added the missing subtitle rendering with the requested styling (`text-blue-600` for visibility on white/light backgrounds, and animation).
    *   **Updated `WidePricing.tsx`**:
        *   Refactored the UI from a table to a card-based grid layout as requested.
        *   Updated the logic to handle the `prices` Map structure (e.g., Member/Non-Member prices) instead of a single amount.
        *   Updated the `PricingPeriod` interface to match the `config.pricing` structure (using `period` object).

3.  **Template (`ConferenceWideTemplate.tsx`)**:
    *   Imported `WideAbout` and `WideFooter`.
    *   Prepared `aboutData` and `footerData` from `config.content`.
    *   Replaced the inline About section with `<WideAbout />`.
    *   Replaced the inline Footer with `<WideFooter />`.
    *   Updated `<WidePricing />` to pass `config.pricing` directly, resolving the structure mismatch.
    *   Verified `<WideHero />` and `<WideProgram />` props are correctly passed.

These changes align with the "SOLO Coder" instructions to fix the address mismatches and ensure all data (About, Pricing, Hero Subtitle, Program, Footer) is correctly rendered.