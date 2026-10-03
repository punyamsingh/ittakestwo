#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 VM (e.g. Oracle Cloud Always Free).
# Installs Node + Caddy, builds the game, runs it as a systemd service behind HTTPS.
#
#   curl -fsSL https://raw.githubusercontent.com/punyamsingh/ittakestwo/main/deploy/setup.sh | sudo bash -s -- <domain>
#
# <domain> must point at this VM's public IP. With no domain of your own, use
# <ip-with-dashes>.sslip.io (e.g. 129-146-1-2.sslip.io); it resolves to that IP.
set -euo pipefail

DOMAIN="${1:?usage: setup.sh <domain>}"
REPO=https://github.com/punyamsingh/ittakestwo.git
APP_DIR=/opt/ittakestwo
PORT=3001

[ "$(id -u)" -eq 0 ] || { echo "run with sudo"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

id -u game >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin game
[ -d "$APP_DIR/.git" ] || git clone "$REPO" "$APP_DIR"
chown -R game:game "$APP_DIR"

sudo -u game bash -c "cd $APP_DIR && git pull --ff-only && npm --prefix server ci --omit=dev && npm --prefix client ci && npm run build"

cat > /etc/systemd/system/ittakestwo.service <<EOF
[Unit]
Description=It Takes Two - Online game server
After=network.target

[Service]
User=game
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production PORT=$PORT
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# Caddy fetches and renews the HTTPS certificate itself and proxies WebSockets as-is.
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:$PORT
}
EOF

# Oracle's Ubuntu images ship iptables rules that drop everything but SSH.
if command -v iptables >/dev/null; then
  for p in 80 443; do
    iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport $p -j ACCEPT
  done
  command -v netfilter-persistent >/dev/null && netfilter-persistent save
fi

systemctl daemon-reload
systemctl enable --now ittakestwo
systemctl restart ittakestwo caddy

sleep 2
curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && echo "game server up on :$PORT"
echo "Done. Open https://$DOMAIN (the first certificate can take ~30s)."
