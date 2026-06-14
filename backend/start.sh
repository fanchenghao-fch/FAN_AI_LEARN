#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# 阿拉灯神丁 · Backend Startup Script
# ────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

echo "══════════════════════════════════════════════"
echo "  阿拉灯神丁 Backend"
echo "══════════════════════════════════════════════"

# ── Check .env ──────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  .env not found at $ENV_FILE"
  echo "   Copy .env.example → .env and fill in your keys."
  exit 1
fi
echo "✅ .env loaded from $ENV_FILE"

# ── Check Python ────────────────────────────────────────
PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "❌ python3 not found. Please install Python ≥3.10."
  exit 1
fi
echo "✅ Python: $($PYTHON --version)"

# ── Install deps (poetry or pip) ────────────────────────
cd "$SCRIPT_DIR"
if command -v poetry &>/dev/null && [ -f pyproject.toml ]; then
  echo "📦 Installing dependencies (poetry)..."
  poetry install --no-root -q 2>/dev/null || true
else
  echo "📦 Installing dependencies (pip)..."
  $PYTHON -m pip install -q -r requirements.txt 2>/dev/null || {
    echo "⚠️  pip install failed — continuing anyway."
  }
fi

# ── Read config ─────────────────────────────────────────
HOST=$(grep -oP 'BACKEND_HOST=\K.*' "$ENV_FILE" 2>/dev/null || echo "0.0.0.0")
PORT=$(grep -oP 'BACKEND_PORT=\K.*' "$ENV_FILE" 2>/dev/null || echo "8000")

# ── Determine LAN IP (for display) ──────────────────────
LAN_IP=""
if command -v ifconfig &>/dev/null; then
  LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
fi

echo ""
echo "──────────────────────────────────────────────────"
echo "  Starting server..."
echo "  Host :  $HOST"
echo "  Port :  $PORT"
if [ -n "$LAN_IP" ]; then
  echo "  LAN  :  http://$LAN_IP:$PORT"
fi
echo "  Local:  http://localhost:$PORT"
echo "──────────────────────────────────────────────────"
echo ""

# ── Start uvicorn (prefer poetry, fallback to plain python) ──
if command -v poetry &>/dev/null && [ -f pyproject.toml ]; then
  exec poetry run uvicorn app.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload \
    --log-level info
else
  exec $PYTHON -m uvicorn app.main:app \
    --host "$HOST" \
    --port "$PORT" \
    --reload \
    --log-level info
fi
