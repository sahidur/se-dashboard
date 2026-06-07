#!/usr/bin/env bash
# =============================================================================
#  BEP SE – Zero-downtime redeploy script
#  Run as root after an initial deploy.sh to pull code updates and rebuild.
#  Usage: sudo bash redeploy.sh
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}  ✓  ${NC}%s\n"  "$*"; }
step() { printf "\n${BOLD}${CYAN}━━━━  %s  ━━━━${NC}\n\n" "$*"; }
die()  { printf "\033[0;31m  ✗  ERROR: %s${NC}\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash redeploy.sh"

APP_USER="${APP_USER:-bep}"
APP_DIR="${APP_DIR:-/opt/bep-se}"
APP_BRANCH="${APP_BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/bep-se}"

[[ -d "$APP_DIR/backend" ]]  || die "App directory not found: ${APP_DIR}"

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
sleep 3
systemctl is-active --quiet bep-backend && ok "bep-backend restarted" || \
  { echo "bep-backend failed – check: journalctl -u bep-backend -n 50"; exit 1; }

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
sleep 3
systemctl is-active --quiet bep-frontend && ok "bep-frontend restarted" || \
  { echo "bep-frontend failed – check: journalctl -u bep-frontend -n 50"; exit 1; }

echo ""
echo -e "${BOLD}${GREEN}  Redeploy complete!${NC}"
echo ""
