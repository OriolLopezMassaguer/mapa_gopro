$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\server'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\client'; npm run dev"
