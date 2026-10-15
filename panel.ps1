# Открывает панель платформы с сервера через защищённый туннель (панель не доступна из интернета).
# Запуск:  powershell -NoProfile -ExecutionPolicy Bypass -File .\panel.ps1 -Ip 185.12.34.56
# Окно держите открытым, пока работаете в панели; закроете окно: туннель закроется.
param([string]$Ip = '')
if (-not $Ip) { $Ip = Read-Host 'IP-адрес сервера' }
Write-Host 'Открываю http://localhost:3300/platform ... (введите пароль root от сервера)' -ForegroundColor Cyan
Start-Job { Start-Sleep 6; Start-Process 'http://localhost:3300/platform' } | Out-Null
& ssh -L 3300:127.0.0.1:3000 "root@$Ip"
