#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 infrastructure/scripts/init_env.py
set -a
source .env
set +a
export NEXUS_DEV_DATA_DIR="${NEXUS_DEV_DATA_DIR:-$PWD/data/dev-postgres}"
if ! node --version >/dev/null 2>&1 && [ -x .tools/node-v22.22.0-darwin-arm64/bin/node ]; then
  export PATH="$PWD/.tools/node-v22.22.0-darwin-arm64/bin:$PATH"
fi
mkdir -p .tools
owned_pids=()
neo_owned=false
neo_home=''
port_open() { python3 - "$1" <<'PY'
import socket,sys
s=socket.socket();s.settimeout(.2)
try:s.connect(('127.0.0.1',int(sys.argv[1])));sys.exit(0)
except OSError:sys.exit(1)
finally:s.close()
PY
}
cleanup() {
  trap - EXIT INT TERM
  for pid in "${owned_pids[@]:-}"; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  if $neo_owned; then JAVA_HOME="$neo_java" "$neo_home/bin/neo4j" stop >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT INT TERM
if [ "${1:-}" = '--full' ]; then
  if [ ! -x .tools/qdrant/qdrant ] || [ ! -x .tools/redis-stable/src/redis-server ]; then
    echo 'Native index tools are missing. Use Docker Compose, or install the optional native tools described in docs/DEPLOYMENT.md.' >&2; exit 1
  fi
  if ! port_open 6333; then .tools/qdrant/qdrant --config-path .tools/qdrant/config.yaml > .tools/qdrant-local.log 2>&1 & owned_pids+=("$!"); fi
  if ! port_open 6379; then .tools/redis-stable/src/redis-server --bind 127.0.0.1 --port 6379 --save '' --appendonly no > .tools/redis-local.log 2>&1 & owned_pids+=("$!"); fi
  if ! port_open 7687; then
    for candidate in .tools/neo4j-community-*; do [ -d "$candidate" ] && neo_home="$PWD/$candidate"; done
    for candidate in .tools/java21/*/Contents/Home; do [ -d "$candidate" ] && neo_java="$PWD/$candidate"; done
    if [ -z "$neo_home" ] || [ -z "${neo_java:-}" ]; then echo 'Project-local Neo4j and Java 21 are missing.' >&2; exit 1; fi
    JAVA_HOME="$neo_java" "$neo_home/bin/neo4j" start > .tools/neo4j-start.log 2>&1
    neo_owned=true
  fi
fi
for port in 3000 8080 8000; do
  if port_open "$port"; then echo "Port $port is already occupied. Stop the existing development process before starting another." >&2; exit 1; fi
done
(cd ai-service && exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) > .tools/ai-local.log 2>&1 & owned_pids+=("$!")
./backend/mvnw -f backend/pom.xml test-compile org.codehaus.mojo:exec-maven-plugin:3.6.2:java -Dexec.mainClass=com.nexus.LocalApplication -Dexec.classpathScope=test > .tools/backend-local.log 2>&1 & owned_pids+=("$!")
echo 'Waiting for application service readiness…'
python3 - <<'PYREADY'
import time, urllib.request
urls=['http://127.0.0.1:8000/health','http://127.0.0.1:8080/api/v1/stats']
for attempt in range(30):
    ready=True
    for url in urls:
        try:
            with urllib.request.urlopen(url,timeout=1) as response:
                if response.status!=200:ready=False
        except Exception:
            ready=False
        if not ready:break
    if ready:break
    time.sleep(1)
else:
    raise SystemExit('Services did not become ready. Inspect .tools/backend-local.log and .tools/ai-local.log.')
PYREADY
(
  cd frontend
  if [ "${NEXUS_FRONTEND_MODE:-development}" = production ]; then
    cp -R public .next/standalone/
    cp -R .next/static .next/standalone/.next/
    export HOSTNAME=127.0.0.1 PORT=3000
    exec node .next/standalone/server.js
  else
    exec npm run dev
  fi
) > .tools/frontend-local.log 2>&1 & owned_pids+=("$!")
echo 'NEXUS local validation: http://localhost:3000. Logs: .tools/*-local.log'
echo 'Local PostgreSQL data is retained in data/dev-postgres. Use Compose for portable deployments.'
wait
