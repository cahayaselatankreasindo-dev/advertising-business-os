> **STATUS: DITUNDA (24 November 2026).** Owner memilih melanjutkan CSK Business OS menggunakan Google Apps Script + Google Sheets. Dokumen ini hanya catatan referensi untuk kemungkinan masa depan, bukan instruksi untuk membuat project, menghubungkan aplikasi, memigrasikan data, atau mengubah autentikasi. Jangan melakukan pekerjaan Supabase kecuali Owner secara eksplisit meminta keputusan ini dibuka kembali.

# CSK Business OS — Supabase Relational Schema Plan

**Status:** Design proposal only. Not applied to any Supabase project.  
**Depends on:** `CSK-SUPABASE-DATA-AUDIT.md`  
**Decision:** Keep the existing app and its tested business logic while designing a staged PostgreSQL migration.

## 1. Design principles

1. PostgreSQL is the future authoritative transactional store after an approved cutover.
2. Every business entity uses a stable UUID primary key. Existing Sheet IDs are retained in a unique `legacy_source_id` field during and after migration.
3. Business documents and approved orders preserve immutable snapshots of prices, line items, taxes, terms and client details.
4. Stock and payment histories are append-only ledgers. Corrections use compensating records rather than silent edits or deletes.
5. Critical state changes happen through database transactions/functions, not a sequence of unrelated browser writes.
6. RLS enforces Owner/Team access on every exposed table. UI visibility is not an authorization control.
7. No public table receives broad grants by default. Grant only the operations needed by the authenticated app roles.
8. Do not store authorization roles in user-editable Auth metadata. Use server-controlled claims or an Owner-managed role source.
9. Never expose Supabase secret/service-role credentials to the browser.
10. The migration is staged; no dual-write period between Google Sheets and Supabase.

## 2. Proposed entities and relationships

### Identity
- `profiles`: one profile per `auth.users.id`, with display name, active status and server-controlled role.
- Owner-managed role changes must be auditable. Team users cannot self-promote.

### CRM and projects
- `leads`: source, estimated value, status, score, follow-up timestamps and owner/PIC.
- `lead_activities`: immutable contact/follow-up history for each lead.
- `clients`: canonical client identity and contact data.
- `client_contacts`: optional multiple PICs, emails and phone numbers.
- `projects`: stable `client_id`, project scope, status, deadline, PIC and source references.
- `project_tasks` and `project_events`: operational checklist and status history.

### Catalogue and costing
- `suppliers`: supplier master with contact and active status.
- `materials`: SKU, category, subcategory, brand, grade, dimensions, colour, thickness, length, diameter and default usage unit.
- `material_prices`: supplier-specific purchase price, purchase unit, conversion factor, effective date, source and minimum order.
- `material_units`: controlled unit definitions and conversions.
- `services`: CSK service/product catalogue with unit, cost basis and selling price.
- `costing_sheets`: project-level costing container.
- `costing_versions`: immutable revision number, calculation timestamp, labour, overhead, waste assumptions, margin and computed totals.
- `costing_lines`: normalized material/service lines with quantity, unit, conversion snapshot, price snapshot, waste and line total.
- `project_costs`: actual project costs linked to source documents and cash transactions.

### Commercial documents and orders
- `quotations`: customer-facing document identity, client/project links, terms, status and document number.
- `quotation_versions`: immutable versions of totals, discount, tax, DP and document terms.
- `quotation_lines`: normalized lines; retain source item description, unit, quantity, unit price and total snapshot.
- `sales_orders`: one approved quotation per SO, immutable commercial snapshot and controlled lifecycle status.
- `sales_order_lines`: copied quotation line snapshots.
- `sales_order_events`: actor, previous status, next status, timestamp and reason.

### Purchasing and inventory
- `purchase_orders`: supplier, project, order date, status and document number.
- `purchase_order_lines`: material, ordered quantity, unit and price snapshot.
- `goods_receipts`: receiving event, supplier/PO reference, received date and actor.
- `goods_receipt_lines`: actual received quantities and accepted/rejected quantities.
- `inventory_transactions`: append-only stock movement ledger with movement type, material, quantity, unit, project, PO/receipt source and actor.
- `stock_reservations`: material quantities reserved for a Sales Order/project; reservations are separate from physical stock.
- `material_offcuts`: reusable offcut pieces with source material, dimensions, project source and availability status.

### Billing and finance
- `invoices`: invoice identity, source quotation, client/project, document totals and status.
- `invoice_lines`: immutable issued invoice line snapshots.
- `invoice_payments`: canonical verified payments linked to invoices.
- `cash_transactions`: cash movement ledger. Payment-derived cash entries must be traceable to `invoice_payments` and must not be counted twice.
- `expenses`: actual expense details with vendor, category, payment state and optional project allocation.

### Growth, documents and governance
- `marketing_campaigns` / `marketing_spend`: campaign metadata and actual spend.
- `business_notes`: internal strategy and operational knowledge.
- `documents` / `document_versions`: private file references, version number, checksum, document type and uploader.
- `audit_logs`: actor, action, entity, timestamp and before/after metadata for sensitive operations.

## 3. Critical transaction boundaries

| Operation | Required database behavior |
|---|---|
| Record invoice payment | Validate invoice and balance, insert payment, create/reconcile cash transaction, and return new balance atomically |
| Approve quotation | Record approver and timestamp; prevent silent edits to issued/approved version |
| Convert quotation to SO | Enforce one SO per approved quotation; copy immutable line and amount snapshots |
| Release production | Require verified DP threshold based on canonical payment ledger |
| Close SO | Require delivery/close conditions and fully settled invoices |
| Receive PO | Validate PO lines, accepted quantities and cumulative receipts; insert receipt and stock movements atomically |
| Issue material | Check available stock after reservations; reject negative balance |
| Adjust stock | Require reason, actor and audit record |
| Update master price | Affect future costing only; never rewrite old quotation/SO snapshots |

## 4. Authorization model to preserve

| Capability | Owner | Team |
|---|---:|---:|
| Read Leads, Clients, Projects | Yes | Yes |
| Create/update Leads, Clients, Projects | Yes | Yes, with server-validated state rules |
| Mark a Lead Won | Yes | No, unless Owner approval is recorded |
| Read/write Finance, HPP, Materials, Services | Yes | No |
| Read/write Quotations, Invoices, Payments | Yes | No by default |
| Read/write Purchasing and Inventory | Yes | No by default |
| Delete sensitive commercial/financial/stock history | No silent deletion; use void/archive/compensating entry | No |

The first Supabase version should preserve the current Owner/Team boundary. More granular project-level permissions can be added later after actual staff workflows are confirmed.

## 5. RLS and API design requirements

- Enable RLS on every table in an exposed schema.
- Use explicit `TO authenticated` policies and row predicates; authentication alone is not authorization.
- Keep grants narrow; RLS does not replace table privileges.
- Protect Owner-only data and actions in the database, not only in Next.js components.
- If role claims are stored in `app_metadata`, account for JWT staleness and require refresh/sign-in after role changes.
- If a role lookup function is needed, place any privileged helper in a non-exposed schema, pin `search_path`, explicitly check `auth.uid()`, restrict EXECUTE grants, and test both allowed and denied cases.
- Never use user-editable `user_metadata` as the authorization source.
- Add indexes to foreign keys and RLS filter columns.
- Test RLS with at least Owner, Team and unauthenticated users using pgTAP or equivalent integration tests.
- Keep customer-facing PDFs and private internal HPP documents in private Storage buckets with scoped access policies.

## 6. Authentication migration

Use the staged approach in `CSK-AUTH-MIGRATION-PLAN.md`. Do not copy the Apps Script PIN hash into Supabase Auth; provision each existing email exactly once and let the user set a new strong password through Supabase invitation/recovery. Keep GAS as the only production auth provider until the Supabase-backed data API and RLS are ready. Avoid a production dual-login design. At cutover, switch authentication and data API together; if a hybrid bridge is temporarily unavoidable, verify Supabase access tokens server-side and fetch the role from the protected profile. Never trust browser-supplied roles or put access tokens in URL query parameters.

## 7. Migration mapping decisions still requiring validation

1. Whether `Quotations` (HPP-generated snapshot) and `Commercial_Quotations` (customer-facing document center) become one quotation entity with version/source type, or remain separate document classes linked to one project.
2. How existing client names in `Projects` and documents map to canonical `clients` records when names are duplicated or inconsistent.
3. How historical `Costings` and `Project_Costs` records are imported, including malformed JSON and missing project references.
4. Whether current Finance rows represent actual cash movement, project cost, or both; reconcile each category before mapping to `cash_transactions` and `project_costs`.
5. Whether supplier records can be reconstructed from material/PO text fields or require owner review.
6. Whether existing material price and conversion fields have complete historical effective dates.
7. Whether document PDFs are stored externally and need a private Storage migration or only metadata references.

## 8. Implementation sequence

1. Confirm the CSK Supabase organization, project owner, plan and acceptable recurring cost.
2. Create an isolated development project only after that confirmation.
3. Inspect its PostgreSQL version, Data API exposure settings and current Supabase CLI version.
4. Build the schema locally and test constraints/RLS with synthetic records.
5. Rehearse imports from a read-only export of the current Sheets data.
6. Reconcile all records and balances before any cutover.
7. Run a controlled pilot with Owner approval.
8. Freeze old writes, take a final backup, migrate, verify, then switch the app to the single authoritative database.
9. Keep a documented rollback path and a read-only Sheets archive.

## 9. Official documentation to re-check during implementation

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles)
- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Custom Claims and RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control)
- [Supabase Changelog](https://supabase.com/changelog.md)
