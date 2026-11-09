<#
  Starts every service the Lab Test System needs, each in its own window:
    Laravel API        :8000
    CBC ML service     :8001
    Urinalysis ML      :8002
    Embedding service  :8003  (RAG retrieval)
    Frontend (Vite)    :5173

  Usage (from the project root, in PowerShell):
    .\start-all.ps1          # normal, localhost only
    .\start-all.ps1 -Lan     # also reachable from a phone on the same Wi-Fi

  With -Lan, open the app on the laptop using the LAN address printed at
  the end (NOT localhost), so the QR code encodes an address the phone can
  reach. Windows Firewall may ask to allow ports 8000 and 5173 the first
  time: allow on Private networks.
#>
param([switch]$Lan)

$root = $PSScriptRoot
$py   = Join-Path $root ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
  Write-Host "Python venv not found at $py" -ForegroundColor Red
  exit 1
}

function Start-Service-Window($title, $workdir, $command) {
  $full = "`$Host.UI.RawUI.WindowTitle = '$title'; $command"
  Start-Process powershell -WorkingDirectory $workdir -ArgumentList @("-NoExit", "-Command", $full)
}

$serveHost = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
$viteCmd   = if ($Lan) { "npm run dev:lan" } else { "npm run dev" }

Start-Service-Window "Laravel :8000"   (Join-Path $root "backend")  "php artisan serve --host=$serveHost --port=8000"
Start-Service-Window "CBC ML :8001"    (Join-Path $root "ml")       "& '$py' -m uvicorn api:app --host 127.0.0.1 --port 8001"
Start-Service-Window "Urinalysis :8002" (Join-Path $root "ml")      "& '$py' -m uvicorn urinalysis_api:app --host 127.0.0.1 --port 8002"
Start-Service-Window "Embedding :8003" (Join-Path $root "ml")       "& '$py' -m uvicorn embedding_api:app --host 127.0.0.1 --port 8003"
Start-Service-Window "Frontend :5173"  (Join-Path $root "frontend") $viteCmd

Write-Host ""
Write-Host "Started 5 windows. Give the ML services a few seconds to load their models." -ForegroundColor Green

if ($Lan) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback' } |
    Select-Object -First 1).IPAddress
  if ($ip) {
    Write-Host "Open the app on the laptop at: http://${ip}:5173" -ForegroundColor Cyan
  } else {
    Write-Host "Could not detect a LAN IP. Run ipconfig and use your Wi-Fi IPv4 address." -ForegroundColor Yellow
  }
}
