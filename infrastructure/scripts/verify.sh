#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
./backend/mvnw -f backend/pom.xml verify -B
(cd ai-service && .venv/bin/python -m pytest -q)
(cd frontend && npm ci && npm test && npm run build)
if [ "${RUN_E2E:-0}" = 1 ]; then (cd frontend && npm run test:e2e); fi
