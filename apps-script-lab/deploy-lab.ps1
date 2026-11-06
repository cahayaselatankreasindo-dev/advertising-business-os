param(
  [switch]$Push,
  [switch]$Deploy
)
$ErrorActionPreference = "Stop"
$ExpectedLabScriptId = "1IushkEIqi-CsKxsdx83sxs08_G5wk8rbOQ9A_eM0UF1wOKszDfYJqzB4"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $Root
try {
  $Clasp = Get-Content ".clasp.json" -Raw | ConvertFrom-Json
  $Manifest = Get-Content "appsscript.json" -Raw | ConvertFrom-Json
  if ($Clasp.scriptId -ne $ExpectedLabScriptId) { throw "STOP: .clasp.json bukan Script ID LAB yang disetujui." }
  if ($Manifest.webapp.access -ne "MYSELF" -or $Manifest.webapp.executeAs -ne "USER_DEPLOYING") {
    throw "STOP: manifest wajib tetap private MYSELF / USER_DEPLOYING."
  }
  $Code = Get-Content "Code.gs" -Raw
  $SelfTest = Get-Content "LabSelfTest.gs" -Raw
  if ($Code -notmatch "cskLabRequireDummySheet_" -or
      $Code -notmatch "cskLabGuardPost_\(payload\)" -or
      $SelfTest -notmatch "19le34ltpZCMIHmjw2n_JbEvrtZBWNTKd61U-xEAoR5Y") {
    throw "STOP: guard atau spreadsheet LAB tidak cocok."
  }
  Write-Host "Preflight PASS: target LAB exact, source guarded, manifest private." -ForegroundColor Green
  if (-not $Push -and -not $Deploy) {
    Write-Host "Preflight only. Use -Push to upload source; use -Deploy to upload and deploy."
    return
  }
  if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) { throw "clasp CLI belum terpasang pada mesin ini." }
  clasp status
  if ($LASTEXITCODE -ne 0) { throw "clasp status gagal." }
  clasp push
  if ($LASTEXITCODE -ne 0) { throw "clasp push gagal." }
  if ($Deploy) {
    clasp deploy -d "CSK Business OS private LAB owner-only"
    if ($LASTEXITCODE -ne 0) { throw "clasp deploy gagal." }
  }
  Write-Host "Selesai. Manifest MYSELF tetap membatasi akses ke akun pemilik." -ForegroundColor Green
}
finally { Pop-Location }
