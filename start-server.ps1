$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:DOTENV_PATH = "$root\.env.local"
Set-Location "$root\server"
npm run dev
