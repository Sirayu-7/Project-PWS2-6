# Script to stop IT Equipment Web Servers (PowerShell)

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Stopping IT Equipment Web Servers..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$ports = @(3000, 5173)
$stopped = 0

foreach ($p in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $pidNum = $c.OwningProcess
        if ($pidNum -gt 0) {
            try {
                $proc = Get-Process -Id $pidNum -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "[-] Stopping Port $p (PID: $pidNum - $($proc.ProcessName))..." -ForegroundColor Yellow
                    Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
                    $stopped++
                }
            } catch {}
        }
    }
}

if ($stopped -gt 0) {
    Write-Host "[OK] All servers stopped successfully." -ForegroundColor Green
} else {
    Write-Host "[INFO] No active servers found on port 3000 or 5173." -ForegroundColor Cyan
}

Start-Sleep -Seconds 2
