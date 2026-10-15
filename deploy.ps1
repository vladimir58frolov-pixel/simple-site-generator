# Развёртывание / обновление на сервере Timeweb Cloud одной командой.
# Запуск:  powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1
param([string]$Ip = '', [string]$Domain = '')
$ErrorActionPreference = 'Stop'
function Say($t, $c = 'White') { Write-Host $t -ForegroundColor $c }

foreach ($tool in 'ssh', 'scp', 'tar') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Say "Не найдена команда $tool. В Windows 10/11: Параметры -> Приложения -> Дополнительные компоненты -> добавить «Клиент OpenSSH»." 'Red'; exit 1
    }
}
if (-not $Ip) { $Ip = Read-Host 'IP-адрес сервера (из панели Timeweb)' }
$Ip = $Ip.Trim()
if ($Ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Say 'IP должен выглядеть так: 185.12.34.56' 'Red'; exit 1 }
if (-not $Domain) {
    $Domain = ($Ip -replace '\.', '-') + '.sslip.io'
    Say "Свой домен не указан, использую бесплатный адрес: $Domain" 'Yellow'
}
$Domain = $Domain.Trim().ToLower()
if ($Domain -notmatch '^[a-z0-9.-]+\.[a-z]{2,}$') { Say 'Домен выглядит неверно.' 'Red'; exit 1 }

$sec = Read-Host 'Пароль панели платформы: латиница и цифры, от 8 символов (при ОБНОВЛЕНИИ просто нажмите Enter)' -AsSecureString
$pw = (New-Object System.Net.NetworkCredential('', $sec)).Password
if ($pw -and $pw -notmatch '^[A-Za-z0-9]{8,64}$') { Say 'Пароль: только латиница и цифры, 8-64 символа.' 'Red'; exit 1 }

Say 'Упаковываю проект...' 'Cyan'
$work = Join-Path $env:TEMP 'beauty-deploy'
New-Item -ItemType Directory -Force $work | Out-Null
$arc = Join-Path $work 'beauty-app.tgz'
if (Test-Path $arc) { Remove-Item $arc -Force }
Copy-Item (Join-Path $PSScriptRoot 'server-setup.sh') (Join-Path $work 'server-setup.sh') -Force
Push-Location $PSScriptRoot
& tar -czf $arc --exclude=node_modules --exclude=masters --exclude=config --exclude=archive --exclude=inbox --exclude=.git --exclude=*.zip .
if ($LASTEXITCODE -ne 0) { Pop-Location; Say 'Не удалось упаковать проект.' 'Red'; exit 1 }
Pop-Location

Say 'Загружаю на сервер (введите пароль root из панели Timeweb)...' 'Cyan'
Push-Location $work
& scp -o StrictHostKeyChecking=accept-new beauty-app.tgz server-setup.sh "root@${Ip}:/root/"
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Say 'Загрузка не удалась. Проверьте IP и пароль root.' 'Red'; exit 1 }

Say 'Устанавливаю на сервере (3-6 минут, при первом запуске; пароль root спросят ещё раз)...' 'Cyan'
$remote = "tr -d '\r' < /root/server-setup.sh > /root/s.sh && DOMAIN='$Domain' PLATFORM_PASSWORD='$pw' bash /root/s.sh"
& ssh -o StrictHostKeyChecking=accept-new "root@$Ip" $remote
if ($LASTEXITCODE -ne 0) { Say 'Установка завершилась с ошибкой. Пришлите текст выше.' 'Red'; exit 1 }

Say ''
Say "ГОТОВО. Сайт: https://$Domain" 'Green'
Say ('Панель платформы (создание мастеров): .\panel.ps1 -Ip ' + $Ip) 'Green'
