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
Helper and documentation are on this feature branch. Existing `google_apps_script.js` and `index.html` are not yet changed. This is deliberate: the current frontend has several independent API call paths and localStorage role assumptions; an incomplete rewrite would create a false sense of security.

## Run policy tests
Requires Node.js 20+:
```bash
node --test security/tests/security-policy.test.mjs
```

## Not authorized / not done
No main branch change, merge, production deployment, live Sheet mutation, OAuth client setup, or email send has been performed. The branch is a reviewable preparation for the actual handler/frontend migration and staging verification.
