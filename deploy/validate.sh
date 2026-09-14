#!/usr/bin/env bash
set -euo pipefail

for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null; then
    exit 0
  fi

  sleep 5
done

journalctl -u bya-api -n 100 --no-pager
exit 1