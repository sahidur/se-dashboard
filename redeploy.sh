#!/usr/bin/env bash
# =============================================================================
#  BEP SE – Zero-downtime redeploy script
#  Run as root after an initial deploy.sh to pull code updates and rebuild.
#  Usage: sudo bash redeploy.sh
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}  ✓  ${NC}%s\n"  "$*"; }
warn() { printf "${YELLOW}  !  ${NC}%s\n" "$*"; }
step() { printf "\n${BOLD}${CYAN}━━━━  %s  ━━━━${NC}\n\n" "$*"; }
die()  { printf "\033[0;31m  ✗  ERROR: %s${NC}\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash redeploy.sh"

APP_USER="${APP_USER:-bep}"
APP_DIR="${APP_DIR:-/opt/bep-se}"
APP_BRANCH="${APP_BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/bep-se}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

[[ -d "$APP_DIR/backend" ]]  || die "App directory not found: ${APP_DIR}. Run deploy.sh first."

# ── Ensure system user exists ─────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --shell /bin/false --home-dir "$APP_DIR" --create-home "$APP_USER"
  ok "Created system user '${APP_USER}'"
fi

# ── Ensure log directory exists ───────────────────────────────────────────────
mkdir -p "$LOG_DIR"
chown -R "$APP_USER":"$APP_USER" "$LOG_DIR"

# ── Create systemd units if they are missing ─────────────────────────────────
create_services() {
  step "Creating missing systemd service units"

  cat > /etc/systemd/system/bep-backend.service <<UNIT
[Unit]
Description=BEP SE – Backend (NestJS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node dist/main.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=60
StandardOutput=append:${LOG_DIR}/backend.log
StandardError=append:${LOG_DIR}/backend-error.log
SyslogIdentifier=bep-backend
EnvironmentFile=${APP_DIR}/backend/.env
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/backend/uploads ${LOG_DIR}

[Install]
WantedBy=multi-user.target
UNIT

  cat > /etc/systemd/system/bep-frontend.service <<UNIT
[Unit]
Description=BEP SE – Frontend (Next.js)
After=network-online.target bep-backend.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/frontend
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start --port ${FRONTEND_PORT}
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=60
StandardOutput=append:${LOG_DIR}/frontend.log
StandardError=append:${LOG_DIR}/frontend-error.log
SyslogIdentifier=bep-frontend
EnvironmentFile=${APP_DIR}/frontend/.env.local
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/frontend/.next ${LOG_DIR}

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable bep-backend bep-frontend
  ok "Services created and enabled"
}

if ! systemctl list-unit-files bep-backend.service &>/dev/null || \
   ! systemctl list-unit-files bep-frontend.service &>/dev/null; then
  warn "systemd units not found – creating them now"
  create_services
fi

# ── Pull latest code ──────────────────────────────────────────────────────────
step "Pulling latest code"
if [[ -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/${APP_BRANCH}"
  ok "Code updated from origin/${APP_BRANCH}"
else
  ok "No git repo – assuming files already updated via rsync/scp"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ── Backend ───────────────────────────────────────────────────────────────────
step "Rebuilding backend"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/backend
  npm ci --prefer-offline
  npm run build
  npm prune --omit=dev
"
ok "Backend rebuilt"

systemctl restart bep-backend
sleep 4
systemctl is-active --quiet bep-backend && ok "bep-backend restarted" || \
  { warn "bep-backend did not start. Check logs:"; journalctl -u bep-backend -n 30 --no-pager; exit 1; }

# ── Frontend ──────────────────────────────────────────────────────────────────
step "Rebuilding frontend"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/frontend
  npm ci --prefer-offline
  npm run build
"
ok "Frontend rebuilt"

systemctl restart bep-frontend
sleep 4
systemctl is-active --quiet bep-frontend && ok "bep-frontend restarted" || \
  { warn "bep-frontend did not start. Check logs:"; journalctl -u bep-frontend -n 30 --no-pager; exit 1; }

echo ""
echo -e "${BOLD}${GREEN}  Redeploy complete!${NC}"
echo ""


systemctl restart bep-frontend
sleep 3
systemctl is-active --quiet bep-frontend && ok "bep-frontend restarted" || \
  { echo "bep-frontend failed – check: journalctl -u bep-frontend -n 50"; exit 1; }

echo ""
echo -e "${BOLD}${GREEN}  Redeploy complete!${NC}"
echo ""
