# CSK Advertising Business OS — security patch draft

Target architecture: Google Apps Script + Google Sheets, with no paid hosting dependency.

Branch: `security/google-apps-script-rbac`

## Policy
- Owner `cahayaselatankreasindo@gmail.com`: all modules.
- Team `zefdas@gmail.com`: Dashboard with safe CRM/project metrics, Leads, Clients, Projects.
- Cold email: request queue only; explicit Owner approval and separate Owner send action.
- Legacy direct send and scheduled automatic outreach must be disabled.

## Contents
- `security/Security.gs`: Google ID-token validation, short-lived server session, RBAC, Team response filtering, email approval queue.
- `security/INTEGRATION-CHECKLIST.md`: exact backend integration points and risks found in current code.
- `security/FRONTEND-REQUIREMENTS.md`: frontend migration and regression checklist.
- `security/tests/security-policy.test.mjs`: policy test suite (Node.js built-in test runner).

## Current status
Backend handlers and frontend guard are now integrated on this feature branch. `google_apps_script.js` requires session authentication for GET/POST, filters Team data, restricts Team sync to Leads/Clients/Projects, disables legacy direct cold email and makes the scheduled outreach handler a no-op. `index.html` loads the Google login gate and `security/guard.js`, removes the manual role selector and API-token field, and includes an Owner approval inbox. This is still a staging candidate, not production-ready: configure OAuth and Apps Script Script Properties, test both accounts against a staging spreadsheet, and complete browser regression tests before deployment.

## Run policy tests
Requires Node.js 20+:
```bash
node --test security/tests/security-policy.test.mjs
```

## Required before staging sign-in
- Replace the placeholder OAuth Client ID in `security/guard.js` with the actual Google OAuth Web Client ID.
- Set Apps Script Script Properties exactly as described in `GOOGLE-SETUP.md`.
- Supply the existing Apps Script Web App URL on the login gate.
- Deploy a staging Apps Script version only after the code review and run the two-account tests.

## Not authorized / not done
No main branch change, merge, production deployment, live Sheet mutation, OAuth client setup, or email send has been performed. The branch is a reviewable preparation for the actual handler/frontend migration and staging verification.
