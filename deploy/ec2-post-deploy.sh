#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/BeforeYouAgree---Beta"

cd "$APP_DIR"

# Stop the API first so the loaded ONNX model releases its memory while npm
# installs the dependencies shipped in the new pipeline revision.
systemctl stop bya-api || true
trap 'systemctl start bya-api || true' EXIT


# Update only changed production dependencies instead of deleting and
# reinstalling the entire dependency tree during every deployment.
NODE_OPTIONS="--max-old-space-size=768" npm install \
    --omit=dev \
    --no-audit \
    --no-fund \
    --prefer-offline
chown -R ubuntu:ubuntu node_modules

systemctl restart bya-api
trap - EXIT

for attempt in $(seq 1 60); do
    if curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null; then
        echo "Deployment succeeded."
        exit 0
    fi
    sleep 5
done

journalctl -u bya-api -n 100 --no-pager
exit 1
