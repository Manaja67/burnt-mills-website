$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$appUrl = 'http://127.0.0.1:4310'
$runtimePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $runtimePath) { throw 'Node.js 24 ou plus recent est requis. / Node.js 24 or newer is required.' }
$version = & $runtimePath --version
if ([version]$version.TrimStart('v') -lt [version]'24.0.0') { throw 'Node.js 24 ou plus recent est requis. / Node.js 24 or newer is required.' }
$running = $null
try { $running = Invoke-RestMethod -Uri ($appUrl + '/api/session') -TimeoutSec 2 } catch { }
if ($running -and $running.app -ne 'burnt-mills-investment-llc') { throw 'Le port 4310 est utilise par une autre application. / Port 4310 belongs to another application.' }
if (-not $running) {
    $dataPath = Join-Path $appRoot 'data'
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    $serverPath = Join-Path $appRoot 'server\index.mjs'
    Start-Process -FilePath $runtimePath -ArgumentList ('"' + $serverPath + '"') -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataPath 'server.log') -RedirectStandardError (Join-Path $dataPath 'server-error.log')
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try { $running = Invoke-RestMethod -Uri ($appUrl + '/api/session') -TimeoutSec 1; break } catch { Start-Sleep -Milliseconds 400 }
    }
    if (-not $running -or $running.app -ne 'burnt-mills-investment-llc') { throw 'Demarrage impossible. Consultez data\server-error.log. / Startup failed. Check data\server-error.log.' }
}
Start-Process $appUrl
