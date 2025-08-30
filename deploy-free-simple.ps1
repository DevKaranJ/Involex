# Involex FREE Deployment Helper Script (PowerShell)
# Prepares the project for deployment to Render.com (FREE tier)

Write-Host "Involex FREE Deployment Preparation" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: Run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "Current directory: $PWD" -ForegroundColor Yellow
Write-Host "Preparing FREE deployment to Render.com..." -ForegroundColor Green

# 1. Build backend
Write-Host ""
Write-Host "Building backend..." -ForegroundColor Yellow
Set-Location backend

npm install
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backend build successful" -ForegroundColor Green
} else {
    Write-Host "Backend build failed" -ForegroundColor Red
    exit 1
}

# 2. Build extension
Write-Host ""
Write-Host "Building extension..." -ForegroundColor Yellow
Set-Location ..\extension

npm install
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Extension build successful" -ForegroundColor Green
} else {
    Write-Host "Extension build failed" -ForegroundColor Red
    exit 1
}

# 3. Package extension
Write-Host ""
Write-Host "Packaging extension..." -ForegroundColor Yellow
node scripts/package-extension.js

if ($LASTEXITCODE -eq 0) {
    Write-Host "Extension packaged successfully" -ForegroundColor Green
} else {
    Write-Host "Extension packaging failed" -ForegroundColor Red
    exit 1
}

# 4. Check deployment files
Write-Host ""
Write-Host "Checking deployment files..." -ForegroundColor Yellow
Set-Location ..

$FilesToCheck = @(
    "render.yaml",
    "backend\dist\server.js",
    "extension\store-packages\involex-v1.0.0.zip",
    "docs\FREE_DEPLOYMENT_GUIDE.md"
)

$AllFilesExist = $true

foreach ($file in $FilesToCheck) {
    if (Test-Path $file) {
        Write-Host "Found: $file" -ForegroundColor Green
    } else {
        Write-Host "Missing: $file" -ForegroundColor Red
        $AllFilesExist = $false
    }
}

# 5. Final summary
Write-Host ""
Write-Host "Deployment Preparation Summary" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

if ($AllFilesExist) {
    Write-Host "All deployment files ready" -ForegroundColor Green
    Write-Host "Backend built and ready" -ForegroundColor Green
    Write-Host "Extension packaged and ready" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Commit and push changes to GitHub"
    Write-Host "2. Sign up for Render.com (FREE)"
    Write-Host "3. Connect GitHub repository to Render"
    Write-Host "4. Deploy using the FREE_DEPLOYMENT_GUIDE.md"
    Write-Host ""
    Write-Host "Extension package: extension\store-packages\involex-v1.0.0.zip" -ForegroundColor Cyan
    Write-Host "Deployment config: render.yaml" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Estimated time: 10-15 minutes" -ForegroundColor Yellow
    Write-Host "Total cost: $0.00 (FREE tier)" -ForegroundColor Green
} else {
    Write-Host "Some files are missing. Please check the errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Ready to deploy Involex for FREE!" -ForegroundColor Magenta
