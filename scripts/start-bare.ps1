# Sales Buddy - Bare Server Start (DISASTER RECOVERY)
#
# Use this when start.bat is failing prereq checks (Python detection,
# winget install loops, etc.) but Python and the venv are actually fine.
#
# Skips ALL of:
#   - Python / git / winget detection and installs
#   - Update checks, git pull, pip install
#   - Database migrations and renames
#   - OneDrive backup setup, protocol registration, scheduled tasks
#
# Just spawns waitress against the existing venv.
#
# Usage:
#   .\scripts\start-bare.ps1
#   .\scripts\start-bare.ps1 -Port 5151

param(
    [int]$Port = 0
)

$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

# Pull PORT from .env if not passed in.
if ($Port -le 0) {
    $Port = 5151
    $envFile = Join-Path $RepoRoot '.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*PORT\s*=\s*(\d+)') {
                $Port = [int]$Matches[1]
                break
            }
        }
    }
}

$waitress = Join-Path $RepoRoot 'venv\Scripts\waitress-serve.exe'
if (-not (Test-Path $waitress)) {
    Write-Host "[ERROR] venv not found at: $waitress" -ForegroundColor Red
    Write-Host "        This script assumes the venv already exists. If it doesn't," -ForegroundColor Yellow
    Write-Host "        you'll have to run start.bat once to bootstrap it." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to close..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Starting Sales Buddy on port $Port (no prereq checks)..." -ForegroundColor Cyan
$serverArgs = @('--host=0.0.0.0', "--port=$Port", '--call', 'app:create_app')
Start-Process -FilePath $waitress -ArgumentList $serverArgs -WorkingDirectory $RepoRoot -WindowStyle Hidden

Start-Sleep -Seconds 2
Write-Host "[OK] Server should be running at http://localhost:$Port" -ForegroundColor Green
Write-Host "     Use stop.bat to stop it." -ForegroundColor Gray
