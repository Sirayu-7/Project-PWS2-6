# Launcher script for IT Equipment Management System (ระบบจัดการอุปกรณ์ IT)
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  IT Equipment Management System (ระบบจัดการอุปกรณ์ IT)" -ForegroundColor Cyan
Write-Host "  System Requirements & Health Check" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$backendDir = Join-Path $PSScriptRoot "backend"
$frontendDir = Join-Path $PSScriptRoot "frontend"
$hasFatalError = $false

# -------------------------------------------------------------
# 1. Check Node.js
# -------------------------------------------------------------
$possibleNodePaths = @(
    "C:\Program Files\nodejs",
    "C:\Program Files (x86)\nodejs",
    "$env:LOCALAPPDATA\Programs\node",
    "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    foreach ($p in $possibleNodePaths) {
        if (Test-Path (Join-Path $p "node.exe")) {
            $env:PATH = "$p;$env:PATH"
            break
        }
    }
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    try {
        $nodeVerRaw = (node -v).Trim()
        $nodeVerNum = $nodeVerRaw.TrimStart('v')
        $nodeMajor = [int]($nodeVerNum.Split('.')[0])

        if ($nodeMajor -ge 18) {
            Write-Host "  [PASS] Node.js       : $nodeVerRaw (Requirement >= 18.x met)" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Node.js       : $nodeVerRaw (Detected version < 18, may cause issues)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [PASS] Node.js       : Found" -ForegroundColor Green
    }
} else {
    Write-Host "  [FAIL] Node.js       : Not installed or not found in PATH!" -ForegroundColor Red
    Write-Host "         -> Download & Install Node.js LTS from: https://nodejs.org/" -ForegroundColor Yellow
    $hasFatalError = $true
}

# -------------------------------------------------------------
# 2. Check npm Package Manager
# -------------------------------------------------------------
$npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
}

if ($npmCmd -or (Get-Command node -ErrorAction SilentlyContinue)) {
    try {
        $npmVer = (cmd /c npm -v 2>$null).Trim()
        if ($npmVer) {
            Write-Host "  [PASS] npm Package   : v$npmVer" -ForegroundColor Green
        } else {
            Write-Host "  [PASS] npm Package   : Detected" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [PASS] npm Package   : Detected" -ForegroundColor Green
    }
} else {
    Write-Host "  [FAIL] npm Package   : Not found!" -ForegroundColor Red
    $hasFatalError = $true
}

# -------------------------------------------------------------
# 3. Check MySQL Database (Port 3306)
# -------------------------------------------------------------
$xamppPaths = @(
    "C:\xampp\mysql_start.bat",
    "D:\xampp\mysql_start.bat",
    "E:\xampp\mysql_start.bat"
)

function Test-PortOpen([string]$ip, [int]$port, [int]$timeoutMs = 1000) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($ip, $port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne($timeoutMs, $false)
        if ($wait -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

$mysqlRunning = Test-PortOpen "127.0.0.1" 3306 1000

if (-not $mysqlRunning) {
    Write-Host "  [*] MySQL Port 3306  : Closed. Checking for XAMPP to auto-start..." -ForegroundColor DarkYellow
    foreach ($bat in $xamppPaths) {
        if (Test-Path $bat) {
            Start-Process $bat
            Start-Sleep -Seconds 3
            break
        }
    }
    $mysqlRunning = Test-PortOpen "127.0.0.1" 3306 1500
}

if ($mysqlRunning) {
    Write-Host "  [PASS] MySQL Port    : Port 3306 is open and active (MySQL / MariaDB)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] MySQL Port    : Port 3306 is NOT open!" -ForegroundColor Red
    Write-Host "         -> If using XAMPP: Open XAMPP Control Panel and click [Start] on MySQL" -ForegroundColor Yellow
    Write-Host "         -> If using MySQL Server: Start the Windows Service for MySQL" -ForegroundColor Yellow
    $hasFatalError = $true
}

# -------------------------------------------------------------
# 4. Check Ports 3000 & 5173 (Clean stale processes if any)
# -------------------------------------------------------------
$stalePorts = @(3000, 5173)
$cleanedStale = $false
foreach ($p in $stalePorts) {
    $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        foreach ($c in $conn) {
            $pidNum = $c.OwningProcess
            if ($pidNum -gt 0) {
                try {
                    $proc = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
                    if ($proc -and ($proc.ProcessName -match "node|cmd|powershell")) {
                        Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
                        $cleanedStale = $true
                    }
                } catch {}
            }
        }
    }
}
if ($cleanedStale) {
    Start-Sleep -Seconds 1
    Write-Host "  [PASS] Ports Check   : Cleaned previous background node processes" -ForegroundColor Green
} else {
    Write-Host "  [PASS] Ports Check   : Port 3000 (Backend) and Port 5173 (Frontend) are ready" -ForegroundColor Green
}

# -------------------------------------------------------------
# 5. Check Environment Files (.env)
# -------------------------------------------------------------
$backendEnv = Join-Path $backendDir ".env"
$backendEnvEx = Join-Path $backendDir ".env.example"
if (-not (Test-Path $backendEnv) -and (Test-Path $backendEnvEx)) {
    Copy-Item $backendEnvEx $backendEnv
    Write-Host "  [PASS] Backend Env   : Created backend/.env from .env.example" -ForegroundColor Green
} elseif (Test-Path $backendEnv) {
    Write-Host "  [PASS] Backend Env   : backend/.env is present" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Backend Env   : backend/.env not found and no .env.example" -ForegroundColor Yellow
}

$frontendEnv = Join-Path $frontendDir ".env"
$frontendEnvEx = Join-Path $frontendDir ".env.example"
if (-not (Test-Path $frontendEnv) -and (Test-Path $frontendEnvEx)) {
    Copy-Item $frontendEnvEx $frontendEnv
    Write-Host "  [PASS] Frontend Env  : Created frontend/.env from .env.example" -ForegroundColor Green
} elseif (Test-Path $frontendEnv) {
    Write-Host "  [PASS] Frontend Env  : frontend/.env is present" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Frontend Env  : frontend/.env not found and no .env.example" -ForegroundColor Yellow
}

# Stop if fatal errors were encountered in prerequisites
if ($hasFatalError) {
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor Red
    Write-Host "  [!] System Requirements Check FAILED!" -ForegroundColor Red
    Write-Host "  Please resolve the errors highlighted above and try again." -ForegroundColor Red
    Write-Host "===================================================" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

# -------------------------------------------------------------
# 6. Check Project Dependencies (node_modules)
# -------------------------------------------------------------
if (-not (Test-Path (Join-Path $backendDir "node_modules"))) {
    Write-Host "  [*] Backend Deps     : Installing node_modules (npm install)..." -ForegroundColor Yellow
    Push-Location $backendDir
    cmd /c npm install
    Pop-Location
    Write-Host "  [PASS] Backend Deps  : Packages installed successfully" -ForegroundColor Green
} else {
    Write-Host "  [PASS] Backend Deps  : backend/node_modules is ready" -ForegroundColor Green
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Write-Host "  [*] Frontend Deps    : Installing node_modules (npm install)..." -ForegroundColor Yellow
    Push-Location $frontendDir
    cmd /c npm install
    Pop-Location
    Write-Host "  [PASS] Frontend Deps : Packages installed successfully" -ForegroundColor Green
} else {
    Write-Host "  [PASS] Frontend Deps : frontend/node_modules is ready" -ForegroundColor Green
}

# -------------------------------------------------------------
# 7. Database Initialization & Schema / Seed Check
# -------------------------------------------------------------
Write-Host "  [*] Database Init    : Verifying database schema and initial seed data..." -ForegroundColor Gray
$initScript = Join-Path $backendDir "scripts\init-db.js"
Push-Location $backendDir
node $initScript
$initExitCode = $LASTEXITCODE
Pop-Location

if ($initExitCode -eq 0) {
    Write-Host "  [PASS] Database      : 'it_equipment_db' is up to date" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Database      : Database initialization failed" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  [OK] All Requirements Verified Successfully!" -ForegroundColor Green
Write-Host "  Starting Backend & Frontend Servers..." -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

# -------------------------------------------------------------
# 8. Start Backend & Frontend Servers
# -------------------------------------------------------------
Write-Host ""
Write-Host "[1/2] Starting Backend Server (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$backendDir'; cmd /c npm run dev"

Write-Host "[2/2] Starting Frontend Server (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$frontendDir'; cmd /c npm run dev"

# -------------------------------------------------------------
# 9. Wait for Frontend Server to respond
# -------------------------------------------------------------
Write-Host ""
Write-Host "[*] Waiting for Frontend Server to be ready (Port 5173)..." -ForegroundColor Yellow
$frontendReady = $false
for ($i = 0; $i -lt 25; $i++) {
    if (Test-PortOpen "127.0.0.1" 5173 500) {
        $frontendReady = $true
        Write-Host "  [PASS] Frontend Server is ready and accepting connections." -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  System is running successfully!" -ForegroundColor Green
Write-Host "  Frontend URL : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend URL  : http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Demo Accounts:" -ForegroundColor White
Write-Host "  - Admin    : admin    / Admin@1234" -ForegroundColor Cyan
Write-Host "  - Staff    : staff    / Staff@1234" -ForegroundColor Cyan
Write-Host "  - Borrower : borrower / Borrower@1234" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
