$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$root\client"
npm run dev
