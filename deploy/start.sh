#!/usr/bin/env bash
set -euo pipefail

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