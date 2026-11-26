[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path ([System.IO.Path]::GetTempPath()) "CSK-Business-OS-Releases")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Node {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & node @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Node command gagal: node $($Arguments -join ' ')"
    }
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDirectory "..")).Path
Push-Location $repositoryRoot

try {
    $gitRootRaw = & git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Folder ini bukan working tree Git."
    }

    $gitRoot = [System.IO.Path]::GetFullPath(($gitRootRaw | Select-Object -First 1))
    $rootNormalized = [System.IO.Path]::GetFullPath($repositoryRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $gitRootNormalized = $gitRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    if ($gitRootNormalized -ne $rootNormalized) {
        throw "Jalankan script dari repository CSK Business OS yang benar."
    }

    $branch = (& git branch --show-current 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) {
        throw "Tidak dapat membaca branch Git."
    }
    $branch = [string]$branch
    if ([string]::IsNullOrWhiteSpace($branch)) {
        $branch = [string]$env:GITHUB_HEAD_REF
    }
    if ([string]::IsNullOrWhiteSpace($branch)) {
        $branch = [string]$env:GITHUB_REF_NAME
    }
    if ($branch -notmatch "^(feature|release)/csk-[a-z0-9-]+$") {
        throw "Paket hanya boleh dibuat dari branch feature/csk-* atau release/csk-*. Branch terdeteksi: '$branch'."
    }
    if ($branch -eq "main") {
        throw "Pembuatan paket dari main diblokir."
    }

    $workingChanges = @(& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw "Tidak dapat memeriksa status working tree."
    }
    if ($workingChanges.Count -gt 0) {
        throw "Working tree belum bersih. Commit atau simpan perubahan terlebih dahulu sebelum membuat paket."
    }

    $commit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($commit)) {
        throw "Commit HEAD tidak dapat diverifikasi."
    }
    $shortCommit = (& git rev-parse --short=12 HEAD).Trim()

    $nodeVersion = (& node --version 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch "^v\d+\.\d+\.\d+") {
        throw "Node.js tidak ditemukan. Instal Node.js 20 atau lebih baru."
    }
    $nodeMajor = [int](($nodeVersion.TrimStart("v").Split("."))[0])
    if ($nodeMajor -lt 20) {
        throw "Node.js 20 atau lebih baru diperlukan. Versi saat ini: $nodeVersion"
    }

    $canonicalGas = Get-Content -LiteralPath (Join-Path $repositoryRoot "google_apps_script.js") -Raw
    $deploymentGas = Get-Content -LiteralPath (Join-Path $repositoryRoot "apps-script/Code.gs") -Raw
    if ($canonicalGas -cne $deploymentGas) {
        throw "google_apps_script.js dan apps-script/Code.gs tidak identik. Paket dibatalkan."
    }

    $appManifest = Get-Content -LiteralPath (Join-Path $repositoryRoot "manifest.json") -Raw | ConvertFrom-Json
    $serviceWorker = Get-Content -LiteralPath (Join-Path $repositoryRoot "sw.js") -Raw
    $cacheVersions = [regex]::Matches($serviceWorker, "csk-business-os-v(\d+\.\d+\.\d+)")
    if ($cacheVersions.Count -ne 1) {
        throw "Service Worker harus memiliki tepat satu versi cache CSK yang dapat diverifikasi."
    }
    $cacheVersion = $cacheVersions[0].Groups[1].Value
    if ([string]$appManifest.version -ne $cacheVersion) {
        throw "Versi manifest ($($appManifest.version)) tidak sama dengan versi Service Worker ($cacheVersion)."
    }

    $requiredFiles = @(
        "index.html",
        "manifest.json",
        "sw.js",
        "google_apps_script.js",
        "apps-script/Code.gs",
        "apps-script/appsscript.json",
        "apps-script/clasp-config.example.json",
        "security/guard.js",
        "catalog-manager.js",
        "material-master.js",
        "inventory-engine.js",
        "inventory.js",
        "sales-order-engine.js",
        "sales-orders.js",
        "commercial-documents.js",
        "csk-pdf.js",
        "finance-engine.js",
        "project-profitability-engine.js",
        "data/advertising-catalog-seed.json",
        "data/csk-material-master-seed.json",
        "deploy-backend.ps1",
        "README.md",
        "docs/CSK-ERP-PLAYBOOK.md",
        "docs/CSK-ADMIN-INSTALL-UPGRADE.md"
    )
    foreach ($relativePath in $requiredFiles) {
        if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $relativePath) -PathType Leaf)) {
            throw "File wajib tidak ditemukan: $relativePath"
        }
    }

    $catalog = Get-Content -LiteralPath (Join-Path $repositoryRoot "data/advertising-catalog-seed.json") -Raw | ConvertFrom-Json
    $materialSeed = Get-Content -LiteralPath (Join-Path $repositoryRoot "data/csk-material-master-seed.json") -Raw | ConvertFrom-Json
    if ($catalog.materialFamilies.Count -lt 1 -or $catalog.serviceFamilies.Count -lt 1 -or $materialSeed.items.Count -lt 1) {
        throw "Data katalog bahan, produk/jasa, atau master material kosong/tidak valid."
    }

    Write-Host "=== CSK Business OS Release Preflight ===" -ForegroundColor Cyan
    Write-Host "Branch      : $branch"
    Write-Host "Commit      : $commit"
    Write-Host "PWA version : $cacheVersion"
    Write-Host "Node        : $nodeVersion"
    Write-Host "Material families : $($catalog.materialFamilies.Count)"
    Write-Host "Product/service families : $($catalog.serviceFamilies.Count)"
    Write-Host "Material seed rows : $($materialSeed.items.Count)"
    Write-Host ""

    $syntaxFiles = @(
        "google_apps_script.js",
        "security/guard.js",
        "commercial-documents.js",
        "csk-pdf.js",
        "catalog-manager.js",
        "custom-costing-engine.js",
        "custom-costing.js",
        "sales-order-engine.js",
        "sales-orders.js",
        "inventory-engine.js",
        "inventory.js",
        "material-master.js",
        "finance-engine.js",
        "project-profitability-engine.js",
        "crm-upgrade.js"
    )
    foreach ($file in $syntaxFiles) {
        Write-Host "[Syntax] $file"
        Invoke-Node @("--check", $file)
    }
    Write-Host "[Syntax] apps-script/Code.gs"
    Invoke-Node @("-e", "new Function(require('fs').readFileSync('apps-script/Code.gs','utf8'))")

    $tests = @(
        "mapping.test.js",
        "commercial-documents.test.cjs",
        "csk-pdf.test.cjs",
        "catalog-seed.test.cjs",
        "catalog-manager.test.cjs",
        "custom-costing-engine.test.cjs",
        "custom-costing-integration.test.cjs",
        "sales-order-workflow.test.cjs",
        "sales-order-backend.test.cjs",
        "inventory-workflow.test.cjs",
        "inventory-backend.test.cjs",
        "material-master.test.cjs",
        "hpp-workflow.test.cjs",
        "commercial-workflow.test.cjs",
        "end-to-end-commercial-operations.test.cjs",
        "backend-auth.test.cjs",
        "dashboard.test.cjs",
        "crm-upgrade.test.cjs",
        "deal-conversion.test.cjs",
        "invoice.test.cjs",
        "sync.test.cjs",
        "invoice-integrity.test.cjs",
        "finance-integrity.test.cjs",
        "finance-engine.test.cjs",
        "project-profitability-engine.test.cjs",
        "photo-lab.test.cjs",
        "pwa-assets.test.cjs",
        "csk-visual-refresh.test.cjs",
        "csk-ui-components.test.cjs"
    )
    foreach ($testFile in $tests) {
        if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot $testFile) -PathType Leaf)) {
            throw "File pengujian wajib tidak ditemukan: $testFile"
        }
        Write-Host "[Test] $testFile" -ForegroundColor DarkCyan
        Invoke-Node @($testFile)
    }

    Write-Host ""
    Write-Host "Semua preflight dan regression test lulus." -ForegroundColor Green

    $outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
    $repoPrefix = $rootNormalized + [System.IO.Path]::DirectorySeparatorChar
    if ($outputRoot.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Folder output harus berada di luar repository agar tidak ikut ter-commit."
    }
    if (-not (Test-Path -LiteralPath $outputRoot -PathType Container)) {
        New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
    }

    $packageName = "CSK-Business-OS-DEV-v$cacheVersion-$shortCommit"
    $stageDirectory = Join-Path $outputRoot $packageName
    $zipPath = Join-Path $outputRoot ($packageName + ".zip")

    if (Test-Path -LiteralPath $stageDirectory) {
        Remove-Item -LiteralPath $stageDirectory -Recurse -Force
    }
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    New-Item -ItemType Directory -Path $stageDirectory -Force | Out-Null

    $trackedFiles = @(& git ls-files)
    if ($LASTEXITCODE -ne 0 -or $trackedFiles.Count -eq 0) {
        throw "Daftar file repository tidak dapat dibaca."
    }

    foreach ($relativePath in $trackedFiles) {
        $normalizedPath = $relativePath -replace "\\", "/"
        if (
            $normalizedPath -match "(^|/)\.github(/|$)" -or
            $normalizedPath -match "^backups(?:/|$)" -or
            $normalizedPath -match "(^|/)\.clasp\.json$" -or
            $normalizedPath -match "(^|/)\.clasprc\.json$" -or
            $normalizedPath -match "(^|/)\.env[^/]*$" -or
            $normalizedPath -match "(^|/)[^/]+\.test\.(js|cjs|mjs)$" -or
            $normalizedPath -match "^CSK-SUPABASE-"
        ) {
            continue
        }

        $sourcePath = Join-Path $repositoryRoot ($normalizedPath -replace "/", [System.IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "File tracked tidak ditemukan di disk: $normalizedPath"
        }

        $destinationPath = Join-Path $stageDirectory ($normalizedPath -replace "/", [System.IO.Path]::DirectorySeparatorChar)
        $destinationDirectory = Split-Path -Parent $destinationPath
        if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
            New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    }

    $statusText = @"
CSK BUSINESS OS - INTERNAL DEVELOPMENT PACKAGE
Status: DEVELOPMENT / TEST ONLY
PWA version: $cacheVersion
Source branch: $branch
Source commit: $commit

This package is not approved for production deployment.
Do not connect it to the production Google Sheet or production Apps Script project.
Do not publish it to or modify the public CSK marketing website.
The package builder does not run clasp push, clasp deploy, schema migration, or Google Sheets writes.
"@
    Set-Content -LiteralPath (Join-Path $stageDirectory "RELEASE-STATUS.txt") -Value $statusText -Encoding UTF8

    $checksumEntries = @(
        Get-ChildItem -LiteralPath $stageDirectory -File -Recurse -Force |
        Sort-Object FullName |
        ForEach-Object {
            [pscustomobject]@{
                path = $_.FullName.Substring($stageDirectory.Length + 1).Replace("\", "/")
                bytes = $_.Length
                sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            }
        }
    )

    $releaseManifest = [ordered]@{
        package = "CSK Business OS"
        status = "DEVELOPMENT_TEST_ONLY"
        branch = $branch
        commit = $commit
        pwaVersion = $cacheVersion
        materialFamilies = $catalog.materialFamilies.Count
        productAndServiceFamilies = $catalog.serviceFamilies.Count
        materialSeedRows = $materialSeed.items.Count
        generatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        checksumNote = "SHA-256 entries cover packaged files other than RELEASE-MANIFEST.json itself."
        files = $checksumEntries
    }
    $releaseManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $stageDirectory "RELEASE-MANIFEST.json") -Encoding UTF8

    $archiveItems = @(Get-ChildItem -LiteralPath $stageDirectory -Force | ForEach-Object { $_.FullName })
    if ($archiveItems.Count -eq 0) {
        throw "Folder paket kosong."
    }
    Compress-Archive -LiteralPath $archiveItems -DestinationPath $zipPath -CompressionLevel Optimal -Force

    if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf) -or (Get-Item -LiteralPath $zipPath).Length -le 0) {
        throw "Arsip ZIP gagal dibuat atau berukuran nol."
    }

    Write-Host ""
    Write-Host "Paket berhasil dibuat:" -ForegroundColor Green
    Write-Host $zipPath -ForegroundColor Cyan
    Write-Host "Ukuran: $([math]::Round((Get-Item -LiteralPath $zipPath).Length / 1MB, 2)) MB"
    Write-Host "Paket tetap berstatus DEVELOPMENT / TEST ONLY."
}
finally {
    Pop-Location
}
