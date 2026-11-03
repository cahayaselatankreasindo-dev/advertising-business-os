# CSK Business OS — Integration Release Gate (3 Nov 2026)

> **Status: STAGING SOURCE, NOT PRODUCTION.** Draft PR #4. Do not merge, expose a shared Web App, run setupSheet on the production database, rotate production secrets, or deploy to live Google Apps Script without a backup and release approval.

## Integrated architecture
- Frontend: `index.html` PWA, `sync-safe.js` record-based delta queue with GET readback and UI for reconciliation.
- Backend: `google_apps_script.js`, protocol version 2, Google Sheets eight-module contract, `LockService` + compare-and-set fingerprints.
- Roles: Owner token reads/writes eight modules; Team token only Leads, Clients, Projects. Frontend role display does not grant server permissions.
- Commercial Engine: `costings` (quotation, HPP, margin) + `projectCosts` (cost ledger); separate local estimator is still available at `page-hpp`.
- Financial integrity: Won lead never fabricates a down payment. Invoice uses *recorded* income explicitly tied to `projectId`; unlinked receipt is not counted.
- Marketing: Auto-send cold email disabled. Drafts are manually reviewed.
- PWA branding: official logo, local favicon, app icon, and updated cache.

## Automated gates
GitHub Actions workflow: `Check Business OS safe sync`, including:
```bash
node --check sync-safe.js
node sync-safe.test.js
node sync-backend-integration.test.js
node mapping.test.js
node commercial-costing.test.js
node commercial-invoice.test.js
node hpp-calculator.test.js
node email-marketing.test.js
node operations.test.js
node operations-photo-lab.browser.test.cjs
```
These tests use an emulated backend / local browser fixtures. A green CI result does **not** validate Apps Script HTTP, Google Sheets production schema migration, multi-user confidentiality on shared devices, or full deployment readiness.

## Release gates that must remain open
1. Isolated Google Spreadsheet + Apps Script deployment with dummy data only. Confirm connected project IDs, active guard handlers and `LAB_HANDLER_GUARD_PASS`.
2. Real browser-to-Apps Script GET and POST over HTTP on Android, desktop and iPhone; check CORS, redirects, rate limits, offline and retry.
3. Two-device race: simultaneous edit, stale delete, conflict review, and recovery under `LockService`.
4. Security: missing/wrong Owner and Team tokens; forged role; Team POST/GET Finance, Costings, Project_Costs and Memory; stale PWA protocol rejection.
5. Backup/restore on local and staging database, including deleted records, orphaned cost references and round-trip of `projectId`.
6. Quotation print/PDF visual QA and invoice receipt reconciliation with real browser print engine. Verify no HPP/margin leak on customer copies.
7. Security assessment: tokens in URL/LocalStorage are vulnerable on shared devices; do not treat token as per-person login. Do not open access broadly.
8. Review PR #4, obtain release approval, prepare rollback plan, then deploy backend and frontend in coordinated sequence.

## Rollback
Keep source on `main` untouched during staging. Preserve production Google Sheets backup and production Apps Script deployment version identifier before release. Roll back frontend to last verified GitHub Pages commit and backend to last verified Apps Script deployment if live smoke checks fail. Never overwrite production data with a staging export.

## Important separation
`apps-script/Code.gs` (from another development branch) is not automatically deployed from GitHub. The source file `google_apps_script.js` in this integration branch is the intended backend contract, but the staging LAB must be verified separately before any migration. No live endpoint connection or production release is claimed by this document.
