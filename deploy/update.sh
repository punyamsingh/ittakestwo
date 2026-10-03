#!/usr/bin/env bash
# Pull the latest main, rebuild, and restart. Run on the VM: sudo /opt/ittakestwo/deploy/update.sh
set -euo pipefail
APP_DIR=/opt/ittakestwo

sudo -u game bash -c "cd $APP_DIR && git pull --ff-only && npm --prefix server ci --omit=dev && npm --prefix client ci && npm run build"
systemctl restart ittakestwo
echo "updated to $(sudo -u game git -C $APP_DIR log --oneline -1)"
