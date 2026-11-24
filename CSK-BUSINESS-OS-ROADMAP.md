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
