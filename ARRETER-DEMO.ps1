$ErrorActionPreference = 'Stop'
$current = Join-Path $PSScriptRoot 'data/preview-current.json'
if (-not (Test-Path -LiteralPath $current)) { Write-Host 'Aucune demonstration active.'; exit }
$preview = Get-Content -LiteralPath $current -Raw | ConvertFrom-Json
$allowed = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'data/previews')) + [System.IO.Path]::DirectorySeparatorChar
$target = [System.IO.Path]::GetFullPath($preview.stopFile)
if (-not $target.StartsWith($allowed, [StringComparison]::OrdinalIgnoreCase)) { throw 'Chemin de demonstration invalide.' }
Set-Content -LiteralPath $target -Value 'stop'
Write-Host 'Arret de la demonstration demande. Votre application locale reste disponible.'
