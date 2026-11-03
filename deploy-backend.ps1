# SAFE BLOCK — deployment is intentionally disabled in this staging branch.
# apps-script/.clasp.json points to the PRODUCTION Script ID.
# apps-script/Code.gs in this branch is LAB-ONLY guarded source, not production source.
# Running clasp push/deploy from apps-script/ could therefore overwrite production
# with the wrong backend. The isolated LAB uses a separate Script ID documented in
# docs/lab-api-guard.md; it needs its own verified working directory/configuration.
#
# Do not run clasp from this branch until the target and source are deliberately paired.
# Production release requires a reviewed production backend, verified backup,
# versioned deployment and explicit owner approval.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "DEPLOYMENT BLOCKED — CSK Business OS" -ForegroundColor Red
Write-Host "Staging source is LAB-only, but .clasp.json points to PRODUCTION. Do not run clasp here." -ForegroundColor Yellow
Write-Host "No files were copied. No clasp push or deploy was executed." -ForegroundColor Yellow
Write-Host "Use a separately verified LAB working directory for LAB tests; production release requires separate approval." -ForegroundColor Cyan
Write-Host ""

exit 1
