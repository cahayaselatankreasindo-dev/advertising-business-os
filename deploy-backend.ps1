# Deploy backend CSK OS ke Google Apps Script (tanpa paste manual)
# Cara pakai:
#   .\deploy-backend.ps1 -DeploymentId "<ID dari URL /exec>"
# atau set $env:CSK_DEPLOYMENT_ID terlebih dahulu.
#
# Prasyarat (sekali saja): jalankan clasp login di folder apps-script.
# Script berhenti SEBELUM push jika deployment ID tidak cocok dengan project .clasp.json.

[CmdletBinding()]
param(
    [string]$DeploymentId = $env:CSK_DEPLOYMENT_ID
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$src  = Join-Path $root "google_apps_script.js"
$gas  = Join-Path $root "apps-script"
$dst  = Join-Path $gas  "Code.gs"

Write-Host "=== Deploy Backend CSK OS ===" -ForegroundColor Cyan

# 0. Fail-closed preflight source dan target deployment.
if (-not (Test-Path $src)) { throw "Sumber backend tidak ditemukan: $src" }
if (-not (Test-Path (Join-Path $gas ".clasp.json"))) {
    throw "apps-script/.clasp.json tidak ditemukan. Project Apps Script belum terhubung."
}
if ([string]::IsNullOrWhiteSpace($DeploymentId)) {
    throw "Deployment ID wajib diberikan. Jalankan: .\deploy-backend.ps1 -DeploymentId '<ID dari URL /exec>'"
}
if ($DeploymentId -notmatch '^AKfycb[\w-]+$') {
    throw "Format Deployment ID tidak valid. Masukkan hanya ID di antara /s/ dan /exec pada URL Web App."
}

$source = Get-Content $src -Raw
if ($source -notmatch 'function cskLoginWithPin_' -or
    $source -notmatch 'function cskRequireSession_' -or
    $source -notmatch 'function cskAssertPayloadAllowed_' -or
    $source -notmatch 'function setupCSKPinCredentialsFromPrompt' -or
    $source -match 'function getApiToken') {
    throw "PRE-FLIGHT GAGAL: backend belum menerapkan login PIN dan RBAC server-side. Tidak ada file yang di-push."
}
Write-Host "[0/5] Login PIN dan RBAC server-side terverifikasi" -ForegroundColor Green

Push-Location $gas
try {
    # 1. Cek autentikasi Google.
    $null = clasp show-authorized-user 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "clasp belum login. Jalankan 'clasp login' dengan akun cahayaselatankreasindo@gmail.com, lalu ulangi."
    }
    Write-Host "[1/5] Login clasp OK" -ForegroundColor Green

    # 2. Pastikan ID deployment benar-benar milik Script ID pada .clasp.json.
    $deployments = clasp deployments 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        throw "Gagal membaca daftar deployment dari project Apps Script."
    }
    $escapedId = [regex]::Escape($DeploymentId)
    if ($deployments -notmatch "(?m)$escapedId\s+@\d+\b") {
        throw "TARGET TIDAK COCOK: deployment ID tidak ditemukan pada project di apps-script/.clasp.json. Tidak ada kode yang di-push. Periksa Script ID project."
    }
    Write-Host "[2/5] Target deployment terverifikasi pada project yang terhubung" -ForegroundColor Green

    # 3. Sinkron file sumber -> Code.gs, baru push setelah target lolos preflight.
    Copy-Item $src $dst -Force
    Write-Host "[3/5] google_apps_script.js -> apps-script/Code.gs" -ForegroundColor Green

    clasp push --force
    if ($LASTEXITCODE -ne 0) { throw "clasp push gagal. Deployment tidak diperbarui." }
    Write-Host "[4/5] Kode berhasil di-push ke Apps Script" -ForegroundColor Green

    # 4. Jangan reset PIN otomatis. Owner harus memastikan kredensial PIN sudah siap.
    Write-Host ""
    Write-Host "Pastikan PIN Owner dan Tim sudah pernah disetel." -ForegroundColor Yellow
    Write-Host "Jika belum, jalankan setupCSKPinCredentialsFromPrompt() satu kali di Apps Script Editor." -ForegroundColor Yellow
    Write-Host "Jika sudah, JANGAN jalankan setup ulang. Gunakan rotasi hanya bila memang diperlukan." -ForegroundColor Yellow
    $pinReady = Read-Host "Ketik PIN-READY setelah memastikan PIN siap"
    if ($pinReady -ne "PIN-READY") {
        throw "Deployment dibatalkan setelah push. Kode sudah tersimpan di project Apps Script, tetapi deployment live belum berubah."
    }

    # 5. Perbarui deployment yang sama agar URL /exec tidak berubah.
    clasp deploy --deploymentId $DeploymentId --description "CSK Business OS commercial documents $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    if ($LASTEXITCODE -ne 0) { throw "Update deployment gagal. Periksa daftar deployment dan Apps Script." }
    Write-Host "[5/5] Deployment berhasil diperbarui. URL Web App tetap sama." -ForegroundColor Green
}
finally {
    Pop-Location
}

Write-Host "=== Selesai ===" -ForegroundColor Cyan
