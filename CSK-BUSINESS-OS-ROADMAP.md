# CSK Business OS — Product & Architecture Roadmap

Last updated: 24 November 2026

## 1. Product direction

Build one internal operating system for Cahaya Selatan Kreasindo (CSK) that follows the real workflow of a custom booth, exhibition, POSM, signage, acrylic display, and fabrication business.

The system must reduce repeated data entry and the amount of operational detail the owner has to remember. A record created once should be reused by the next stage instead of being retyped.

The public CSK website and this internal Business OS remain separate products. Changes in this repository must not modify or block the public website.

## 2. Verified current baseline

The internal repository is `cahayaselatankreasindo-dev/advertising-business-os`.

The current application is a responsive single-page HTML application using Tailwind CDN, Chart.js, and JavaScript modules. Its current backend and data layer use Google Apps Script and Google Sheets.

The active development branch `feature/csk-colorful-ui-20261124` contains the current integrated work (including the earlier HPP base from `feature/hpp-material-conversion-20261120`):
- CRM, clients, projects, finance, marketing spend, and business memory.
- HPP and custom material costing for sheet, roll, profile/bar, pack conversion, area, linear length, volume, and waste.
- Commercial quotations, invoice documents, payment records, and PDF generation.
- Sales Orders with approval, DP-release, and settlement controls.
- Inventory movement ledger, PO-linked receipts, and shortage-based draft purchase suggestions.

The feature branch is not a production release. Live schema migration, Apps Script deployment, and merge to `main` have not been completed. Existing release gates and security boundaries must remain in force.

## 3. Architecture decision

### Current decision — keep Google Apps Script + Google Sheets

For the current CSK Business OS release, **Google Apps Script remains the backend and Google Sheets remains the database**. This is the working architecture and the only architecture to develop against in this phase.

| Layer | Current implementation | Current decision |
|---|---|---|
| Frontend | Single-page HTML, Tailwind CDN, JavaScript modules | Improve the existing application; do not rebuild |
| Backend/API | Google Apps Script Web App | Keep and harden existing endpoints |
| Database | Google Sheets | Keep as the single source of truth |
| Authentication | Email + PIN through Apps Script | Keep the existing Owner/Team model; target PIN is 4 digits after credential rotation |
| File/document flow | Existing Google Drive and browser/PDF flows | Keep existing storage and document paths |
| Offline shell | Service Worker / PWA | Maintain cache versioning and safe refresh behavior |

Do not create or connect another database for this phase. Do not introduce Supabase, another hosted database, a second authentication provider, or dual-write transactions. Do not change production Script Properties, Sheets, or Apps Script deployment as part of source-code-only work.

### Development principle

1. Improve the existing CSK Business OS in small, reviewable slices.
2. Preserve the tested Google Apps Script and Google Sheets contracts.
3. Reuse existing customer, project, material, quotation, invoice, Sales Order, PO, and inventory identifiers between modules.
4. Keep Owner/Team authorization on the backend. Hiding a button in the frontend is not a security boundary.
5. Keep payment and inventory history auditable; never silently fabricate cash receipts or stock movements.
6. Keep all source changes on a feature branch until the Owner reviews and approves the release.

### Future architecture research

Any database replacement or authentication redesign is **deferred**. Existing Supabase research documents in this repository are reference notes only; they do not authorize provisioning, integration, migration, or spending. Revisit only if the Owner explicitly asks for it after the current Google Apps Script + Sheets workflow has been stabilized.

## 4. Target business workflow

```text
Lead / Enquiry
    -> Client + Project
    -> Brief, Measurement, Scope
    -> Material & Service Estimation
    -> HPP + Waste + Labour + Overhead
    -> Selling Price + Margin
    -> Quotation
    -> Approval
    -> Sales Order
    -> Material Demand + Stock Reservation
    -> Purchase Requisition / Purchase Order
    -> Goods Receipt
    -> Production
    -> QC + Revision
    -> Delivery / Installation
    -> Invoice
    -> Verified Payment
    -> Actual Project Cost + Net Margin
    -> Handover + Archive
```

Each stage must reuse the project, customer, material, and document identifiers from the previous stage. A status change must not silently fabricate a payment, stock receipt, or completed production task.

## 5. Proposed data model

Use relational tables with stable UUID primary keys, foreign keys, timestamps, and explicit status fields. Final names and columns must be validated against the live Sheets schema before any migration.

| Domain | Proposed tables | Key rules |
|---|---|---|
| Identity | `profiles`, `role_permissions` | Roles are server-controlled; never trust a role selected in the browser |
| CRM | `leads`, `clients`, `lead_activities` | Preserve source, follow-up history, and stable lead-to-client conversion |
| Projects | `projects`, `project_events`, `project_tasks` | Keep brief, deadline, owner, stage, revisions, and handover history |
| Materials | `materials`, `material_units`, `material_conversions`, `suppliers`, `supplier_prices` | Store usage unit, purchase unit, conversion factor, supplier, effective date, and price source |
| Costing | `costing_sheets`, `costing_lines`, `project_costs` | Keep formula inputs, waste/offcut assumptions, and immutable price snapshots |
| Sales | `quotations`, `quotation_lines`, `sales_orders`, `sales_order_lines` | Accepted quotation snapshots must not change when master prices later change |
| Purchasing | `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines` | Ordered quantity and received quantity must reconcile; receiving is recorded, not inferred |
| Inventory | `inventory_transactions`, `stock_reservations` | Append-only movement ledger; no negative stock; reservation and physical stock are distinct |
| Billing | `invoices`, `invoice_payments` | Invoice value is not cash received; payments are recorded only after actual receipt is verified |
| Finance | `expenses`, `cash_transactions`, `marketing_spend` | Reconcile actual cash movement and project costs; avoid duplicate journals |
| Documents | `documents`, `document_versions` | Private file access, stable references, version history |
| Governance | `audit_logs` | Record actor, action, entity, timestamp, and relevant before/after changes |

## 6. Business rules that must survive modernization

1. **HPP snapshots:** quotation and approved cost values preserve the material price, unit conversion, quantity, waste, and formula assumptions used at the time of calculation.
2. **Commercial approval:** only an approved quotation can be converted to a Sales Order.
3. **Payment truth:** a won deal or issued invoice is not a cash receipt. Finance reflects money actually received and verified.
4. **DP gate:** production release follows the agreed DP/payment condition recorded in the payment ledger.
5. **Inventory truth:** physical stock changes only through verified opening balances, receipts, issues, returns, and adjustments.
6. **Purchasing truth:** a PO is not stock. Stock increases only when goods are received and validated against the PO.
7. **Append-only ledger:** inventory and payment histories are corrected through compensating entries, not silent deletion.
8. **Role boundaries:** Team users receive only the records and actions required for their work; Owner-only finance, HPP, purchasing, and sensitive business data remain protected.
9. **Auditability:** important status, price, approval, payment, stock, and permission changes have traceable history.
10. **Document safety:** internal HPP and margin are not exposed in customer-facing quotations or invoices.

## 7. UI / UX direction

### Visual concept: Colorful Premium Business Dashboard

The visual system uses a deep indigo navigation shell, CSK orange as the primary brand accent, and controlled module colours:
- CRM: blue
- Finance: emerald
- HPP and materials: cyan
- Services and operations: violet
- Marketing: pink
- Purchasing: amber

Use a light, calm canvas with pastel surfaces and saturated colours only for navigation, key actions, charts, and important metrics. The app should feel lively without turning every element into a competing colour.

### Daily-use requirements

- Responsive desktop sidebar and compact mobile navigation.
- Dashboard with useful KPIs, active projects, overdue follow-ups, and cash received.
- Quick actions for lead, project, quotation, purchase, and payment.
- Search and filters that work consistently across modules.
- Short forms with sensible defaults, saved drafts, clear validation, and no repeated customer/material entry.
- Visible sync/save state, conflict recovery, and last verified backup/sync time.
- Distinct empty, loading, success, and error states.
- Accessible contrast, visible keyboard focus, and reduced-motion support.
- Customer-facing documents remain clean, printable, and separate from the colourful internal interface.

### Current UI implementation slice

The branch `feature/csk-colorful-ui-20261124` now adds a reusable visual foundation and shared component layer: `csk-visual-refresh.css` styles the brand shell and dashboard; `csk-ui-components.css` gives all 14 operational modules consistent colour identities, page headers, forms, cards, tables, modals, toast, and mobile navigation. The design rules are documented in `CSK-DESIGN-SYSTEM.md`, with separate regression tests for both layers. This remains a visual-only implementation; browser QA on real desktop and mobile devices is still required.

## 8. Delivery phases

| Phase | Scope | Release condition |
|---|---|---|
| 0. Protect baseline | Preserve current Apps Script, Sheets mapping, role boundaries, backups, and sync behavior | No production changes |
| 1. Visual foundation | Complete colorful UI, dashboard, module headers, desktop/mobile navigation, forms, tables, and empty/error states | UI review + regression tests |
| 2. Workflow integration | Validate Lead → Client/Project → HPP → Quotation → Invoice → Payment → Sales Order → DP gate → Production → Inventory/PO receiving | Cross-module contract tests pass |
| 3. Data and sync hardening | Validate Google Sheets mappings, upsert/merge behavior, duplicate prevention, retry handling, and Owner/Team data filtering | Mapping, RBAC, and sync tests pass |
| 4. Operational QA | Test desktop, iPhone Safari, Android, PDF downloads, forms, navigation, and offline cache refresh | Browser QA checklist completed |
| 5. Controlled release | Review PR, back up production Sheets, deploy Apps Script only when required, then release frontend assets | Explicit Owner approval |
| 6. Operations expansion | Add stock reservation, pick lists, offcut tracking, actual-versus-estimated HPP, supplier invoice matching, and deeper analytics | Each feature independently tested and approved |

No phase in this plan requires a new database or authentication provider.

## 9. Explicit non-goals until approved

- Do not modify the public CSK marketing website from this repository.
- Do not merge the visual branch or current feature work into `main` automatically.
- Do not deploy Apps Script or change production Script Properties without explicit Owner approval.
- Do not write to production Google Sheets or migrate its schema without a reviewed plan and explicit approval.
- Do not create, connect, or migrate to Supabase or another database in the current phase.
- Do not add a second login or a second source of truth.
- Do not run dual-write transactions between Google Sheets and another database.
- Do not replace tested HPP, payment, inventory, commercial document, or sync logic with unverified rewrites.

## 10. Read-only source audit completed — 24 November 2026

- Inspected the current `FIELD_MAP`, `LEGACY_READ_MAP`, frontend data collections, Apps Script read/write actions, and critical payment, Sales Order, PO, and inventory validations.
- Confirmed 16 current mapped Sheets and 2 legacy read-only Sheets from source code. Live row counts and production data were not accessed.
- Documented the field mappings, business invariants, and future data-model considerations in repository notes.
- This audit does not change the current architecture: Google Apps Script + Google Sheets remain authoritative. Database replacement research is parked and is not part of the current work.

## 11. Authentication decision — 24 November 2026

- Keep the existing Google Apps Script login as the only production authentication path.
- The target short PIN is 4 digits for Owner and Team, with different PINs for each role.
- PINs remain salted and hashed in Script Properties. Five failed attempts trigger a 15-minute lockout.
- Existing 8–12 digit PINs remain compatible until the Owner performs the documented rotation on the updated Apps Script version.
- The 4-digit change is not live until Apps Script is deployed and the Owner rotates credentials. Do not announce the new PIN length before that release is tested.
- Self-service PIN/password management and any Supabase Auth migration are deferred; neither is a priority for the current release.

## 12. Immediate next steps

1. Complete visual review of the colorful dashboard and all 14 operational modules on desktop and mobile.
2. Run the full operational workflow audit: HPP → quotation → invoice/payment → Sales Order → production gate → material demand → PO → goods receipt → inventory balance.
3. Verify Google Sheets mapping, Owner/Team permissions, sync conflict handling, and backup/recovery procedures.
4. Complete browser QA for iPhone Safari, Android, desktop, and PDF output.
5. Keep the work in feature branches. Merge and deploy only after the Owner reviews and approves the release.

## 13. Four-digit PIN update — 24 November 2026

- PIN setup and rotation now require exactly 4 digits for Owner and Team, and store the configured PIN length with the salted hash.
- Existing 8–12 digit credentials remain accepted during transition until the Owner rotates both PINs. After rotation, only 4-digit PINs are accepted.
- Login throttling for registered emails now persists in Script Properties and uses LockService for updates: five failed attempts trigger a 15-minute lock. Session storage remains in CacheService.
- Frontend validation and helper text support the transition. The deployed Apps Script Web App still requires a new deployment; GitHub changes do not deploy Apps Script automatically.


## 14. Architecture scope confirmation — 24 November 2026

The Owner confirmed that CSK Business OS should continue using the existing Google Apps Script + Google Sheets architecture and that Supabase is not required now. All current development, tests, and release planning must stay within this architecture. Supabase-related documents are parked as historical/future reference only. No Supabase tools, project changes, schema migrations, or authentication changes are in scope unless the Owner explicitly reopens that decision.


## 15. Dashboard workflow improvement — 24 November 2026

- Dashboard project queue now prioritises overdue deadlines, deadlines today, upcoming deadlines, and projects without a deadline. Project statuses are labelled separately as Perencanaan, Pengerjaan, and Review klien.
- Dashboard lead queue now prioritises overdue follow-ups, follow-ups today, scheduled follow-ups, and unscheduled leads. Won/Lost leads are excluded.
- Added an Owner-only `Buat Penawaran` quick action that opens the existing quotation editor; Team users do not see this finance-restricted action.
- Four dashboard quick actions use a balanced 2×2 layout on mobile.
- Local calendar dates are used for due-state calculations to avoid UTC date shifts. WhatsApp links use opener isolation.
- Added dashboard regression tests and included them in the security and source regression suites. Both suites passed on commit `2fa697836080d6cab35b44c2665cec29a0b24a63`.
- PWA manifest and service worker cache versions are aligned at `3.2.12`.
- No live Google Sheets rows, Apps Script deployment, or production credentials were changed.

## 16. HPP snapshot integrity — 24 November 2026

- Importing a saved HPP into a Quotation stores the full source HPP snapshot, including material/service lines, quantities, units, prices, labor, other costs, margin, costing summaries, and material unit-conversion assumptions.
- Commercial_Quotations and Sales_Orders persist the source snapshot in dedicated JSON columns. setupSheet adds these columns to the right of existing headers without replacing existing data.
- The backend verifies a new or changed draft Quotation snapshot against the saved Cost_Sheets row. Once the Quotation is no longer a draft, its HPP source snapshot cannot be replaced or removed.
- A Sales Order must carry the exact snapshot from its approved Quotation. If a legacy approved Quotation has no snapshot, the current project HPP is captured when the Sales Order is created. The Sales Order snapshot is immutable after creation.
- Sales Order material planning, active-order commitments, and shortage-based Draft PO creation use the Sales Order snapshot rather than silently switching to a later project HPP.
- Material conversion uses the unit and conversion factor recorded in the HPP snapshot. If the stock base unit in Material Master has since changed, the plan reports an error and blocks Draft PO creation until the discrepancy is reviewed.
- Existing Sales Orders without a saved snapshot continue using the legacy current-HPP fallback; the Sales Order UI labels this state explicitly.
- Regression coverage now spans HPP import → Quotation → Invoice → Sales Order → material demand and server-side Google Sheets persistence. All changes remain source-only; no Apps Script deployment, production Sheet migration, or merge to main is performed here.

## 15. Integration checkpoint — 25 November 2026

- Commercial PDF layout and multi-page pagination are integrated from PR #33. The latest security and business-source regression workflows passed after merge.
- The inventory commitment bridge is integrated from PR #29 into this development branch.
- This branch is the current integrated UI/operations staging line. The older PR #27 target was updated to the inventory-bridge development branch for review; GitHub currently reports branch divergence, so no merge is attempted until reconciliation is complete.
- The current branch remains isolated from `main`, the public website, production Apps Script deployment, live Google Sheets, and Supabase.
- Remaining release gates: rerun the full CI suite on this exact integrated head, reconcile any branch-only changes without force-pushing, and complete desktop/iPhone browser QA plus owner-supervised Apps Script/Sheets migration review.

## 16. Development integration status — 25 November 2026

- PR #33 (commercial PDF layout/pagination) merged and passed the post-merge security and business-source regression workflows.
- PR #29 (inventory material-commitment bridge) merged into the colorful UI staging branch.
- PR #27 (colorful UI and operational workflow integration) merged into this development branch after the PR base was aligned and CI passed on its head.
- The older PR #26, #30, and #24 were closed as superseded. In particular, PR #30 used a second reservation-ledger design and must not be merged beside the integrated reservation model.
- This branch is the current integrated development/release-candidate line. It is not production.
- Remaining release gates are a fresh full CI run on this exact branch head, desktop/iPhone/Android browser QA, and a separately approved Owner-run Apps Script schema/deployment and Google Sheets verification.

## 17. Inventory, HPP, and iOS document workflow completion — 25 November 2026

- PR #31 integrated the atomic Inventory_Reservations model, Owner-only reservation/release, Sales Order HPP snapshot validation, reservation-aware issue limits, and material picking controls into this development branch.
- PR #32 was merged into the reservation-core branch before PR #31 integration. Its return workflow ties every return to the original Sales Order and reservation ID, nets issue/return quantities, and reactivates reservation balances after a valid return.
- Material, product, and service activation now waits for verified Google Sheets sync; local activation is rolled back if cloud verification fails.
- HPP preserves supplier purchase price, unit conversion, and waste allowance separately. Draft POs use supplier purchase units and purchase prices; receiving converts to stock units.
- The advertising reference catalog contains 53 material families and 41 product/service families; the initial CSK material master has 101 draft SKU rows. These are reference templates, not verified live supplier prices. Do not activate unpriced or unverified materials.
- PDF delivery uses Blob URLs and an iOS/iPad preview flow with a Save to Files fallback. The later PR #33 pagination improvements are included; the PWA manifest and service worker are aligned at version 3.2.27.
- PR #31 head validation: CSK Security Tests run 1207 PASS; CSK business source regression checks run 1024 PASS. PR #32 head validation: Security Tests run 1146 PASS and business-source checks run 995 PASS. The integrated colorful UI branch also passed Security Tests run 1227 and business-source checks run 1037.
- Remaining work is operational acceptance, not another competing reservation ledger: complete real-device browser/PDF QA, verify Owner/Team behavior against a test Apps Script deployment, and prepare a reviewed schema migration checklist. No production deployment, live Sheet writes, or main-branch merge has been performed.

## 18. Release acceptance checklist — staging only

### A. Prepare isolated test environment
- [ ] Duplicate the production Google Sheet to a clearly named TEST copy; do not connect staging to the live spreadsheet.
- [ ] Create a separate Apps Script TEST deployment bound only to the test copy.
- [ ] Configure test-only Owner and Team identities/PINs through the approved Apps Script security setup. Never paste credentials into GitHub or ChatGPT.
- [ ] Confirm the frontend points to the TEST endpoint and that the public marketing website has no dependency on this application.

### B. Verify access and data boundaries
- [ ] Owner can access all authorized modules; Team is limited to Leads, Clients, and Projects.
- [ ] Team cannot read or write HPP, purchasing, Sales Orders, inventory, finance, quotations, invoices, or private business memory through direct backend calls.
- [ ] Four-digit PIN rotation, failed-login throttling, session expiry, and logout behave as expected on the TEST deployment.
- [ ] Apps Script source copies remain byte-identical after any release packaging.

### C. Verify the complete business workflow
- [ ] Create a test Lead, convert it to one Client and one Project, and repeat the conversion to confirm idempotency.
- [ ] Create a test Material SKU as Draft; verify activation is blocked until supplier, purchase price, purchase unit, usage unit, conversion factor, waste, price source, and price date are complete.
- [ ] Build and save HPP with material, product/service, custom cut-list costing, and a frozen price snapshot.
- [ ] Create a Quotation from the saved HPP, approve it, and verify customer PDF excludes internal HPP/margin data.
- [ ] Convert the approved Quotation to one Sales Order; verify repeated conversion does not create a duplicate.
- [ ] Record a real test payment in the payment ledger; confirm production release is blocked before the required DP is verified.
- [ ] Set the Sales Order to Ready Production; verify atomic reservation blocks competing orders from reserving the same physical stock.
- [ ] Record partial material issue, then return part of that exact issue against the same Sales Order/reservation; verify the reservation balance reactivates correctly.
- [ ] Create a supplier-unit Draft PO from a material shortage, mark it Ordered, receive it in stock units using the verified conversion, and verify over-receipt is rejected.
- [ ] Verify cancellation/delivery releases unused reservation and invoice settlement is required before Sales Order closure.
- [ ] Verify inventory balance, active reservations, HPP estimate, net issue/return, and cost variance reconcile for the test project.

### D. Device and document acceptance
- [ ] Desktop Chrome/Edge: navigation, modal scrolling, tables, forms, save/sync, PDF download and multi-page pagination.
- [ ] iPhone Safari: login, mobile navigation/safe areas, quotation/invoice PDF preview, Share → Save to Files, and reopening the saved PDF.
- [ ] Android Chrome: login, navigation, forms, PDF download and PWA refresh.
- [ ] Confirm service-worker update from version 3.2.27 does not keep stale HTML/CSS or break an active session.

### E. Production release gate
- [ ] All automated regression suites pass on the final integrated commit.
- [ ] Owner reviews test evidence, backup/restore procedure, schema additions, and Apps Script deployment diff.
- [ ] Only after explicit Owner approval: take a fresh production backup, run the reviewed schema setup, deploy the approved Apps Script version, verify read-back, then release the internal frontend.
- [ ] Keep rollback instructions and the prior Apps Script deployment available. Do not merge to main or deploy the public website as part of this Business OS release.

## 17. CRM compatibility integration — 25 November 2026

- PR #35 merged into the integrated development branch after all CSK Security Tests passed.
- Legacy lead statuses are normalized for display/filtering: Baru, Dihubungi, Deal Menang, Batal, and their supported English aliases.
- Legacy project statuses are normalized: Perencanaan, Pengerjaan, Review Klien, Selesai.
- Indonesian day-first date values such as `08/11/2026` and `08.11.2026` are read as local dates and normalized in memory; invalid dates are rejected.
- Normalization does not rewrite or migrate original Google Sheets values.
- Regression tests cover explicit ISO `today`, legacy date parsing, legacy status filters, and closed-lead/project summary behavior.
- Older PR #23 is closed as superseded. PR #34 is also closed as superseded because its reservation-return implementation and tests are already present in the integrated branch.
- CI on PR #35 passed: syntax, mapping/RBAC, commercial documents, workflow simulation, backend security, dashboard, CRM, invoice/payment, Photo LAB, and colorful UI checks.

## 18. Release readiness — still gated

The integrated feature branch is a development candidate, not a live deployment. Before production release:
1. Run a final full regression workflow on the exact integrated branch head after the last merge.
2. Perform browser QA on desktop, iPhone Safari, and Android, including PDF download/print and service-worker update.
3. Back up the production Google Sheet and review the exact new columns/tabs before any schema setup.
4. Have the Owner run the approved Apps Script setup/deployment and verify login, Owner/Team visibility, one test quotation, invoice, payment, Sales Order, reservation, issue/return, and PO receipt.
5. Only after the Owner confirms those checks, prepare the production release PR/deployment.

No Apps Script deployment, production Sheets write/schema migration, Script Properties change, Supabase change, or public website deployment has been performed.

## 19. Terminal reservation reconciliation hardening — 25 November 2026

- PR #36 merged into the integrated development branch.
- Inventory validation now derives terminal Sales Order states from both persisted Google Sheets records and the incoming sync snapshot. Cancelled, delivered, and closed orders therefore stop reserving stock even when the order is omitted from a later inventory-only sync payload.
- Automatic terminal-reservation reconciliation now reads persisted Sales Orders as well as incoming changes, so stale active reservation rows can be released while retaining their audit history.
- Added a regression case for a terminal status already persisted in Sheets before the next stock transaction.
- PR #36 passed both CI workflows: CSK Security Tests and CSK business source regression checks. The merged commit has the same Git tree as the tested PR head.
- The canonical Apps Script source and `google_apps_script.js` mirror remain byte-identical.
- No production deployment, live Google Sheets write/schema migration, Supabase change, Script Properties change, or public website deployment was performed.


## 20. Explicit schema migration gate — 25 November 2026

- Normal `sync_all` is now data-only. It preflights the mapped sheet contracts before the first record write and refuses to create tabs or append missing headers.
- Owner sync checks all mapped business sheets, including the server-owned Invoice Payments and Inventory Reservations ledgers. Team sync checks only Leads, Clients, and Projects.
- `ensureSheet` and `ensureAllHeaders` are strict by default. Only the explicit `setupSheet()` operation passes the schema-mutation flag to create tabs or append columns.
- Reservation, inventory, invoice-payment, and generic record-write paths now fail with `SCHEMA_SETUP_REQUIRED` when their required sheet contract is absent or incomplete.
- Added regression coverage proving a missing sheet or header blocks the entire sync, does not create/append schema, and does not partially write an earlier collection.
- Canonical `google_apps_script.js` and deployment mirror `apps-script/Code.gs` are updated together and remain byte-identical.
- PR #37 was squash-merged into `feature/csk-inventory-bridge-fix-20261124` as commit `bec68295586a18f298aeb78b25d62ee7b10abbb3` after both PR-head workflows passed.
- Post-merge CSK Security Tests passed on the exact integrated commit. The canonical Apps Script source and deployment mirror remain byte-identical.
- The integrated branch remains isolated from `main`; no Apps Script deployment, production Google Sheets write, schema migration, Supabase change, or public website deployment has been performed.


## 21. Read-only spreadsheet schema audit — 25 November 2026

- Added `auditCSKSchemaReadOnly()` and a CSK Security menu entry for owners to inspect the bound spreadsheet without changing it.
- Report includes mapped and legacy read-only tab presence, row counts, missing/duplicate/extra headers, and unclassified auxiliary tabs. It does not read business row values.
- Added regression coverage showing the audit reports a missing tab without recreating it and leaves all spreadsheet rows unchanged.
- PR #38 was squash-merged into `feature/csk-inventory-bridge-fix-20261124` as commit `4f3350bcac42fb4242340348adffd8d1252bf3bd` after both PR-head workflows passed; post-merge CSK Security Tests also passed.
- Use this report on the approved TEST copy first; it can also be run against production in read-only mode if an owner explicitly chooses to inspect the live schema. The function has not been executed against any live spreadsheet and no Apps Script deployment has been performed.


## 22. CRM conversion preflight hardening — 25 November 2026

- Owner sync_all now preflights Leads, Clients, and Projects because every Owner sync invokes the automatic Deal Won conversion path after collection merges.
- update_status preflights all three CRM dependencies before changing a Lead to Deal Won; a missing Client or Project tab therefore cannot leave the Lead status partially changed.
- autoTriggerPillars independently validates all three CRM sheet contracts before creating or updating any Client/Project record, including when invoked by a direct Apps Script trigger.
- Regression tests cover a missing Project tab blocking an unrelated Finance sync before any Finance write, and a missing Client tab blocking a Deal Won status change without changing the Lead.
- Development branch only. No production Apps Script deployment, live Google Sheets write, schema migration, or public website change.


## 23. Finance and Invoice dependency preflight — 25 November 2026

- Finance sync now requires the Invoice Payments ledger because the server-side Finance validator reads it to protect derived payment journal rows, including when the incoming Finance rows are ordinary expenses or income.
- Invoice sync now preflights Cost Sheets because commercial document validation reads the current HPP snapshot source.
- Regression tests prove that missing Invoice Payments or Cost Sheets blocks the full sync before an earlier Lead collection can be written and never recreates the missing tab.
- Development branch only. No production Apps Script deployment, live Google Sheets write, schema migration, or public website change.


## 24. PWA asset-cache completeness — 25 November 2026

- Added the Master Material module (`material-master.js`) and the CSK material seed (`data/csk-material-master-seed.json`) to the Service Worker precache. Previously the Master Material UI and its 101-SKU import seed were not guaranteed to be available offline after installation.
- Bumped the Service Worker cache and web manifest version together to 3.2.28 so existing clients install the updated asset list.
- Added an automated PWA cache-integrity test that compares all local scripts and stylesheets referenced by `index.html`, plus both catalog/material data seeds, against the precache list and verifies the cache/manifest version match. Static asset network failures now return a network error instead of incorrectly serving `index.html` as JavaScript/CSS/data; only navigation requests use the HTML fallback.
- Development branch only; no deployment or production data changes.


## 25. Reorder planning — 25 November 2026

- Added an Owner-configurable reorder point to each Master Material SKU. A zero value disables reorder monitoring; no minimum stock is guessed or auto-populated.
- Inventory now shows reorder suggestions when physical stock less active Sales Order commitments falls below the configured threshold.
- Suggestions show physical stock, committed stock, available stock, threshold, and the gap to replenish. They do not create or send Purchase Orders automatically; the Owner must review open POs and physical stock first.
- Added regression tests for commitment deduction, below/at/above-threshold behavior, and exclusion of Draft materials.
- Development branch only; no production schema migration, Apps Script deployment, or live Google Sheets write.


## 26. End-to-end operational contract — 25 November 2026

- Added one cross-module regression that links approved Quotation and HPP snapshot to Sales Order creation, verified DP production release, HPP material commitment, reservation-linked issue and return, linked PO receipt, reorder alert clearing, delivery, and fully paid close.
- The test verifies that underpaid DP cannot release production, committed stock is deducted before reorder calculations, issued stock reduces outstanding HPP commitment, PO receipt updates stock balance, and terminal Sales Orders stop reserving materials.
- This is a deterministic code-level simulation using test fixtures; it does not connect to or write to a live Google Sheet.
