# CSK Business OS — Read-only Data & Backend Audit

**Audit date:** 24 November 2026  
**Scope:** Source-code audit of the current feature branch.  
**Source of truth inspected:** `google_apps_script.js`, `index.html`, `FIELD_MAP`, `LEGACY_READ_MAP`, and the existing regression-test workflow.  
**Safety:** This audit reads repository source only. It does not read, export, alter, or migrate production Google Sheets rows.

## 1. Executive summary

The current CSK Business OS is a single-page HTML application whose current operational backend is Google Apps Script and Google Sheets. The source defines **16 current mapped business sheets** and **2 legacy read-only sheets**.

The data model has already evolved beyond a simple CRM. It now includes custom material costing, customer-facing quotations and invoices, invoice payments, sales orders, purchasing, and an inventory movement ledger.

The migration should therefore be designed as a relational business system, not as a one-to-one copy of spreadsheet tabs.

No dedicated CSK Supabase project was found in the connected project list. A connected Supabase project exists for a different application; it was not inspected or modified. No Supabase schema, project, branch, or paid resource was created.

## 2. Current mapped sheets

The counts below are source-code schema counts, not live row counts.

| Current sheet | Columns | Current purpose | Proposed relational destination |
|---|---:|---|---|
| `Leads` | 18 | Prospect, source, value, status, PIC, follow-up dates and notes | `leads`, `lead_activities` |
| `Clients` | 7 | Client profile, project count, spend, rating and review | `clients`, optional `client_contacts` |
| `Projects` | 12 | Project value, status, deadline, SOP, PIC and source documents | `projects`, `project_tasks`, `project_events` |
| `Finance` | 6 | Cash income/expense journal entries | `cash_transactions` |
| `Memory` | 5 | Internal business notes and strategy records | `business_notes` |
| `Marketing_Spend` | 8 | Campaign platform, budget, spend and generated leads | `marketing_campaigns`, `marketing_spend` |
| `Materials` | 29 | Material master, dimensions, purchase/use units, price, conversion, waste and supplier references | `materials`, `material_prices`, `material_units` |
| `Cost_Sheets` | 12 | Project HPP, material/labour/other costs, margin and quoted price | `costing_sheets`, `costing_versions`, `costing_lines` |
| `Services` | 15 | Product/service catalogue and base cost/selling price | `services` or unified `catalog_items` |
| `Purchase_Orders` | 11 | Supplier, project, order status, total and item payload | `purchase_orders`, `purchase_order_lines` |
| `Sales_Orders` | 20 | Approved quotation conversion, DP requirement, status and history | `sales_orders`, `sales_order_lines`, `sales_order_events` |
| `Inventory_Transactions` | 16 | Opening, receipt, issue, return and adjustment stock movements | `inventory_transactions` |
| `Quotations` | 14 | HPP-linked quotation snapshot and source cost-sheet reference | `quotation_versions` or quotation snapshots |
| `Commercial_Quotations` | 27 | Customer-facing quotation document and terms | `quotations`, `quotation_lines`, `quotation_versions` |
| `Invoices` | 28 | Customer invoice document, source quotation and amounts | `invoices`, `invoice_lines` |
| `Invoice_Payments` | 12 | Verified payment ledger linked to invoice and finance record | `invoice_payments` |

### Special serialization and compatibility rules

- **Clients:** the application exposes both `rating` and `review`, but the Sheet stores them together in one `Rating_Review` cell using the `rating | review` convention. This is a deliberate special mapping, not an accidental missing column. The migration should split them into separate relational columns.
- **JSON payload columns:** `Cost_Sheets.ItemsJSON`, `Purchase_Orders.ItemsJSON`, `Sales_Orders.ItemsJSON`, `Sales_Orders.RiwayatJSON`, `Quotations.LinesJSON`, `Commercial_Quotations.LinesJSON`, and `Invoices.LinesJSON` contain structured arrays or histories. These should become child tables rather than opaque JSON-only records. A JSON snapshot may still be retained for audit/version reproducibility.
- **Legacy compatibility:** `Costings` and `Project_Costs` are read through `LEGACY_READ_MAP` and marked read-only in the returned data. They are not part of the current writable `FIELD_MAP`.
- **Application settings:** the frontend also stores Google Sheets URL, last-sync metadata and a display role. These are application configuration/session concerns, not ordinary business tables.

### Authentication detail confirmed in the frontend guard

The current frontend gate is injected by `security/guard.js`. It accepts email plus an 8–12 digit PIN, sends a login action to Apps Script, then reads business data using a server-side session ID. The browser does not persist the session ID in localStorage. The credential rotation helper is `rotateCSKPinCredentialsFromPrompt()`; the current repository does not contain a self-service password-change page in the Business OS UI. See `CSK-AUTH-MIGRATION-PLAN.md` for the migration path and the version-drift check required before cutover.

## 3. Current backend contract

### Read contract

The authenticated `get_data` response contains the current business collections, payment records, and a sync timestamp.

- Owner receives the full business dataset, including legacy costing archives.
- Team receives only `leads`, `clients`, `projects`, and `lastSynced`.
- Legacy `Costings` and `Project_Costs` are returned only to Owner.

### Write actions found in source

| Action | Current behavior | Migration requirement |
|---|---|---|
| `login` | Email + PIN login, server-verified | Replace with Supabase Auth; roles remain server-controlled |
| `logout` | Revoke current server session | Supabase Auth sign-out/session revocation |
| `sync_all` | Header-aware merge/upsert of allowed collections | Replace bulk sync with explicit transactional operations; no dual-write |
| `record_invoice_payment` | Owner-only verified payment write | Atomic database function/transaction |
| `insert` | Generic insert for allowed mapped sheets | Replace with table-specific inserts and constraints |
| `delete` | Owner-only delete with commercial-record guards | Prefer archive/void or compensating entries for financial and stock records |
| `update_status` | Restricted status updates | Use explicit state-transition functions |
| `send_cold_email` | Explicitly disabled | Remain disabled unless separately approved |

### Authentication and authorization

The current Apps Script backend validates email/PIN credentials, stores PIN hashes in Script Properties, maintains server-side sessions in CacheService, and re-checks role permissions on requests. The frontend Owner/Team selector is a display mode; it is not the security boundary.

The current role contract is simple:
- **Owner:** full business access.
- **Team:** access to Leads, Clients and Projects only; cannot delete; cannot write payment ledger; cannot directly write inventory transactions; cannot mark a deal Won unless Owner approval is already present.

The Supabase design must preserve this server-enforced boundary. Hiding a menu item or button is not authorization.

## 4. Business invariants already enforced in the current backend

These are requirements to preserve during migration:

1. **Payment ledger is server-only.** `Invoice_Payments` cannot be written through ordinary bulk sync or generic insert/delete.
2. **Payment correctness.** A payment must reference an existing non-cancelled invoice, use a valid date/type/method, have a positive integer amount, and cannot exceed the outstanding invoice balance. DP, installment and settlement rules are validated.
3. **Payment-to-finance reconciliation.** A verified invoice payment creates a corresponding Finance income entry with a deterministic `FIN-PAY-` reference. Retry with the same payment ID is idempotent; conflicting reuse is rejected.
4. **Paid invoice immutability.** Important document fields and line snapshots cannot be changed after payments exist; a paid invoice cannot be cancelled through the normal update path.
5. **Commercial document uniqueness.** Document numbers are checked for duplicates; a quotation source cannot be converted into multiple invoices.
6. **Sales Order approval gate.** A Sales Order requires an approved quotation, a valid project, matching quotation value/DP/items snapshots, and one SO per quotation.
7. **Sales Order status gate.** Status transitions are controlled. Production cannot proceed before the required DP is verified; an order cannot close while its invoice balance remains unpaid.
8. **Inventory ledger is append-only.** Existing transaction fields are immutable. New movements validate material, unit, quantity, date, movement type, project requirements and source.
9. **Inventory balance rules.** Opening stock can occur only once and must be first for a material; the dated ledger is checked for negative stock.
10. **PO receiving rules.** Receipts linked to a PO must match ordered material/unit and cannot exceed ordered quantity. A PO cannot be marked received until the full ordered quantity is received; a PO with receipts cannot be cancelled.
11. **Safe merge behavior.** Current `sync_all` merges by stable ID and preserves rows not present in the payload. It must not be changed back to destructive whole-sheet replacement.
12. **Legacy archives are read-only.** `legacyCostings` and `projectCosts` cannot be sent in normal sync payloads.

## 5. Data-model gaps to resolve before creating the Supabase schema

These are design gaps inferred from the current source schema. They do not mean the existing application is broken; they are the places where a relational database can improve data integrity.

### A. Missing relational references

- `Projects` stores `client` as a text value rather than a stable `clientId`.
- Materials carry `supplierId` and `supplierName`, but no dedicated supplier master sheet is mapped.
- Purchase Orders and inventory receipts also store supplier as text.
- Quotation and invoice documents retain client/contact text snapshots, which are useful for historical documents but should be linked to a canonical client record as well.

**Target:** introduce stable foreign keys such as `client_id`, `supplier_id`, `project_id`, `material_id`, `quotation_id`, and `invoice_id`, while retaining immutable customer-facing snapshots on issued documents.

### B. JSON blobs hide line-level data

Costing lines, quotation lines, invoice lines, PO lines, SO lines and SO history are embedded in JSON strings.

**Target:** use child tables with foreign keys and explicit numeric columns. Preserve an immutable source snapshot (or version record) for accepted quotations and Sales Orders so future master-price edits do not rewrite historical deals.

### C. Supplier and price history

Material master currently mixes dimensions, current purchase price, usage price, conversion factor, supplier identity, waste rate and price-source metadata.

**Target:** separate material specification from supplier-specific price history. Keep purchase unit, usage unit, conversion factor, effective date, price source and waste assumptions together in the cost snapshot used for each project.

### D. Cash movement versus project cost

The current Finance sheet combines manual cash movements with income entries generated from invoice payments. Legacy `Project_Costs` has project-specific cost detail.

**Target:** preserve the verified invoice-payment ledger as the canonical payment record. Separate cash transactions from project cost allocations, and link them explicitly. Do not count a payment-derived Finance row twice when computing revenue or project profit.

### E. Costing version history

The current cost sheet includes an update timestamp and quotation source references, but no dedicated normalized version table is defined in `FIELD_MAP`.

**Target:** introduce immutable costing versions and line snapshots. A quotation should reference the exact costing version and assumptions used when it was issued.

### F. Future operational capabilities

The current roadmap identifies stock reservations, pick lists, goods receipt workflows, offcut tracking and actual-versus-estimated HPP as future capabilities. Do not imply these are already implemented in the current Sheets schema.

## 6. Recommended target relational domains

| Domain | Proposed tables |
|---|---|
| Identity & access | `profiles`, role/permission source controlled by Owner |
| CRM | `leads`, `lead_activities`, `clients`, `client_contacts` |
| Projects | `projects`, `project_tasks`, `project_events` |
| Catalogue | `materials`, `material_units`, `material_prices`, `suppliers`, `services` |
| Costing | `costing_sheets`, `costing_versions`, `costing_lines`, `project_costs` |
| Commercial | `quotations`, `quotation_versions`, `quotation_lines`, `sales_orders`, `sales_order_lines`, `sales_order_events` |
| Purchasing & stock | `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`, `inventory_transactions`, `stock_reservations`, `material_offcuts` |
| Billing & finance | `invoices`, `invoice_lines`, `invoice_payments`, `cash_transactions`, `expenses` |
| Growth & knowledge | `marketing_campaigns`, `marketing_spend`, `business_notes` |
| Documents & governance | `documents`, `document_versions`, `audit_logs` |

## 7. Migration and cutover safeguards

1. Export and verify a read-only backup of every current and legacy Sheet before migration.
2. Capture source tab names, headers, record IDs, row counts and totals.
3. Normalize JSON arrays only after validating every payload; quarantine malformed rows instead of silently dropping them.
4. Import in dependency order: identities, suppliers/clients/leads, projects, materials/services, costing, quotations, invoices/payments, finance, purchasing, inventory, sales orders, and supporting notes/documents.
5. Reconcile record counts, unique IDs, document numbers, invoice totals, payment totals, outstanding balances, stock balances and project relationships.
6. Run synthetic end-to-end tests for quote approval, SO conversion, DP, production release, PO partial receipt, stock issue/return, invoice settlement and project close.
7. Cut over only after writes are frozen, final backup is verified, reconciliation has zero unexplained differences, and Owner explicitly approves.
8. After cutover, keep one authoritative write database. Do not dual-write live transactions to Sheets and Supabase. Sheets may remain a read-only archive or receive one-way reports if needed.

## 8. Supabase project and current-version notes

- No dedicated CSK Supabase project is confirmed. The connected project list contains an unrelated project; it was left untouched.
- Do not create a project or incur a subscription/compute cost until the CSK organization and plan are confirmed.
- Current Supabase guidance requires RLS on exposed tables and careful policies. Do not rely on user-editable `user_metadata` for authorization; use server-controlled role data or `app_metadata`, and account for JWT refresh when roles change.
- Never expose a service-role/secret key in browser code.
- Current Supabase changelog includes a CLI v3 breaking change: CLI v3 is local-first and confirms hosted changes. It also documents a Production Branches read-write permission requirement for hosted branch merges. Check the installed CLI version and its `--help` before any future CLI operation; do not assume old commands or hosted defaults.

## 9. Official references

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Custom Claims and RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control)
- [Supabase Changelog](https://supabase.com/changelog.md)
- [Supabase CLI v3 breaking change](https://supabase.com/changelog/supabase-cli-v3)
- [Production Branch merge permission change](https://supabase.com/changelog/branch-merge-requires-production-write)
