# CSK Business OS — private LAB app shell

This folder is the ONLY Clasp working directory for the isolated CSK TEST ONLY Apps Script project.

- `.clasp.json` targets the exact LAB Script ID, not production.
- `appsscript.json` is locked to `MYSELF` / `USER_DEPLOYING`.
- `Code.gs` serves the owner-only UI at `.../exec?view=app`.
- The UI calls `cskLabApiRequest` through `google.script.run`; the Owner bearer token is injected server-side and never returned to browser code.
- The API GET route without `view=app` continues to return `POST_REQUIRED`.
- All writes remain guarded to the exact TEST ONLY spreadsheet and synthetic IDs.
- The visible banner warns that this is dummy LAB data, not a production workspace.

## Preflight and deployment

Run from Windows PowerShell:

```powershell
cd apps-script-lab
.\deploy-lab.ps1
```

The default command is preflight only. To upload source to the isolated LAB project:

```powershell
.\deploy-lab.ps1 -Push
```

To create a private Web App deployment after reviewing the diff:

```powershell
.\deploy-lab.ps1 -Deploy
```

The script validates the exact LAB Script ID and private manifest before calling Clasp. It refuses mismatched targets. Never run Clasp from the legacy `apps-script/` folder; that folder's `.clasp.json` points to production.

## Access

After deploying from the owner's Google account, open the deployment URL with `?view=app`. Access remains `Only myself`. Use the same owner Google account on each device. Team access is intentionally not exposed by this owner-only LAB shell.

## Android tablet deployment

For a repeatable tablet-only deployment, use Termux and `deploy-lab.sh`. See `docs/tinyfish-integration.md` for the exact Termux setup and commands. The app itself runs in Chrome after the one-time private LAB deployment.
