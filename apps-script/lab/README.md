# CSK LAB Security Kit (LAB ONLY)

This folder contains standalone LAB-only guard files. Never copy them into production.

## Spreadsheet already prepared
https://docs.google.com/spreadsheets/d/1VfD3OfgWqd7DI2YVot0mHpjdlNJTZ--1mgAJszI_Pp4/edit

Tabs created: Leads, Clients, Projects, Finance, Memory, Marketing_Spend. Header rows are initialized; there is no customer or transaction data.

## Important compatibility boundary
These guards are designed for the legacy backend contract that exposes getApiToken(), isAuthorized(), findRowById(), doGet(e), doPost(e), and accepts sync_all/delete. The current CRM branch Code.gs has a session-based API contract. Do not paste these guards into that current backend without a dedicated adapter and review. Use the exact LAB backend copy matching the legacy code supplied by the operator.

## Remaining one-time Google UI action
A container-bound Apps Script project must be created from the LAB spreadsheet via Extensions > Apps Script. The available Drive connector can create Sheets, but it cannot create or bind an Apps Script project or deploy a Web App. No deployment is performed by this kit.

1. Open the LAB spreadsheet and choose Extensions > Apps Script.
2. Add LabSelfTest.gs, LabGuard.gs, LabHandlerVerification.gs from this folder.
3. In LabSelfTest.gs replace REPLACE_WITH_LAB_SPREADSHEET_ID with the spreadsheet ID.
4. Set Script Property API_TOKEN to a private random token of at least 32 characters. Do not commit it or share it.
5. In the matching LAB Code.gs, call cskLabGuardRead_() at the beginning of doGet's try block and cskLabGuardPost_(payload) immediately after parsing JSON in doPost. Do not change production Code.gs.
6. Keep Web App access "Only myself". Run setupSheet only if the six tabs do not already exist; they are already initialized in this spreadsheet.
7. Run cskLabRunGuardNegativeTests, then cskLabVerifyActiveHandlers. Only continue if both pass.

The handler test uses a forbidden non-dummy ID that is guaranteed not to exist and checks that the row count is unchanged. The guard negative tests invoke the guard directly and perform no sheet writes or email sends.
