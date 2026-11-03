# CSK Business OS — Integration Release Gate (3 Nov 2026)

> **Status: INTEGRATION STAGING, NOT YET MERGED TO MAIN.** Integration baseline: Draft PR #4. Optimization hardening PR #6 has been merged into this branch. Do not merge, expose a shared Web App, run setupSheet on the production database, rotate production secrets, or deploy to live Google Apps Script without a backup and release approval.

## Integrated architecture
- Frontend: `index.html` PWA, `sync-safe.js` record-based delta queue with authenticated POST readback and UI for reconciliation.
- Backend: `google_apps_script.js`, protocol version 2, Google Sheets eight-module contract, `LockService` + compare-and-set fingerprints.
- Roles: Owner token reads/writes eight modules; Team token only Leads, Clients, Projects. Frontend role display does not grant server permissions.
- Commercial Engine: `costings` (quotation, HPP, margin) + `projectCosts` (cost ledger); separate local estimator is still available at `page-hpp`.
- Financial integrity: Won lead never fabricates a down payment. Invoice uses *recorded* income explicitly tied to `projectId`; unlinked receipt is not counted.
- Marketing: Auto-send cold email disabled. Drafts are manually reviewed.
- PWA branding: official logo, local favicon, app icon, and updated cache.

## Optimization hardening — merged into integration staging

PR #6 has been squash-merged into `integration/secure-safe-sync-20261103` (commit `647555d5efa37e3445af5b8ad90e645c895c7964`). The following safeguards are now part of the integration staging source; production remains unchanged:

- Token-bearing requests are restricted to HTTPS Google Apps Script `/exec` deployment URLs; arbitrary hosts, query strings, credentials, and lookalike domains are rejected before network access. The bearer token is sent only in POST bodies.
- Local upserts are sent in verified batches of at most 40 records. A write POST is not treated as saved until an authenticated POST action `read` confirms the expected state.
- A committed write whose readback was interrupted is reconciled idempotently on retry; partially completed deletes can resume without overwriting a concurrent edit.
- Compare-and-set validation reads each affected sheet once per batch. Sheet merge reuses one data block for ID indexing and row comparison, and coalesces adjacent updates into a single `setValues` write.
- Exact duplicate rows in one payload remain idempotent; conflicting payload duplicates are rejected before any write.
- Existing duplicate IDs in a touched Google Sheets tab fail closed: `sync_all`, delete, and status updates refuse to guess which row is authoritative.
- The manual read-only Apps Script helper `auditDuplicateRecordIds()` reports duplicate IDs by tab without changing data; cleanup remains an owner-reviewed manual operation.
- `sync_all` and legacy `insert` now reject Finance/Costings/Project_Costs rows that point to missing Projects; Project_Costs requires a ProjectID. Project and Lead deletion is blocked while Finance, Costings, Project_Costs, or HPP still reference them.
- Local restore and explicit cloud replacement clear stale conflict markers. Backup import validates supported versions, required collections, record objects, IDs and duplicate IDs; it restores the conflict-recovery journal while stripping cloud URL/token state.
- Prototype-safe record indexes protect special IDs such as `__proto__` and `constructor`.
- Owner-only project automation is payload-scoped and remains opt-in; Team writes cannot trigger it.
- Legacy `insert` and `update_status` API actions also require explicit compare-and-set expectations; Team status updates cannot invoke Owner-only project automation.
- The PWA defers pinned CDN scripts and caches only approved static CDN assets. Apps Script API traffic remains outside the service-worker cache.

## Automated gates
GitHub Actions workflow: `Check Business OS safe sync`, including:
```bash
node --check sync-safe.js
node sync-safe.test.js
node sync-backend-integration.test.js
node service-worker.test.js
node apps-script/lab-contract.test.cjs
node apps-script/build-lab-bundle.cjs --check
node apps-script/lab-bundle.test.cjs
node mapping.test.js
node commercial-costing.test.js
node commercial-invoice.test.js
node hpp-calculator.test.js
node email-marketing.test.js
node operations.test.js
node operations-photo-lab.browser.test.cjs
```
These tests use an emulated backend / local browser fixtures. A green CI result does **not** validate Apps Script HTTP, Google Sheets production schema migration, multi-user confidentiality on shared devices, or full deployment readiness.

**Owner-reported validation:** The project owner states that the Business OS was already tested end-to-end by the prior Astra development agent and is ready for operational use. This is recorded as owner confirmation; automated CI remains a separate source-level regression check.

## Release gates that must remain open

- **BLOCKER — Apps Script environment separation:** `apps-script/.clasp.json` is the production Script ID, while the isolated LAB uses a different Script ID documented in `docs/lab-api-guard.md`. The staging `apps-script/Code.gs` contains LAB-only guarded code, so a `clasp push/deploy` from `apps-script/` would target production with the wrong source. Do not run `clasp` from that directory. The deployment helper remains fail-closed; create and verify a dedicated LAB working directory/configuration before any live LAB push.
- **Live Apps Script verification is not available from repository CI:** source-level tests do not prove that the deployed Web App runs these handlers. The owner must verify the active project ID, bound spreadsheet ID/name, installed `doGet/doPost` guards, and private `MYSELF` access in the Apps Script editor before running the non-mutating handler check.

1. Isolated Google Spreadsheet + Apps Script deployment with dummy data only. Confirm connected project IDs, active guard handlers and `LAB_HANDLER_GUARD_PASS`.
2. Real browser-to-Apps Script POST read/write over HTTP on Android, desktop and iPhone; verify GET returns `POST_REQUIRED`, and check CORS, ContentService redirects, rate limits, offline and retry.
3. Two-device race: simultaneous edit, stale delete, conflict review, and recovery under `LockService`.
4. Security: missing/wrong Owner and Team tokens; forged role; Team POST/GET Finance, Costings, Project_Costs and Memory; stale PWA protocol rejection.
5. Backup/restore on local and staging database, including deleted records, orphaned cost references and round-trip of `projectId`.
6. Quotation print/PDF visual QA and invoice receipt reconciliation with real browser print engine. Verify no HPP/margin leak on customer copies.
7. Security assessment: token is memory-only and no longer sent in the URL, but remains a bearer credential extractable during an active browser session; it is not per-person login. Do not open access broadly.
8. Review PR #4, obtain release approval, prepare rollback plan, then deploy backend and frontend in coordinated sequence.

## Rollback
Keep source on `main` untouched during staging. Preserve production Google Sheets backup and production Apps Script deployment version identifier before release. Roll back frontend to last verified GitHub Pages commit and backend to last verified Apps Script deployment if live smoke checks fail. Never overwrite production data with a staging export.

## Important separation
`apps-script/Code.gs` (from another development branch) is not automatically deployed from GitHub. The source file `google_apps_script.js` in this integration branch is the intended backend contract, but the staging LAB must be verified separately before any migration. No live endpoint connection or production release is claimed by this document. The isolated LAB manifest `apps-script/appsscript.json` is restricted to `MYSELF` / `USER_DEPLOYING`, and CI enforces that policy. The historical `backups` file has its unauthenticated web handlers and setup entry point disabled; CI checks that they stay disabled. The old `deploy-backend.ps1` also copied production source over the guarded LAB project and pushed/deployed it; it is now fail-closed, with CI asserting no `clasp push`/`clasp deploy` path remains.
