# CSK Business OS — private LAB app shell and integration notes

## Decision

Keep the Apps Script Web App private. Do not switch access to Anyone, Anyone anonymous, or a public proxy.

The isolated LAB UI is served by Apps Script HTML Service at the deployment URL with `?view=app`. The same private Apps Script project handles API calls through `google.script.run`, so the browser does not need a cross-origin fetch to a private `/exec` endpoint.

## Data and authentication boundary

- `apps-script-lab/.clasp.json` points only to the isolated LAB Script ID.
- `apps-script-lab/appsscript.json` remains `access: MYSELF` and `executeAs: USER_DEPLOYING`.
- The Apps Script page is owner-only. The user must be signed in to the owner Google account on each device.
- `cskLabApiRequest` strips any token supplied by browser code, retrieves the Owner token from LAB Script Properties, and invokes the existing guarded `doPost` handler.
- The browser receives API data, never the Owner token. No token is persisted in browser storage or URL.
- `cskLabRequireDummySheet_` and `cskLabGuardPost_` continue to enforce the exact TEST ONLY spreadsheet and synthetic ID namespace.
- The visible UI banner states that this is dummy LAB data. Do not enter customer or production records.
- GitHub Pages remains a public static source/preview and cannot directly call the private Apps Script API. The private LAB UI must be opened from Apps Script.

## Deployment isolation

Use only the `apps-script-lab/` directory for LAB Clasp operations. Its target ID is pinned to the verified LAB Script ID. The older `apps-script/` directory retains a production Script ID and must not be used for staging pushes.

`deploy-lab.ps1` performs a fail-closed preflight. By default it only validates configuration. `-Push` uploads source to the LAB script project; `-Deploy` uploads and creates a private Web App deployment using the checked-in MYSELF manifest.

No script deployment is performed by GitHub CI. The owner must run the Clasp preflight and deploy from an authenticated machine, then verify the active deployment URL and exact project/spreadsheet IDs.

## Limitations

- This owner-only route supports the owner Google account across devices.
- It does not grant access to Team users. Team access requires a separate per-user identity and authorization design; do not simulate Team access by sharing the Owner bearer token.
- The GitHub Pages version continues to use the external Apps Script fetch transport and cannot reach a private Only myself endpoint.
- The new shell must pass CI, then be deployed to LAB and tested in a real browser before it can be called operationally ready.
- Production remains untouched. No production credentials, spreadsheet, or Apps Script deployment are changed by this branch.