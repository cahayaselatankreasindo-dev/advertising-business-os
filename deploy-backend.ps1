# SAFE BLOCK — deployment is intentionally disabled in this staging branch.
# apps-script/.clasp.json points to the PRODUCTION Script ID.
# apps-script/Code.gs is LAB-only source, while the root google_apps_script.js is
# an integration backend. The old helper copied that integration backend into Code.gs
# then pushed it to the production target. That could publish unreviewed staging code.
# The isolated LAB uses a separate Script ID documented in docs/lab-api-guard.md and
# requires its own verified working directory/configuration.
#
# Do not run clasp from this branch until the target and source are deliberately paired.
# Production release requires a reviewed production backend, verified backup,
# versioned deployment and explicit owner approval.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "DEPLOYMENT BLOCKED — CSK Business OS" -ForegroundColor Red
Write-Host "Staging deployment would push unreviewed integration code to PRODUCTION. Do not run clasp here." -ForegroundColor Yellow
Write-Host "No files were copied. No clasp push or deploy was executed." -ForegroundColor Yellow
Write-Host "Use a separately verified LAB working directory for LAB tests; production release requires separate approval." -ForegroundColor Cyan
Write-Host ""

exit 1
