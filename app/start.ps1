# Запуск платформы онлайн-записи. Повторный запуск безопасен.
# Запускать так:  powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1
param([switch]$NoBrowser)
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
Set-Location -Path $PSScriptRoot
function Say($text, $color = 'White') { Write-Host $text -ForegroundColor $color }
function Stop-Here($text) { Say $text 'Red'; Read-Host 'Нажмите Enter, чтобы закрыть окно'; exit 1 }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Test-Node {
    try { $v = (& node -v) 2>$null; if ($v -match '^v(\d+)') { return ([int]$Matches[1] -ge 18) } } catch { }
    return $false
}

Say '=== Платформа онлайн-записи ===' 'Cyan'

# 1. Node.js
if (-not (Test-Node)) {
    Say 'Node.js не найден (нужна версия 18 или новее).' 'Yellow'
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Say 'Устанавливаю Node.js LTS через winget. Если появится вопрос — согласитесь...' 'Yellow'
        winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
        Refresh-Path
    }
    if (-not (Test-Node)) {
        Say 'Не удалось установить Node.js автоматически. Сделайте так:' 'Yellow'
        Say '  1) Откройте https://nodejs.org и скачайте версию LTS' 'Yellow'
        Say '  2) Установите (все вопросы — «Далее»)' 'Yellow'
        Say '  3) Закройте это окно и запустите start.ps1 снова' 'Yellow'
        Stop-Here 'Без Node.js платформа не запустится.'
    }
}
Say ('Node.js: ' + (& node -v)) 'Green'

# 2. Компоненты
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules\express'))) {
    Say 'Устанавливаю компоненты (один раз, около минуты)...' 'Yellow'
    & npm install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Stop-Here 'Не удалось установить компоненты. Проверьте интернет и запустите start.ps1 снова.' }
}

# 3. Первый запуск: пароль платформы и демо-мастера
$cfgPath = Join-Path $PSScriptRoot 'config\platform.json'
if (-not (Test-Path $cfgPath)) {
    Say 'Первый запуск. Придумайте пароль для панели платформы (не короче 8 символов).' 'Cyan'
    Say 'Он нужен только вам. Запишите его — восстановить нельзя, но можно задать новый (см. README).' 'Gray'
    while ($true) {
        $s1 = Read-Host 'Пароль' -AsSecureString
        $s2 = Read-Host 'Повторите пароль' -AsSecureString
        $a = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
        $b = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
        if ($a -ne $b) { Say 'Пароли не совпали. Попробуйте ещё раз.' 'Yellow'; continue }
        $env:PLATFORM_PASSWORD = $a
        & node engine\cli.js init
        $code = $LASTEXITCODE
        Remove-Item Env:PLATFORM_PASSWORD -ErrorAction SilentlyContinue
        if ($code -eq 0) { break }
        Say 'Придумайте другой пароль.' 'Yellow'
    }
    Say 'Готово: пароль сохранён, созданы два демо-мастера (demo и demo-lavender).' 'Green'
}

# 4. Порт и запуск
$port = 3000
try { $c = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json; if ($c.port) { $port = [int]$c.port } } catch { }
$env:PORT = "$port"
$url = "http://localhost:$port/platform"

try {
    Invoke-WebRequest -Uri "http://localhost:$port/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
    Say 'Платформа уже запущена — открываю панель.' 'Green'
    if (-not $NoBrowser) { Start-Process $url }
    exit 0
} catch { }

if (-not $NoBrowser) {
    Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -Command Start-Sleep -Seconds 3; Start-Process '$url'" | Out-Null
}
Say ''
Say "Платформа запускается. Панель откроется в браузере: $url" 'Green'
Say 'Если Windows спросит про доступ к сети — нажмите «Разрешить доступ».' 'Gray'
Say 'Чтобы остановить платформу, закройте это окно (или нажмите Ctrl+C).' 'Gray'
Say ''
& node engine\server.js
if ($LASTEXITCODE -ne 0) { Stop-Here 'Платформа остановилась с ошибкой. Текст ошибки выше.' }
