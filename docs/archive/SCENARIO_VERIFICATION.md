# External Registrant Scenario Verification

## Scenario Description
1.  **Admin Entry**: Input external registrant details (Name, Email, etc.).
2.  **Registration**: Click "Register" button.
3.  **Force Signup**: Automatically create a member account (Force Signup) and issue a UID.
4.  **Voucher**: Issue a voucher using the generated values.
5.  **System Access**: The user should be able to access the "Course Taking System" (User Hub) like a normal member.

## Code Analysis & Status

| Step | Action | Status | Findings |
| :--- | :--- | :--- | :--- |
| 1 | Input Details | ✅ Ready | `ExternalAttendeePage.tsx` has the form and state. |
| 2 | Click "Register" | ✅ Ready | `handleIndividualRegister` saves data to Firestore. |
| 3 | **Force Signup & UID** | 🟢 **Deployed** | Cloud Function `generateFirebaseAuthUserForExternalAttendee` deployed. Ready for testing. |
| 4 | Issue Voucher | ⚠️ Partial | UI exists. Ready for verification. |
| 5 | System Access | 🟡 **Pending Verification** | Depends on successful signup (Step 3). Should work now. |

## Required Fixes
1.  **Backend**: Create `generateFirebaseAuthUserForExternalAttendee` Cloud Function.
    *   This function should create a Firebase Auth user with the provided email and password.
    *   It should return the real `uid`.
    *   It should update the `external_attendees` doc with the real `userId`.
2.  **Frontend**:
    *   Update `handleIndividualRegister` to call this Cloud Function *immediately* (to satisfy "Click Register -> Force Signup").
    *   Or, keep it in "Issue Badge" but rename/clarify the flow. Given the user's prompt ("Register button -> Force Signup"), I should move it to the Registration step.
3.  **Synchronization**: Ensure the `userId` in Firestore matches the Auth UID so permissions (Security Rules) work for "Normal Course Taking".

## Next Steps
I will implement the missing Cloud Function and update the Frontend logic to ensure immediate signup upon registration.
