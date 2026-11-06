# Integration checklist — security/google-apps-script-rbac

This branch contains helper code only. The production handlers and frontend are intentionally not rewritten automatically because those edits need full end-to-end regression tests against the app's existing CRM, quotation, purchasing, finance, and sync flows.

## Backend integration (Apps Script)

1. Add `security/Security.gs` to the Apps Script project.
2. Set Script Properties:
   - `CSK_GOOGLE_OAUTH_CLIENT_ID`: OAuth Web Client ID.
   - `CSK_OWNER_EMAIL`: `cahayaselatankreasindo@gmail.com`.
   - `CSK_TEAM_EMAILS`: `zefdas@gmail.com`.
3. In `doPost(e)`, parse JSON, then before any data access handle:
   - `auth_session`: call `cskCreateSession_(payload.idToken, payload.sessionId)`.
   - `logout`: call `cskRevokeSession_(payload.sessionId)`.
   - All other actions: call `cskRequireSession_(payload.sessionId)` and `cskAssertPayloadAllowed_(identity,payload)`.
4. In `doGet(e)`, authenticate with `cskRequireSession_(e.parameter.sessionId)`. Filter the existing data object with `cskFilterDataForRole_(result,identity.role)`. Add an Owner-only `action=list_pending_approvals` route using `cskListPendingApprovals_(identity)`.
5. In `sync_all`, run `autoTriggerPillars(ss)` only when `identity.role === "owner"`. Do the same for the direct `update_status` path. Otherwise a Team member could indirectly create Finance rows by marking a lead Won.
6. Add POST switch cases: `request_cold_email`, `approve_cold_email`, `reject_cold_email`, `send_approved_cold_email`. Reject legacy `send_cold_email` with `COLD_EMAIL_APPROVAL_REQUIRED`.
7. Add an immediate return at the start of `cronDailyOutreach()`. This disables its existing scheduled direct-send path without deleting the installed trigger.
8. Run `cskSetupSecuritySheets()` once after review; it creates the approval and suppression tabs.

### Important current backend findings
- The current backend authorizes every user through one shared `API_TOKEN`; a frontend-only role dropdown is not access control.
- Current `doGet` returns Finance, Memory, Marketing, purchasing, HPP, services and quotation data to every holder of that token.
- Current `sync_all` accepts all collections.
- Current `update_status` and `sync_all` can call `autoTriggerPillars`, which creates Finance and Projects records for won Leads.
- Current `send_cold_email` sends immediately and `cronDailyOutreach` sends automatically. Both bypass explicit Owner approval.

## Frontend integration (index.html)

1. Add Google Identity Services script and a blocking sign-in overlay.
2. Authenticate using Google ID token in a POST body. Exchange it for a random server-side session held in Apps Script Cache. Never put the ID token in a URL or localStorage.
3. Keep the random session ID in JavaScript memory only. Page reload requires sign-in again.
4. Remove the desktop/mobile role selectors and `onRoleChange()`. Set role only from the authenticated server response.
5. Team navigation and data scope must be limited to Dashboard (CRM/project-safe metrics), Leads, Clients and Projects. Team must not see finance totals, ad spend, analytics, Memory, Settings, Services, Purchasing, HPP, Quotation or Invoice pages.
6. Update every backend request path, including `verifyCloudSync`, `syncWithGoogle`, `pullData`, `pullAndMerge`, `deleteOnCloud`, and email actions, to use session ID.
7. Team `sync_all` may contain only `leads`, `clients`, `projects`. Do not send Owner collections as empty arrays.
8. Team cold-email action must queue a request only. Owner must separately approve/reject and separately send. Do not mark a lead contacted on queue submission.

## Google free-tier setup

- Create OAuth Web Client ID; add the actual GitHub Pages origin as Authorized JavaScript origin.
- For an External consent screen in Testing, add both supplied Gmail addresses as test users.
- Apps Script runs as Owner. Keep the spreadsheet private; do not share the Sheet with Team.
- Web App access may be public at the HTTP layer because every operation is gated by server-side session verification. Do not confuse endpoint reachability with data authorization.
- Apps Script Cache is ephemeral; users may need to sign in again if a session expires or cache is evicted.

## Do not deploy yet

This patch is not a production-ready cutover until both handlers and every frontend request path are migrated and regression-tested. No deploy, merge, or production Sheet change is authorized by this branch preparation.
