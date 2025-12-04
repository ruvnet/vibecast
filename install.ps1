# Vibecast Installer for Windows PowerShell
# This script installs dependencies and sets up the environment

Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║             Vibecast Installer v1.0.0                     ║" -ForegroundColor Cyan
Write-Host "║       Universal Energy System Controller                  ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js version..." -ForegroundColor Yellow

try {
    $nodeVersion = node -v
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')

    if ($versionNumber -lt 18) {
        Write-Host "✗ Node.js version 18+ required (found $nodeVersion)" -ForegroundColor Red
        exit 1
    }

    Write-Host "✓ Node.js $nodeVersion detected" -ForegroundColor Green
}
catch {
    Write-Host "✗ Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Check npm
Write-Host "Checking npm..." -ForegroundColor Yellow

try {
    $npmVersion = npm -v
    Write-Host "✓ npm $npmVersion detected" -ForegroundColor Green
}
catch {
    Write-Host "✗ npm is not installed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed successfully" -ForegroundColor Green
}
else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Create directories
Write-Host "Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path reports, checkpoints, logs | Out-Null
Write-Host "✓ Directories created" -ForegroundColor Green

Write-Host ""

# Optional: Set up E2B API key
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Optional: E2B API Key Setup" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Vibecast can use E2B for federated agent simulation." -ForegroundColor White
Write-Host "If you have an E2B API key, you can set it now." -ForegroundColor White
Write-Host ""

$response = Read-Host "Do you have an E2B API key? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    $e2bKey = Read-Host "Enter your E2B API key"
    [System.Environment]::SetEnvironmentVariable('E2B_API_KEY', $e2bKey, [System.EnvironmentVariableTarget]::User)
    Write-Host "✓ E2B API key saved" -ForegroundColor Green
    Write-Host "Restart PowerShell for changes to take effect" -ForegroundColor Yellow
}
else {
    Write-Host "⚠ Skipping E2B setup" -ForegroundColor Yellow
    Write-Host "You can set it later with: [System.Environment]::SetEnvironmentVariable('E2B_API_KEY', 'your_key', [System.EnvironmentVariableTarget]::User)" -ForegroundColor White
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Installation Complete! 🎉                    ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Quick Start:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  # Run RL demo" -ForegroundColor White
Write-Host "  node examples/rl-demo.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "  # Train a controller" -ForegroundColor White
Write-Host "  node examples/rl-training.js nuclear-fission PPO 100" -ForegroundColor Yellow
Write-Host ""
Write-Host "  # Run simulation" -ForegroundColor White
Write-Host "  node examples/basic-simulation.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "Documentation: docs/getting-started.md" -ForegroundColor Cyan
Write-Host ""
