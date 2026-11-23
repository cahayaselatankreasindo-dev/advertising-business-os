# CSK Business OS — Product & Architecture Roadmap

Last updated: 24 November 2026

## 1. Product direction

Build one internal operating system for Cahaya Selatan Kreasindo (CSK) that follows the real workflow of a custom booth, exhibition, POSM, signage, acrylic display, and fabrication business.

The system must reduce repeated data entry and the amount of operational detail the owner has to remember. A record created once should be reused by the next stage instead of being retyped.

The public CSK website and this internal Business OS remain separate products. Changes in this repository must not modify or block the public website.

## 2. Verified current baseline

The internal repository is `cahayaselatankreasindo-dev/advertising-business-os`.

The current application is a responsive single-page HTML application using Tailwind CDN, Chart.js, and JavaScript modules. Its current backend and data layer use Google Apps Script and Google Sheets.

The development branch `feature/hpp-material-conversion-20261120` contains work for:
- CRM, clients, projects, finance, marketing spend, and business memory.
- HPP and custom material costing for sheet, roll, profile/bar, pack conversion, area, linear length, volume, and waste.
- Commercial quotations, invoice documents, payment records, and PDF generation.
- Sales Orders with approval, DP-release, and settlement controls.
- Inventory movement ledger, PO-linked receipts, and shortage-based draft purchase suggestions.

The feature branch is not a production release. Live schema migration, Apps Script deployment, and merge to `main` have not been completed. Existing release gates and security boundaries must remain in force.

## 3. Architecture decision

### Immediate decision: improve the existing application, do not perform a big-bang rebuild

Keep the current app and its tested business logic as the reference implementation. Continue visual improvements in an isolated feature branch. Do not merge or deploy until the owner reviews the result and the required live integration checks pass.

Do not introduce a second live database or dual-write business transactions to Google Sheets and Supabase. Two sources of truth would create reconciliation errors, duplicate records, and uncertainty about which balance or payment is authoritative.

### Target architecture: staged modernization

| Layer | Current baseline | Target direction |
|---|---|---|
| Frontend | HTML, Tailwind CDN, JavaScript modules | Component-based React/Next.js + TypeScript after the workflow contract is stable |
| Database | Google Sheets | Supabase PostgreSQL as the authoritative transactional database |
| Authentication | Apps Script-backed Owner/Team login | Supabase Auth with server-verified roles and Row Level Security |
| File storage | Existing Google Drive / private Photo LAB flows | Private Supabase Storage buckets where migration is justified |
| Backend logic | Google Apps Script | PostgreSQL transactions/RPC for data invariants; Edge Functions for integrations and server-side orchestration |
| Reporting | In-app dashboard and Sheets | In-app analytics, exports, and optional one-way reporting to Sheets |

Supabase is the recommended target for the next generation because the Business OS is becoming a relational, multi-step transactional application. PostgreSQL is better suited to linked records, constraints, atomic workflows, auditability, and concurrent users than using spreadsheets as the primary operational database.

This is a target decision, not permission to create a paid project, migrate production data, or switch the current app. A dedicated CSK Supabase project, organization choice, and any quoted cost must be confirmed before provisioning.

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
| 0. Protect baseline | Preserve current feature branch, backups, role boundaries, and live release gates | No production changes |
| 1. Visual foundation | Apply the colour system, improve dashboard and responsive navigation, then review every module | Owner UI review + regression tests |
| 2. Workflow audit | Map every live Sheet tab, header, Apps Script action, business rule, and document template | Signed-off field mapping and data inventory |
| 3. Supabase design | Finalize schema, constraints, RLS policies, Storage access, and migration plan in an isolated development environment | Security and schema review |
| 4. Migration rehearsal | Import a copy of verified data, reconcile counts/totals/relationships, and run workflow tests with synthetic records | Zero unexplained differences |
| 5. Pilot and cutover | Freeze writes, take a verified backup, migrate, reconcile, switch the app, and retain a documented rollback route | Explicit owner approval |
| 6. Expand operations | Stock reservation, pick lists, offcut tracking, actual HPP, supplier invoice matching, and deeper analytics | Each module independently tested |

## 9. Explicit non-goals until approved

- Do not modify the public CSK marketing website from this repository.
- Do not merge the visual branch or current feature work into `main` automatically.
- Do not deploy Apps Script or change production Script Properties.
- Do not write to production Google Sheets or migrate its schema without a reviewed plan and explicit approval.
- Do not create a Supabase project or incur a new subscription/compute cost before confirming the organization and cost.
- Do not run dual-write transactions between Sheets and Supabase.
- Do not replace tested HPP, payment, inventory, or sync logic with unverified rewrites.

## 10. Read-only data audit completed — 24 November 2026

- Inspected the current `FIELD_MAP`, `LEGACY_READ_MAP`, frontend data collections, Apps Script read/write actions, and critical payment, Sales Order, PO and inventory validations.
- Confirmed 16 current mapped Sheets and 2 legacy read-only Sheets from source code. Live row counts and production data were not accessed.
- Documented source mappings, business invariants, data-model gaps and migration safeguards in `CSK-SUPABASE-DATA-AUDIT.md`.
- Drafted the target relational entities, transaction boundaries, Owner/Team authorization model, RLS requirements and migration sequence in `CSK-SUPABASE-SCHEMA-PLAN.md`.
- Confirmed the connected Supabase account has a project for a different application; it was not inspected or modified. No dedicated CSK project was provisioned and no database changes were applied.

## 11. Immediate next steps

1. Review the colourful dashboard and shared module component layer on desktop and mobile; complete browser QA and fix any visual regressions.
2. Audit each module's real workflows and extract reusable UI patterns without changing business logic.
3. Inventory the real Google Sheets schema and Apps Script endpoints, including production-vs-LAB boundaries.
4. Prepare the Supabase schema and RLS design as code and test fixtures first; provision an isolated project only after organization and cost confirmation.
5. Keep all work on feature branches until the owner reviews and approves the release.
