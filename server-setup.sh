#!/usr/bin/env bash
# Запускается на сервере (Ubuntu 22.04/24.04) скриптом deploy.ps1. Безопасно запускать повторно.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
APP=/opt/beauty
: "${DOMAIN:?не задан DOMAIN}"

echo "==> Системные пакеты"
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw debian-keyring debian-archive-keyring apt-transport-https

echo "==> Node.js"
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Caddy (автоматический HTTPS)"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Код приложения"
id beauty >/dev/null 2>&1 || useradd --system --home-dir "$APP" --shell /usr/sbin/nologin beauty
mkdir -p "$APP"
tar -xzf /root/beauty-app.tgz -C "$APP"        # masters/ и config/ в архив не входят, данные не затрутся
mkdir -p "$APP/masters" "$APP/archive" "$APP/inbox" "$APP/config"
chown -R beauty:beauty "$APP"
cd "$APP"
runuser -u beauty -- npm ci --omit=dev --no-audit --no-fund

echo "==> Первичная настройка платформы"
if [ ! -f "$APP/config/platform.json" ]; then
  : "${PLATFORM_PASSWORD:?при первой установке нужен пароль платформы}"
  runuser -u beauty -- env PLATFORM_PASSWORD="$PLATFORM_PASSWORD" node engine/cli.js init
  # демо-мастера с известным паролем на публичном сервере не нужны
  runuser -u beauty -- node engine/cli.js remove demo || true
  runuser -u beauty -- node engine/cli.js remove demo-lavender || true
fi
# слушаем только локально (наружу смотрит Caddy) и задаём публичный адрес
runuser -u beauty -- env DOMAIN="$DOMAIN" node -e "const s=require('./engine/lib/store');const c=s.readConfig();c.host='127.0.0.1';c.port=3000;c.baseUrl='https://'+process.env.DOMAIN;s.writeConfig(c)"

echo "==> Служба beauty (автозапуск)"
cat > /etc/systemd/system/beauty.service <<UNIT
[Unit]
Description=Beauty booking platform
After=network.target

[Service]
User=beauty
WorkingDirectory=$APP
Environment=PORT=3000
ExecStart=/usr/bin/node engine/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable beauty >/dev/null
systemctl restart beauty

echo "==> HTTPS для $DOMAIN"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable caddy >/dev/null
systemctl restart caddy

echo "==> Файрвол"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

sleep 3
systemctl is-active beauty caddy
curl -fsS http://127.0.0.1:3000/health >/dev/null && echo "Платформа отвечает." || { echo "ОШИБКА: платформа не отвечает. Логи: journalctl -u beauty -n 50"; exit 1; }
echo "ГОТОВО: https://$DOMAIN"
