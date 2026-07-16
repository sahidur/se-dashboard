#!/usr/bin/env bash
# =============================================================================
#  BEP SE – Zero-downtime redeploy script
#  Fixes: missing swap (OOM kills), broken nginx config (default page), 
#         missing systemd units.
#  Usage: sudo bash redeploy.sh
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { printf "${GREEN}  ✓  ${NC}%s\n"  "$*"; }
warn() { printf "${YELLOW}  !  ${NC}%s\n" "$*"; }
info() { printf "${CYAN}  ·  ${NC}%s\n"   "$*"; }
step() { printf "\n${BOLD}${CYAN}━━━━  %s  ━━━━${NC}\n\n" "$*"; }
die()  { printf "${RED}  ✗  ERROR: %s${NC}\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash redeploy.sh"

APP_USER="${APP_USER:-bep}"
APP_DIR="${APP_DIR:-/opt/bep-se}"
APP_BRANCH="${APP_BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/bep-se}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DOMAIN="${DOMAIN:-se.somadhanhobe.com}"

[[ -d "$APP_DIR/backend" ]] || die "App directory not found: ${APP_DIR}"

# =============================================================================
#  Fix 1 – Swap space (prevents OOM-killed npm/node processes)
# =============================================================================
step "Checking swap space"
SWAP_TOTAL=$(free -m | awk '/^Swap:/ {print $2}')
if [[ "$SWAP_TOTAL" -lt 1024 ]]; then
  warn "Only ${SWAP_TOTAL}MB swap – creating 2GB swap file to prevent OOM kills"
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile 2>/dev/null || true
  grep -qxF '/swapfile none swap sw 0 0' /etc/fstab || \
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -qxF 'vm.swappiness=10' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  ok "2GB swap active"
else
  ok "Swap OK (${SWAP_TOTAL}MB)"
fi

# =============================================================================
#  Fix 2 – Nginx: ensure bep-se site is enabled, not the default
# =============================================================================
step "Checking nginx configuration"

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
HAS_CERT=false
[[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]] && HAS_CERT=true

# Remove stale default and stale bep-se-http links
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot

if [[ "$HAS_CERT" == "false" ]]; then
  warn "No SSL cert found – writing HTTP-only config so the site works on port 80"
  warn "After DNS is pointed here, run certbot then re-run this script for HTTPS"

  cat > /etc/nginx/sites-available/bep-se-http << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    client_max_body_size 10M;

    location /api/ {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 120s;
    }

    location /_next/static/ {
        proxy_pass   http://127.0.0.1:${FRONTEND_PORT}/_next/static/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header   Cache-Control "public, max-age=31536000, immutable" always;
        access_log   off;
    }

    location / {
        proxy_pass         http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINX

  rm -f /etc/nginx/sites-enabled/bep-se
  ln -sf /etc/nginx/sites-available/bep-se-http /etc/nginx/sites-enabled/bep-se-http

else
  info "SSL cert found – writing HTTPS config"

  [[ -f /etc/letsencrypt/ssl-dhparams.pem ]] || \
    openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048 2>/dev/null

  [[ -f /etc/letsencrypt/options-ssl-nginx.conf ]] || cat > /etc/letsencrypt/options-ssl-nginx.conf << 'OPTS'
ssl_session_cache shared:le_nginx_SSL:10m;
ssl_session_timeout 1440m;
ssl_session_tickets off;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers off;
OPTS

  cat > /etc/nginx/sites-available/bep-se << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;
    ssl_stapling        on;
    ssl_stapling_verify on;
    resolver            1.1.1.1 8.8.8.8 valid=300s;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    client_max_body_size 10M;
    gzip on; gzip_vary on; gzip_proxied any; gzip_comp_level 6;
    gzip_types application/json application/javascript text/css text/plain;

    location /api/ {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 120s;
        proxy_buffering    off;
    }

    location /_next/static/ {
        proxy_pass   http://127.0.0.1:${FRONTEND_PORT}/_next/static/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        add_header   Cache-Control "public, max-age=31536000, immutable" always;
        access_log   off;
    }

    location / {
        proxy_pass         http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
NGINX

  rm -f /etc/nginx/sites-enabled/bep-se-http
  ln -sf /etc/nginx/sites-available/bep-se /etc/nginx/sites-enabled/bep-se
  ok "HTTPS nginx config linked"
fi

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  ok "Nginx reloaded"
else
  warn "Nginx config has errors:"
  nginx -t
fi

# =============================================================================
#  Ensure system user and directories
# =============================================================================
id "$APP_USER" &>/dev/null || \
  useradd --system --shell /bin/false --home-dir "$APP_DIR" --create-home "$APP_USER"
mkdir -p "$LOG_DIR" "${APP_DIR}/backend/uploads"
chown -R "$APP_USER":"$APP_USER" "$LOG_DIR" "$APP_DIR"

# =============================================================================
#  Create systemd units if missing
# =============================================================================
create_services() {
  step "Creating systemd service units"
  cat > /etc/systemd/system/bep-backend.service << UNIT
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

  cat > /etc/systemd/system/bep-frontend.service << UNIT
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

systemctl list-unit-files bep-backend.service &>/dev/null && \
  systemctl list-unit-files bep-frontend.service &>/dev/null || create_services

# =============================================================================
#  Pull latest code
# =============================================================================
step "Pulling latest code"
if [[ -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/${APP_BRANCH}"
  ok "Code updated from origin/${APP_BRANCH}"
else
  ok "No git repo – files updated via rsync/scp"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# =============================================================================
#  Ensure backend env has WebAuthn keys (passkey login)
# =============================================================================
step "Ensuring backend WebAuthn env keys"
BACKEND_ENV_FILE="${APP_DIR}/backend/.env"
[[ -f "$BACKEND_ENV_FILE" ]] || die "Missing backend env file: ${BACKEND_ENV_FILE}"

CORS_ORIGIN_VALUE="$(grep -E '^CORS_ORIGIN=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
DEFAULT_WEBAUTHN_ORIGIN="${CORS_ORIGIN_VALUE:-https://${DOMAIN}}"

if ! grep -q '^WEBAUTHN_RP_ID=' "$BACKEND_ENV_FILE"; then
  echo "WEBAUTHN_RP_ID=${DOMAIN}" >> "$BACKEND_ENV_FILE"
  ok "Added WEBAUTHN_RP_ID=${DOMAIN}"
fi

if ! grep -q '^WEBAUTHN_RP_NAME=' "$BACKEND_ENV_FILE"; then
  echo "WEBAUTHN_RP_NAME=BEP Social Enterprise Platform" >> "$BACKEND_ENV_FILE"
  ok "Added WEBAUTHN_RP_NAME"
fi

if ! grep -q '^WEBAUTHN_ORIGIN=' "$BACKEND_ENV_FILE"; then
  echo "WEBAUTHN_ORIGIN=${DEFAULT_WEBAUTHN_ORIGIN}" >> "$BACKEND_ENV_FILE"
  ok "Added WEBAUTHN_ORIGIN=${DEFAULT_WEBAUTHN_ORIGIN}"
fi

chown "$APP_USER":"$APP_USER" "$BACKEND_ENV_FILE"

# =============================================================================
#  Build backend
# =============================================================================
step "Rebuilding backend"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/backend
  npm ci --prefer-offline
  npm run build
  npm prune --omit=dev
"
ok "Backend built"

systemctl restart bep-backend
sleep 4
if systemctl is-active --quiet bep-backend; then
  ok "bep-backend running"
else
  warn "bep-backend failed. Last 30 lines:"
  journalctl -u bep-backend -n 30 --no-pager
  exit 1
fi

# =============================================================================
#  Build frontend  (NODE_OPTIONS caps heap to avoid OOM on small droplets)
# =============================================================================
step "Rebuilding frontend"
sudo -u "$APP_USER" bash -c "
  set -e
  export NODE_OPTIONS='--max-old-space-size=512'
  cd ${APP_DIR}/frontend
  npm ci --prefer-offline
  npm run build
"
ok "Frontend built"

systemctl restart bep-frontend
sleep 4
if systemctl is-active --quiet bep-frontend; then
  ok "bep-frontend running"
else
  warn "bep-frontend failed. Last 30 lines:"
  journalctl -u bep-frontend -n 30 --no-pager
  exit 1
fi

# =============================================================================
#  Done
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  Redeploy complete!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
PROTO="http"
[[ "$HAS_CERT" == "true" ]] && PROTO="https"
echo -e "  ${BOLD}Site${NC}  :  ${PROTO}://${DOMAIN}"
if [[ "$HAS_CERT" == "false" ]]; then
  echo ""
  echo -e "  ${YELLOW}To enable HTTPS, run:${NC}"
  echo -e "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} \\"
  echo -e "    --email YOUR_EMAIL --agree-tos --non-interactive"
  echo -e "  Then run:  sudo bash redeploy.sh"
fi
echo ""
