#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"
PYTHON_BIN="$VENV_DIR/bin/python"
PIP_BIN="$VENV_DIR/bin/pip"
REQ_FILE="$SCRIPT_DIR/requirements.txt"

ensure_venv() {
  if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "[setup] Creating virtual environment: $VENV_DIR"
    python3 -m venv "$VENV_DIR"
  fi
}

ensure_deps() {
  if ! "$PYTHON_BIN" -c "import fastapi, openai; from google import genai" >/dev/null 2>&1; then
    echo "[setup] Installing dependencies in $VENV_DIR"
    "$PYTHON_BIN" -m pip install --upgrade pip
    "$PIP_BIN" install -r "$REQ_FILE"
  fi
}

main() {
  ensure_venv
  ensure_deps

  if [[ "${1:-}" == "--check" ]]; then
    echo "[ok] Python: $($PYTHON_BIN -c 'import sys; print(sys.executable)')"
    echo "[ok] Gemini SDK import check passed"
    return 0
  fi

  # NOTE: Binding to 0.0.0.0 / ::1 can fail with EPERM depending on the local environment.
  # Default to IPv4 loopback to keep local dev stable.
  local HOST="${HOST:-127.0.0.1}"
  local PORT="${PORT:-8052}"

  echo "[run] Starting backend with: $PYTHON_BIN -m uvicorn app:app --host $HOST --port $PORT --reload"
  cd "$SCRIPT_DIR"
  exec "$PYTHON_BIN" -m uvicorn app:app --host "$HOST" --port "$PORT" --reload
}

main "$@"
