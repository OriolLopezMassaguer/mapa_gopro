$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Free port 5173 if a leftover process is holding it
$conn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "Freeing port 5173 (PID $($conn.OwningProcess))..."
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\server'; `$env:DOTENV_PATH='$root\.env.local'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\client'; npm run dev"

# Wait for both servers to be ready, then open the browser
Start-Job -ScriptBlock {
    foreach ($url in @("http://localhost:3001/api/media", "http://localhost:5173")) {
        do {
            Start-Sleep -Milliseconds 500
            try { $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop; $ready = $true }
            catch { $ready = $false }
        } while (-not $ready)
    }
    Start-Process "http://localhost:5173"
} | Out-Null
