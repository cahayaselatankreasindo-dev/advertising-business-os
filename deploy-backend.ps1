# Deploy backend CSK OS ke Google Apps Script (tanpa paste manual)
# Cara pakai: powershell -ExecutionPolicy Bypass -File deploy-backend.ps1
#
# Prasyarat (sekali saja): jalankan `clasp login` di folder apps-script.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # folder advertising-business-os
$src  = Join-Path $root "google_apps_script.js"
$gas  = Join-Path $root "apps-script"
$dst  = Join-Path $gas  "Code.gs"

Write-Host "=== Deploy Backend CSK OS ===" -ForegroundColor Cyan

# 1. Sinkron file sumber -> Code.gs
Copy-Item $src $dst -Force
Write-Host "[1/4] google_apps_script.js -> apps-script/Code.gs" -ForegroundColor Green

# 2. Cek login clasp
Push-Location $gas
try {
    $status = clasp show-authorized-user 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] Belum login clasp. Jalankan: clasp login" -ForegroundColor Yellow
        Write-Host "    (buka browser, izinkan akses, lalu ulangi script ini)"
        Pop-Location
        exit 1
    }
    Write-Host "[2/4] Login clasp OK" -ForegroundColor Green

    # 3. Push kode ke Apps Script
    clasp push --force
    Write-Host "[3/4] Kode ter-upload (clasp push)" -ForegroundColor Green

    # 4. Update deployment yang ada (URL tetap sama)
    Write-Host "[4/4] Update deployment..." -ForegroundColor Green
    $deployments = clasp deployments 2>&1 | Out-String
    Write-Host $deployments

    # Ambil deployment ID pertama yang berformat AKfy...
    $m = [regex]::Match($deployments, "(AKfycb[\w-]+)")
    if ($m.Success) {
        $depId = $m.Groups[1].Value
        clasp deploy --deploymentId $depId --description "auto $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        Write-Host "Deployment diupdate: $depId" -ForegroundColor Green
    } else {
        Write-Host "[!] Tidak menemukan deployment ID. Cek 'clasp deployments' manual." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
Write-Host "=== Selesai ===" -ForegroundColor Cyan
