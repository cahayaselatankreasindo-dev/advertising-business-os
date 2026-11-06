# Google Apps Script + Sheets free setup

1. Use the Google Cloud project linked to the existing Apps Script project.
2. Configure OAuth consent screen as External if the two Gmail accounts are not in one Workspace organization. Add both supplied accounts as Test Users while the app is in Testing.
3. Create an OAuth Client ID of type Web application.
4. Add the exact GitHub Pages origin as an Authorized JavaScript origin (origin only; no path).
5. In Apps Script → Project Settings → Script Properties, set:
   - `CSK_GOOGLE_OAUTH_CLIENT_ID`: OAuth Web Client ID.
   - `CSK_OWNER_EMAIL`: `cahayaselatankreasindo@gmail.com`.
   - `CSK_TEAM_EMAILS`: `zefdas@gmail.com`.
6. Keep the Google Sheet private. Apps Script Web App runs as Owner. Do not share the Sheet with Team.
7. Add `security/Security.gs` to the existing Apps Script project only after review.
8. Run `cskSetupSecuritySheets()` once after integration review.

The Web App endpoint can be publicly reachable at HTTP level only if every data route requires a valid short-lived session. Public endpoint reachability is not the access-control mechanism. Do not deploy the current helper alone; both `doGet/doPost` and all frontend request paths must be migrated first.

Apps Script Cache is ephemeral, so users may need to sign in again if a session expires or cache entries are evicted. The browser holds the random session ID only in memory. Page reload requires sign-in again.
