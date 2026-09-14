#!/usr/bin/env bash
set -euo pipefail

cd /opt/bya/app
npm ci
npm run build

chown -R ubuntu:ubuntu /opt/bya/app
mkdir -p /opt/bya/model
chown -R ubuntu:ubuntu /opt/bya/model