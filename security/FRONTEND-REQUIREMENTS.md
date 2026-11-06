# Frontend security requirements — review checklist

The current `index.html` has a browser-controlled Owner/Team dropdown. This must be removed as an authority source. Backend checks remain authoritative.

## Sign-in and session lifecycle
- Load `https://accounts.google.com/gsi/client`.
- Use the public OAuth Web Client ID (never a client secret in HTML).
- Render a blocking login overlay before business data is rendered.
- GIS callback supplies `credential`; send it only in a POST body:
  `{action:"auth_session",idToken:credential,sessionId:<32-byte-random-base64url>}`.
- Apps Script validates the ID token with Google's tokeninfo endpoint, checks exact audience, issuer, expiry, verified email and allowlist, then caches the hashed session ID for at most 55 minutes.
- Verify session with GET `?sessionId=<random-session>`. Keep session ID only in JS memory. Do not persist either token in localStorage or query string.
- Require login again after page reload or session expiry.

## Authorization and data minimization
- Owner: all existing modules.
- Team: Dashboard with safe metrics, Leads, Clients and Projects only.
- Team must not receive Finance, Memory, Marketing_Spend, Materials, Cost_Sheets, Services, Purchase_Orders or Quotations.
- Remove `role-select`, `role-select-mob`, and `onRoleChange()`; role comes from authenticated server response only.
- Guard `nav(page)` as well as hiding UI elements.
- Team Dashboard must not render cash income, margin, Finance summaries, ad-spend totals, or Owner workload.
- On Team login, clear Owner-only collections from memory and overwrite the Team-specific browser cache with only allowed collections. Do not silently destroy an Owner backup. Prefer separate browser profiles for Owner and Team.

## Request migration inventory
Every current Apps Script call in `index.html` must use session authentication:
- `sendColdEmailLead` — change to request-only action.
- `deleteOnCloud`.
- `verifyCloudSync`.
- `syncWithGoogle`.
- `pullData`.
- `pullAndMerge`.

POST requests use `sessionId` in JSON body. GET requests use `sessionId` only. Never send Owner collections in a Team `sync_all` payload, including empty arrays.

## Cold email state machine
- Team and Owner can create a PENDING request.
- Only Owner can transition PENDING → APPROVED or REJECTED.
- Only Owner can explicitly send an APPROVED request.
- Sending transitions APPROVED → SENDING → SENT.
- A SENDING item is not auto-retried: a provider timeout can be ambiguous, so Owner must inspect Gmail before any manual recovery.
- Direct legacy `send_cold_email` and the scheduled `cronDailyOutreach` are disabled.
- Queueing a request must never mark a lead contacted or report that an email was sent.

## Verification before cutover
Use two real Google accounts and a staging spreadsheet:
1. Owner login returns role owner and all authorized collections.
2. Team login returns role team and exactly Leads, Clients, Projects, lastSynced.
3. Unlisted Gmail account is rejected.
4. Team requests for Finance, Marketing, Memory, Settings, purchasing and quotations are rejected server-side.
5. Team cannot approve, reject or send cold email.
6. Owner can approve/reject; send action requires a separate click.
7. Legacy direct-send route is rejected.
8. Scheduled outreach handler returns without sending.
9. Team cannot trigger Finance auto-creation by changing a Lead status to Won.
10. Existing CRM CRUD, project status, quotation/invoice, HPP, purchasing and Owner sync regressions are tested.
