# Funscript Organizer Native Host Installer for Windows
# PowerShell Version

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Funscript Organizer Native Host Installer" -ForegroundColor Cyan
Write-Host "For Windows (PowerShell)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Function to test Python installation
function Test-Python {
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
            return $true
        }
    } catch {
        # Try python3 as alternative
        try {
            $pythonVersion = python3 --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
                Set-Alias -Name python -Value python3 -Scope Script
                return $true
            }
        } catch {}
    }
    
    Write-Host "✗ Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.6+ from https://python.org" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation" -ForegroundColor Yellow
    return $false
}

# Check Python installation
if (-not (Test-Python)) {
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Set paths
$nativeHostDir = "$env:APPDATA\Mozilla\NativeMessagingHosts"
$jsonFile = "funscript_rename_host.json"
$pythonScript = Join-Path $scriptDir "funscript_rename_host_v2.py"

# Create native messaging directory if it doesn't exist
if (-not (Test-Path $nativeHostDir)) {
    Write-Host "Creating native messaging directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $nativeHostDir -Force | Out-Null
    Write-Host "✓ Directory created: $nativeHostDir" -ForegroundColor Green
}

# Get Python executable path
$pythonPath = (Get-Command python).Source
if (-not $pythonPath) {
    $pythonPath = (Get-Command python3).Source
}

Write-Host ""
Write-Host "Python path: $pythonPath" -ForegroundColor Cyan
Write-Host "Script path: $pythonScript" -ForegroundColor Cyan

# Convert backslashes to forward slashes for JSON
$pythonPathJson = $pythonPath -replace '\\', '/'
$pythonScriptJson = $pythonScript -replace '\\', '/'

# Create JSON manifest
$manifest = @{
    name = "funscript_rename_host"
    description = "Native messaging host for Funscript Download Tracker"
    path = $pythonPathJson
    type = "stdio"
    allowed_extensions = @("funscript-tracker@example.com")
    args = @($pythonScriptJson)
}

# Convert to JSON and save
$jsonContent = $manifest | ConvertTo-Json -Depth 10
$manifestPath = Join-Path $nativeHostDir $jsonFile

Write-Host ""
Write-Host "Creating native host manifest..." -ForegroundColor Yellow
$jsonContent | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host "✓ Manifest created: $manifestPath" -ForegroundColor Green

# Test if Python script exists
if (-not (Test-Path $pythonScript)) {
    Write-Host ""
    Write-Host "✗ Python script not found at: $pythonScript" -ForegroundColor Red
    Write-Host "Please ensure the native-host folder is complete" -ForegroundColor Yellow
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Test Python script
Write-Host ""
Write-Host "Testing Python script..." -ForegroundColor Yellow
try {
    $testInput = '{"action": "ping"}' | python $pythonScript 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Python script is working!" -ForegroundColor Green
    } else {
        Write-Host "⚠ Script test returned an error, but may still work with the extension" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not test script directly, but it may still work with the extension" -ForegroundColor Yellow
}

# Success message
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart Firefox if it's currently running"
Write-Host "2. Install the extension from the packages folder"
Write-Host "3. Check Settings -> Native Host Status in the extension"
Write-Host ""
Write-Host "If you encounter issues:" -ForegroundColor Yellow
Write-Host "- Make sure Python 3.6+ is installed"
Write-Host "- Check that the extension ID matches in manifest.json"
Write-Host "- Review the browser console for error messages"
Write-Host ""

# Check if we should also set up Chrome/Edge support
Write-Host "Would you like to also install for Chrome/Edge? (y/n): " -NoNewline -ForegroundColor Cyan
$response = Read-Host
if ($response -eq 'y' -or $response -eq 'Y') {
    $chromeDir = "$env:APPDATA\..\Local\Google\Chrome\User Data\NativeMessagingHosts"
    $edgeDir = "$env:APPDATA\..\Local\Microsoft\Edge\User Data\NativeMessagingHosts"
    
    # Chrome
    if (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") {
        if (-not (Test-Path $chromeDir)) {
            New-Item -ItemType Directory -Path $chromeDir -Force | Out-Null
        }
        Copy-Item $manifestPath -Destination $chromeDir -Force
        Write-Host "✓ Installed for Chrome" -ForegroundColor Green
    }
    
    # Edge
    if (Test-Path "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe") {
        if (-not (Test-Path $edgeDir)) {
            New-Item -ItemType Directory -Path $edgeDir -Force | Out-Null
        }
        Copy-Item $manifestPath -Destination $edgeDir -Force
        Write-Host "✓ Installed for Edge" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")