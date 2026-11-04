# TinyFish integration — CSK Business OS

## Architecture

The tablet browser never calls TinyFish directly. The private Apps Script HTML Service UI calls the server-side router `cskLabTinyFishRequest` through `google.script.run`. Apps Script reads `TINYFISH_API_KEY` from Script Properties and sends the `X-API-Key` header to TinyFish.

The key is never returned to the browser, logged, or stored in Google Sheets or GitHub.

## Enabled API capabilities

- Search: `GET https://api.search.tinyfish.ai`, country `ID`, language `id`, web/news domain type.
- Fetch: `POST https://api.fetch.tinyfish.ai`, one public URL per request, Markdown output.
- Web Agent: `POST https://agent.tinyfish.ai/v1/automation/run-async`, followed by `GET /v1/runs/{id}`.

Search and Fetch are the low-cost/free retrieval layer according to TinyFish documentation. Agent is a metered browser-automation capability; it is user-initiated and rate-limited. No background runs are started automatically.

## Security boundary

- The TinyFish key is stored in Apps Script Project Settings > Script Properties as `TINYFISH_API_KEY`.
- The deployment remains `MYSELF` / `USER_DEPLOYING`.
- The Apps Script backend verifies the exact TEST ONLY spreadsheet before handling requests.
- Only public HTTP(S) domain URLs are accepted. IP literals, localhost, private/internal hostnames and reserved test domains are rejected.
- Agent goals are read-only. Login, credentials, form submission, messaging, purchases, account changes, deletion, upload, and download instructions are blocked. A read-only safety instruction is appended server-side.
- Agent runs are asynchronous; the UI polls status only when the owner asks. Agent usage is metered by run step; the LAB adapter limits starts to one per 30 seconds and 10 per Asia/Jakarta calendar day.
- Results are displayed for review and are not automatically written into CRM, Finance, Projects, or other business records.
- Search/Fetch/Agent calls are never made automatically during app startup or sync.

## Owner setup — required once

1. Open the TinyFish API Keys page: https://agent.tinyfish.ai/api-keys
2. Create an API key for the CSK LAB project.
3. Open the private CSK LAB app on the owner tablet.
4. In the TinyFish status card, paste the key into the password field and tap **Simpan & uji koneksi**.
5. The key is sent over the owner-only Apps Script RPC channel and stored in Script Properties. The UI clears the input after the request; the key is never returned, logged, or written to a Sheet.
6. The Search API test should report a successful connection. Do not paste the key into chat, GitHub, the spreadsheet, or browser settings.

Search and Fetch do not consume TinyFish credits per current documentation; account access and request limits still apply. Agent runs are metered. Review TinyFish wallet/usage before using Agent at scale.

## Current deployment state

This repository change implements the server-side adapter and UI, but does not deploy Apps Script. The owner creates the TinyFish key and enters it once through the private in-app password field after deployment. Production Apps Script and production spreadsheet are not modified.

## Deploy from an Android tablet (Termux — no desktop required)

The Business OS itself runs in Chrome and does not require Termux. Termux is only an optional one-time tool for uploading the prepared LAB source and creating its private deployment from an Android tablet.

1. Install Termux from F-Droid.
2. Enable the Google Apps Script API for the owner account at https://script.google.com/home/usersettings.
3. Open Termux and run:
   ```sh
   pkg update && pkg install nodejs git
   npm install -g @google/clasp
   clasp login --no-localhost
   ```
4. Complete Google sign-in in the browser using the owner account that owns the isolated LAB Apps Script project.
5. Clone this public repository and select the feature branch:
   ```sh
   git clone https://github.com/cahayaselatankreasindo-dev/advertising-business-os.git
   cd advertising-business-os
   git checkout feature/private-lab-appshell-20261104
   cd apps-script-lab
   ```
6. Run the safe preflight:
   ```sh
   bash deploy-lab.sh preflight
   ```
7. Upload and deploy only to the pinned LAB Script ID:
   ```sh
   bash deploy-lab.sh deploy
   ```
8. Copy the Web App `/exec` URL printed by Clasp and open it with `?view=app` appended. Keep the deployment access set to `Only myself`.

The script verifies the exact LAB Script ID, dummy spreadsheet ID, and private manifest before any Clasp command. The default mode is preflight-only. Do not run Clasp from the legacy `apps-script/` folder because its target is production.

After the app opens, create a TinyFish API key at https://agent.tinyfish.ai/api-keys and enter it in the TinyFish setup card inside the private app. The key is saved server-side; do not paste it into chat, GitHub, or Sheets.

If Termux is not desired, the same source can be uploaded from the Apps Script editor in Chrome desktop mode, but the Termux route is the repeatable tablet workflow.
