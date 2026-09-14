#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/bya/app"

cd "$APP_DIR"

# Amplify builds the browser application. This EC2 host runs only the API, so
# install runtime dependencies without running the memory-intensive Vue build.
npm ci --omit=dev

chown -R ubuntu:ubuntu "$APP_DIR"
mkdir -p /opt/bya/model
chown -R ubuntu:ubuntu /opt/bya/model

cat >/etc/systemd/system/bya-api.service <<'EOF'
[Unit]
Description=Before You Agree API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/bya/app
EnvironmentFile=/etc/bya/backend.env
ExecStart=/usr/bin/npm run server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bya-api
systemctl restart bya-api

for attempt in $(seq 1 60); do
    if curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null; then
        echo "Backend deployment succeeded."
        exit 0
    fi
    sleep 5
done

echo "Backend health check failed."
journalctl -u bya-api -n 100 --no-pager
exit 1
