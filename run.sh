#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.run.pid"
LOG_FILE="$ROOT_DIR/.run.log"
APP_PORT="${APP_PORT:-3000}"

usage() {
  echo "Usage: ./run.sh {start|stop|restart|status}"
}

is_running() {
  [[ -f "$PID_FILE" ]] || return 1

  local pid
  pid="$(cat "$PID_FILE")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

port_pid() {
  lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

start() {
  if is_running; then
    echo "Already running with PID $(cat "$PID_FILE")."
    return 0
  fi

  local existing_pid
  existing_pid="$(port_pid)"
  if [[ -n "$existing_pid" ]]; then
    echo "$existing_pid" >"$PID_FILE"
    echo "Already running on port $APP_PORT with PID $existing_pid."
    return 0
  fi

  cd "$ROOT_DIR"
  nohup npm run dev >"$LOG_FILE" 2>&1 &
  echo "$!" >"$PID_FILE"
  echo "Started with PID $(cat "$PID_FILE"). Logs: $LOG_FILE"
}

stop() {
  if ! is_running; then
    local existing_pid
    existing_pid="$(port_pid)"
    if [[ -z "$existing_pid" ]]; then
      rm -f "$PID_FILE"
      echo "Not running."
      return 0
    fi
    echo "$existing_pid" >"$PID_FILE"
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PID_FILE"
      echo "Stopped."
      return 0
    fi
    sleep 0.2
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Force stopped."
}

status() {
  if is_running; then
    echo "Running with PID $(cat "$PID_FILE"). Logs: $LOG_FILE"
  elif [[ -n "$(port_pid)" ]]; then
    local existing_pid
    existing_pid="$(port_pid)"
    echo "$existing_pid" >"$PID_FILE"
    echo "Running on port $APP_PORT with PID $existing_pid. Logs: $LOG_FILE"
  else
    rm -f "$PID_FILE"
    echo "Not running."
  fi
}

case "${1:-}" in
  start)
    start
    ;;
  stop)
    stop
    ;;
  restart)
    stop
    start
    ;;
  status)
    status
    ;;
  *)
    usage
    exit 1
    ;;
esac
