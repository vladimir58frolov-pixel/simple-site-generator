# Скачивает резервную копию всех данных (мастера, записи, фото, настройки) в папку backups рядом со скриптом.
# Запуск:  powershell -NoProfile -ExecutionPolicy Bypass -File .\backup.ps1 -Ip 185.12.34.56
param([string]$Ip = '')
if (-not $Ip) { $Ip = Read-Host 'IP-адрес сервера' }
$dir = Join-Path $PSScriptRoot 'backups'; New-Item -ItemType Directory -Force $dir | Out-Null
$name = 'beauty-data-' + (Get-Date -Format 'yyyy-MM-dd_HH-mm') + '.tgz'
& ssh "root@$Ip" "tar -czf /root/$name -C /opt/beauty masters config"
& scp "root@${Ip}:/root/$name" $dir
& ssh "root@$Ip" "rm -f /root/$name"
Write-Host "Копия сохранена: $dir\$name" -ForegroundColor Green
