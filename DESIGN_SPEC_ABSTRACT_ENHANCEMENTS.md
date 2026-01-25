# Design Specification: Abstract Submission Feature Enhancements

**Date:** 2026-01-24
**Target Audience:** Frontend Engineers, UI/UX Designers
**Version:** 1.0

## 1. Overview
This document outlines the design specifications for enhancing the Abstract Submission feature in the eRegi platform. The goal is to improve usability for academic conference participants by clarifying user status, streamlining navigation, and implementing deadline-driven UI states.

## 2. Current State Analysis

### 2.1 Existing UI (`AbstractSubmissionPage.tsx`)
- **Header:** Lacks global navigation (Back button) and clear user identity (Member vs. Non-Member) context.
- **Layout:** Displays the submission form (Step 1-3) *above* the submission history. This emphasizes "New Submission" over "Management".
- **Member Display:** Only Non-Members see a specific banner (`L251`). Members have no visual confirmation of their logged-in identity/affiliation on this specific page.
- **Edit/Delete Logic:** Based on `reviewStatus` only (`L638`). No explicit deadline handling for locking edits.

### 2.2 User Pain Points
- Users cannot easily navigate back to the conference main page.
- Members are unsure if they are submitting under the correct account/affiliation.
- "Submission History" is pushed to the bottom, making it hard to find for users returning to check status.
- Lack of visual feedback when the submission/edit period has closed.

---

## 3. Proposed Enhancements

### 3.1 Layout Restructuring: "Dashboard First"
To address the requirement "Submission History only view", the page layout will shift from a "Form-First" to a "Dashboard-First" approach.

- **Default View:** Displays the **Submission History** list prominently.
- **New Submission:** The "Add New Submission" form is hidden by default and accessed via a primary action button, *only if* the submission period is open.
- **Reasoning:** Most user visits after the initial submission are to check status or edit.

### 3.2 Header Area
A new unified header bar at the top of the content area.

| Element | Position | Content / Behavior | Visual Style |
|:---|:---|:---|:---|
| **Back Button** | Left | `< ChevronLeft` "학술대회 홈으로" (Back to Conference) | Ghost button, Gray-600, hover:bg-gray-100 |
| **User Profile** | Right | `[Badge] Name (Affiliation)` | Flex row, right-aligned |

**User Profile Specs:**
- **Member:** `[Badge: 회원 (Member)] Name (Affiliation)`
  - Badge Color: Green (`bg-green-100 text-green-800`)
- **Non-Member:** `[Badge: 비회원 (Non-Member)] Name (Affiliation)`
  - Badge Color: Amber (`bg-amber-100 text-amber-800`)
- **Typography:** Name in `font-bold text-gray-900`, Affiliation in `text-sm text-gray-500`.

### 3.3 Submission History List (Main View)
The card display for existing submissions (`L589`) will be enhanced.

- **Status Badges:**
  - `Submitted` / `Under Review`: Gray/Secondary
  - `Accepted (Oral)`: Green
  - `Accepted (Poster)`: Blue
  - `Rejected`: Red
- **Action Buttons (Edit/Delete):**
  - **Condition:** Visible only if `CurrentDate <= EditDeadline`.
  - **State (Locked):** If deadline passed, replace buttons with a `Locked` indicator (Padlock icon + "수정 기한 마감").
- **Deadline Indicator:** If the deadline is approaching (within 24h), display a countdown or warning banner above the list.

### 3.4 Logic: Deadline-Based States
New configuration flags required from `Conference` context:
- `submissionDeadline`: Date/Time when *new* submissions are disabled.
- `editDeadline`: Date/Time when *editing* existing submissions is disabled.

**UI Behavior Matrix:**
| Current Time | New Submission Button | Existing Item Actions | Status Message |
|:---|:---|:---|:---|
| `< submissionDeadline` | **Visible** (Primary Color) | Edit / Delete | "접수 중 (Open)" |
| `> submissionDeadline` AND `< editDeadline` | **Hidden** | Edit / Delete | "신규 접수 마감 / 수정 가능" |
| `> editDeadline` | **Hidden** | **Locked** (View/Download Only) | "최종 마감 (Closed)" |

---

## 4. Visual Guidelines

### 4.1 Typography
- **Headings:** Inter/Pretendard, `font-bold`, `text-gray-900`.
- **Body:** `text-gray-700`, `leading-relaxed`.
- **Meta Info:** `text-sm`, `text-gray-500`.

### 4.2 Colors (Tailwind Tokens)
- **Primary Action:** `#003366` (Navy) - `bg-[#003366] hover:bg-[#002244]`
- **Secondary Action:** White with Border - `border-gray-200 hover:bg-gray-50`
- **Destructive:** Red - `text-red-600 hover:bg-red-50`
- **Background:** Light Gray - `bg-gray-50/50` for page, White for cards.

### 4.3 Spacing & Layout
- **Container:** `max-w-4xl mx-auto`.
- **Padding:** `py-12 px-4 sm:px-6`.
- **Card Spacing:** `gap-4` between list items.
- **Internal Card Padding:** `p-6` (Desktop), `p-4` (Mobile).

---

## 5. Accessibility & Responsive Requirements

### 5.1 Responsive Breakpoints
- **Mobile (< 640px):**
  - Header: Stack "Back Button" and "User Profile" vertically.
  - List Items: Stack "Title", "Status", and "Actions" vertically.
  - Buttons: Full width (`w-full`).
- **Tablet/Desktop (≥ 640px):**
  - Header: Row layout (Space between).
  - List Items: Row layout.

### 5.2 Accessibility (A11y)
- **Contrast:** Ensure badges (Green/Amber) have 4.5:1 contrast ratio against background.
- **Keyboard Nav:** All buttons (Back, Edit, Delete, Download) must be focusable.
- **ARIA Labels:**
  - Back Button: `aria-label="Go back to conference home"`
  - Status Badges: `aria-label="Submission Status: Accepted"`
  - Edit Button: `aria-label="Edit submission: [Title]"`

---

## 6. Implementation Notes for Engineers

1.  **Navigation:** Use `useNavigate` for the Back button. Path: `/${slug}`.
2.  **User Data:** Derive "Name/Affiliation" from `auth.user` (Member) or `nonMember` object. Fallback to "Unknown" with strict null checks.
3.  **Deadline Logic:** Implement a utility `isSubmissionOpen(conf)` and `isEditOpen(conf)` to centralize date comparison logic.
4.  **Components:** Reuse `EregiButton`, `Badge`, `EregiCard` from `src/components/eregi`.
