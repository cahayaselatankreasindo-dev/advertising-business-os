> **STATUS: DITUNDA (24 November 2026).** Owner memilih melanjutkan CSK Business OS menggunakan Google Apps Script + Google Sheets. Dokumen ini hanya catatan referensi untuk kemungkinan masa depan, bukan instruksi untuk membuat project, menghubungkan aplikasi, memigrasikan data, atau mengubah autentikasi. Jangan melakukan pekerjaan Supabase kecuali Owner secara eksplisit meminta keputusan ini dibuka kembali.

# CSK Business OS — Authentication Migration Plan

**Status:** Architecture and implementation plan only. No production login changes have been made.  
**Current provider:** Google Apps Script (GAS).  
**Target provider:** Supabase Auth, after a dedicated CSK Supabase project is confirmed and the data/backend cutover is ready.

## 1. What exists today (verified in the current GitHub branch)

The repository currently implements:

- Email + **4 digit PIN** login after credential rotation. Existing 8–12 digit credentials remain temporarily compatible until the Owner rotates them through Apps Script.
- Owner and Team identities are allow-listed in the Apps Script backend.
- PINs are salted and hashed in Apps Script Script Properties; plaintext PINs are not stored.
- Five failed attempts trigger a temporary 15-minute login lock.
- Sessions are stored in Apps Script CacheService with a 30-minute sliding lifetime.
- The frontend generates a cryptographically random session ID in the browser; it does not persist the session ID in localStorage.
- Owner/Team role is determined by the backend, not by the role selector in the UI.
- Credential rotation exists in Apps Script through `rotateCSKPinCredentialsFromPrompt()`.
- The current repository does **not** show a self-service "change password" screen in the Business OS frontend. The documented credential rotation path is the Apps Script/Spreadsheet security workflow. If the deployed Apps Script has a newer user-facing password-change flow, compare that deployed version with the repository before cutover.

## 2. Do not copy the old PIN hash into Supabase Auth

The current Apps Script PIN hash is a custom salted, repeated SHA-256 construction. Supabase Auth uses its own password-hashing and account lifecycle mechanisms. The existing hash is not a portable Supabase password credential. The current short-PIN policy is exactly 4 digits; legacy 8–12 digit hashes are accepted only until the Owner rotates credentials on the new Apps Script version.

**Correct migration:**
1. Keep the current GAS PIN login active while the Supabase development project is prepared.
2. Create each existing identity exactly once in Supabase Auth, using its existing email address.
3. Send a Supabase invitation or password-setup/reset link.
4. Each user sets a new, strong password directly with Supabase. Do not reuse the old numeric PIN as the new password.
5. Attach the Supabase Auth user UUID to a server-controlled `profiles` row.
6. Assign `owner` or `team` role through an Owner-controlled administrative process, never from a browser-submitted role or user-editable metadata.
7. Test login, logout, password reset, password change, disabled-user behavior, session expiry and role restrictions with non-production accounts.
8. Only switch the production login after the replacement backend and RLS policies pass the full business workflow test suite.

Never ask the Owner or Team member to send a current PIN or password in ChatGPT, GitHub issues, source code, or a shared document.

## 3. Avoid two logins and two competing identity stores

Do not make a production user sign into Supabase and then separately sign into GAS with a second PIN. That creates two sessions, confusing logout behavior, and inconsistent revocation.

Recommended release boundary:

- **Before cutover:** GAS remains the only production authentication provider and Google Sheets remains the current business data source. Supabase Auth is tested only in an isolated development environment.
- **At cutover:** the frontend switches to Supabase Auth and the application data API switches to the Supabase-backed backend as one coordinated release. Supabase RLS and database functions enforce Owner/Team access.
- **Rollback:** keep the last working GAS deployment and a verified read-only backup until the new release is accepted. If rollback is required, switch the app back as a single release; do not dual-write transactions.

If a temporary hybrid period is unavoidable, implement a single server-side identity bridge. GAS must verify the Supabase access token with Supabase Auth and fetch the role from the server-controlled profile before accepting any data operation. Never trust an email/role supplied by the browser, and never pass an access token in a URL query string. This hybrid is a fallback, not the preferred long-term architecture.

## 4. Target Supabase Auth experience

### Sign in
- Email + strong password.
- Clear error messages without revealing whether an account exists.
- Optional "remember this device" behavior only through Supabase's supported session lifecycle.
- Owner and Team role are loaded from the protected profile, not from a form selector.

### Password lifecycle
- Forgot password: send a time-limited Supabase recovery link to the verified email.
- Change password: authenticated user confirms a new strong password through Supabase Auth.
- Password reset/recovery links return to an allow-listed CSK app URL.
- On password change or account disable, revoke/refresh sessions according to the selected Supabase Auth session policy.

### Role and account management
- `profiles.id` references `auth.users.id`.
- `profiles.role` is limited to `owner` and `team`.
- `profiles.is_active` controls whether an account is enabled.
- Users may read their own safe profile fields, but cannot update their own role or active status.
- Only an Owner-controlled server operation may invite users, disable accounts, or change roles.
- Never store authorization role in user-editable `user_metadata`.

## 5. RLS requirements

- Enable Row Level Security on every table exposed to the client.
- Owner-only tables and functions remain unavailable to Team at the database level.
- Team access is restricted to the same approved business domains as today until the Owner approves more granular permissions.
- Do not treat hidden UI menus as security.
- Keep privileged helper functions in a non-exposed schema, pin `search_path`, and restrict EXECUTE grants.
- Test unauthenticated, Team, Owner, disabled-user and cross-user access, including both allowed and denied operations.
- Keep Storage buckets private and scope document access to authorized users.

## 6. Release sequence

| Stage | Work | Exit criteria |
|---|---|---|
| 0. Preserve | Keep current GAS login and password/PIN rotation operational | Existing Owner and Team login still works |
| 1. Provision | Confirm dedicated CSK Supabase project, Auth email settings and cost/plan | Project ownership and recurring cost approved |
| 2. Identity | Invite the existing Owner/Team emails once; each user sets a new password | One Auth user per existing email; roles verified |
| 3. Build | Add Supabase Auth adapter and secure profile/RLS policies in a development branch | Automated Auth/RLS tests pass |
| 4. Integrate | Connect app login to the Supabase data backend; retire the GAS session requirement in the same release | No second login; all critical workflows pass |
| 5. Cut over | Freeze writes, back up Sheets, migrate/reconcile data and switch production | Zero unexplained differences and Owner sign-off |
| 6. Retire | Remove obsolete GAS login only after acceptance and rollback window | No active production calls depend on old PIN sessions |

## 7. Required confirmations before provisioning

- Which Supabase organization should own the CSK project?
- Which plan and recurring compute cost are acceptable?
- What is the final production frontend URL for Auth redirect allow-listing?
- Confirm whether the deployed GAS version's credential change is the Apps Script PIN-rotation workflow documented in the repo or a newer self-service password screen.

No project should be created inside an unrelated application project. No secret, password, PIN, service-role key or recovery token belongs in GitHub.
