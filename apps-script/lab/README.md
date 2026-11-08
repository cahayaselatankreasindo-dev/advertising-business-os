# CSK Business OS LAB — single-file installation

This is a dedicated LAB project. Never paste this file into production.

## Spreadsheet
The LAB spreadsheet has already been created and initialized with all 11 tabs:
https://docs.google.com/spreadsheets/d/1VfD3OfgWqd7DI2YVot0mHpjdlNJTZ--1mgAJszI_Pp4/edit

## One-time installation
1. In the Apps Script editor opened from this spreadsheet, select the existing `Code.gs` file.
2. Replace its contents with the complete file `Code.gs` in this folder:
   https://github.com/cahayaselatankreasindo-dev/advertising-business-os/blob/feature/crm-upgrade-20261108/apps-script/lab/Code.gs
3. Save.
4. Run `setupSheet` once. It initializes any missing CSK tabs and preserves existing data.
5. Run `cskLabPreflight`. Expected result: `LAB_PREFLIGHT_PASS`.
6. Run `cskLabRunGuardNegativeTests`. Expected result: `LAB_GUARD_PASS`.
7. Run `cskLabVerifyActiveHandlers`. Expected result: `LAB_HANDLER_GUARD_PASS`.
8. For UI login testing only, run `setupCSKLabCredentials` once and read the temporary Owner/Team PINs from the execution log. These credentials are LAB-only and are not production credentials.

## Safety
- The file hard-codes the exact LAB spreadsheet ID and title.
- doGet and doPost call the LAB guards.
- Only TEST-/QA-LAB- record IDs are allowed.
- Deal Won transitions and cold-email actions are blocked.
- Role-based Owner/Team session authorization remains enabled.
- The LAB Web App must remain "Only myself".
- No production merge, deployment, or spreadsheet write is performed by this repository change.
