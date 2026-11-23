<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3d85a829-f82f-4f1e-bd67-833ae2afb5e3

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firestore Security Rules Testing

The repository uses `@firebase/rules-unit-testing` to enforce strict Multi-Tenant Role-Based Access Control (RBAC) across schools, students, classes, attendance, and user profiles.

### Running Rules Tests with Firebase Local Emulator

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Start the Firestore Local Emulator**:
   ```bash
   firebase emulators:start --only firestore
   ```

3. **Execute Rules Tests**:
   ```bash
   npm run test:rules
   ```

### Tested Security Guarantees:
- **Tenant Isolation**: A teacher or admin from School A is completely denied read and write access to students, classes, and attendance belonging to School B.
- **Unauthorized Access Prevention**: Unauthenticated or unaffiliated users cannot read or modify student records from any school.
- **Privilege Escalation Protection**: Users cannot modify their own `role` (to admin or super-admin), cannot self-assign `isSuperAdmin`, and cannot transition their own `status` to `active`.
- **Join Request Spoofing Denial**: Users cannot submit faculty join requests impersonating another user's `uid`.
- **Attendance Class Scope Enforcement**: Teachers can only write attendance records for classes designated in their `assignedClassIds`.
- **Super Administrator Oversight**: Super Admins verified via custom claims have authorized universal read/write access.

## Provisioning Super Administrators (Custom Claims)

Super Administrator authorization uses Firebase Auth custom claims (`superAdmin: true`) and verified Firestore profiles. Hardcoded emails are not trusted.

To securely provision or grant Super Administrator privileges to an account, use the administrative script:

1. Obtain a Firebase service account private key JSON from the Firebase Console (*Project Settings -> Service accounts -> Generate new private key*). **Never commit this file to version control.**
2. Set the environment variable pointing to the service account JSON:
   ```bash
   # Windows PowerShell
   $env:FIREBASE_SERVICE_ACCOUNT_KEY = "C:\path\to\service-account.json"

   # Linux / macOS / Bash
   export FIREBASE_SERVICE_ACCOUNT_KEY="/path/to/service-account.json"
   ```
3. Run the provisioning script with the target user's registered email:
   ```bash
   node scripts/set-super-admin.mjs <user-email>
   ```
4. The user's Firebase Auth token will now carry `{ superAdmin: true }` and their profile in Firestore will synchronize to `role: 'super-admin'`, `status: 'active'`. (The user must sign out and sign in again to refresh active token claims).

