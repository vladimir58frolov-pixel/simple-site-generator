# Создать мастера из текстового файла с анкетой: .\new-master.ps1 -File anketa.txt (то же делается в панели платформы кнопкой)
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
Set-Location -Path $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Node.js не найден. Сначала запустите start.ps1.' -ForegroundColor Red; exit 1 }
if (-not (Test-Path (Join-Path $PSScriptRoot 'config\platform.json'))) { Write-Host 'Платформа ещё не настроена. Сначала запустите start.ps1.' -ForegroundColor Red; exit 1 }
& node engine\cli.js new $File
