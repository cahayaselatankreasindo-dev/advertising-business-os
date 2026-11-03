# SAFE BLOCK — deployment is intentionally disabled in this repository branch.
# The committed apps-script/.clasp.json points to the isolated LAB project.
# The old script copied google_apps_script.js over the guarded LAB Code.gs,
# then ran clasp push/deploy. That could remove LAB-only protections.
#
# Do not replace the LAB script with production backend source.
# A production release requires a separately verified production Script ID,
# a verified Google Sheets backup, a reviewed versioned deployment, and owner approval.
# None of those production target details are configured in this repository.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "DEPLOYMENT BLOCKED — CSK Business OS" -ForegroundColor Red
Write-Host "This repository is configured for an isolated TEST ONLY Apps Script project." -ForegroundColor Yellow
Write-Host "No files were copied. No clasp push or deploy was executed." -ForegroundColor Yellow
Write-Host "Use the documented release gate and a separately verified production Apps Script project." -ForegroundColor Cyan
Write-Host ""

exit 1
