#!/usr/bin/env bash
# =============================================================================
#  SE360 – Zero-downtime redeploy script
#  Fixes: missing swap (OOM kills), broken nginx config (default page),
#         missing systemd units, missing/placeholder env keys.
#  Also reconciles the security settings the app now expects (TRUST_PROXY,
#  signed upload URLs, cookie sessions, nginx rate limits, locked-down
#  /api/uploads/) on already-deployed boxes.
#
#  Usage: sudo bash redeploy.sh
#         sudo STRICT_UPLOADS=true bash redeploy.sh   # enforce signed-only upload URLs
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

APP_USER="${APP_USER:-se360}"
APP_DIR="${APP_DIR:-/opt/se360}"
APP_BRANCH="${APP_BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/se360}"
NODE_MAJOR="${NODE_MAJOR:-24}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DOMAIN="${DOMAIN:-se.somadhanhobe.com}"

# Upload URL enforcement (see the "Reconciling backend environment file" step):
#   false (default) -> first reconciliation adds UPLOADS_ALLOW_UNSIGNED=true so
#                      pre-signing upload URLs stored in DB rows keep working.
#   true            -> flips UPLOADS_ALLOW_UNSIGNED to false: anonymous access
#                      then requires a valid signature; logged-in users are
#                      unaffected. Safe to run any time, idempotent.
STRICT_UPLOADS="${STRICT_UPLOADS:-false}"

# =============================================================================
#  Migration – legacy "bep-*" naming → "se360-*"
#  The app was renamed to SE360: install/log directories, systemd units,
#  nginx configs and logrotate all moved from bep-* to se360-*. Idempotent:
#  every step only acts when the legacy artifact still exists.
# =============================================================================
LEGACY_APP_DIR="/opt/bep-se"
LEGACY_LOG_DIR="/var/log/bep-se"

if [[ "$APP_DIR" != "$LEGACY_APP_DIR" && -d "$LEGACY_APP_DIR" ]]; then
  if [[ -d "$APP_DIR" ]]; then
    warn "Both ${LEGACY_APP_DIR} and ${APP_DIR} exist — leaving the legacy directory untouched"
  else
    mv "$LEGACY_APP_DIR" "$APP_DIR"
    ok "Moved ${LEGACY_APP_DIR} → ${APP_DIR}"
  fi
fi
if [[ "$LOG_DIR" != "$LEGACY_LOG_DIR" && -d "$LEGACY_LOG_DIR" && ! -d "$LOG_DIR" ]]; then
  mv "$LEGACY_LOG_DIR" "$LOG_DIR"
  ok "Moved ${LEGACY_LOG_DIR} → ${LOG_DIR}"
fi

if systemctl list-unit-files bep-backend.service &>/dev/null; then
  systemctl stop    bep-frontend bep-backend 2>/dev/null || true
  systemctl disable bep-frontend bep-backend 2>/dev/null || true
  rm -f /etc/systemd/system/bep-backend.service /etc/systemd/system/bep-frontend.service
  systemctl daemon-reload
  ok "Retired legacy bep-backend / bep-frontend services"
fi

for _legacy_file in \
  /etc/nginx/sites-enabled/bep-se       /etc/nginx/sites-available/bep-se \
  /etc/nginx/sites-enabled/bep-se-http  /etc/nginx/sites-available/bep-se-http \
  /etc/nginx/conf.d/bep-hardening.conf  /etc/logrotate.d/bep-se
do
  if [[ -e "$_legacy_file" ]]; then
    rm -f "$_legacy_file"
    ok "Removed legacy config ${_legacy_file}"
  fi
done
unset _legacy_file LEGACY_APP_DIR LEGACY_LOG_DIR

[[ -d "$APP_DIR/backend" ]] || die "App directory not found: ${APP_DIR}"

# =============================================================================
#  Fix 0 – Node.js runtime (Next 16 requires >= 20.9, we target Active LTS 24)
# =============================================================================
step "Checking Node.js runtime"
INSTALLED_NODE_MAJOR=0
if command -v node &>/dev/null; then
  INSTALLED_NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
fi

if [[ "$INSTALLED_NODE_MAJOR" -lt "$NODE_MAJOR" ]]; then
  warn "Node ${INSTALLED_NODE_MAJOR} installed – upgrading to Node ${NODE_MAJOR}.x (NodeSource)"
  export DEBIAN_FRONTEND=noninteractive
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
  # node_modules built against the old ABI must be rebuilt from scratch
  rm -rf "${APP_DIR}/backend/node_modules" "${APP_DIR}/frontend/node_modules" "${APP_DIR}/frontend/.next"
  ok "Node upgraded – node_modules cleared for a clean reinstall"
fi
ok "Node $(node --version)  /  npm $(npm --version)"

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
#  Fix 2 – Nginx: ensure se360 site is enabled, not the default
# =============================================================================
step "Checking nginx configuration"

CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
HAS_CERT=false
[[ -f "${CERT_DIR}/fullchain.pem" && -f "${CERT_DIR}/privkey.pem" ]] && HAS_CERT=true

# Remove stale default and stale se360-http links
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/certbot

# http{}-level directives. limit_req_zone cannot live inside a server{} block.
cat > /etc/nginx/conf.d/se360-hardening.conf <<'NGINX'
# Generated by redeploy.sh — global hardening for the SE360 vhosts.
server_tokens off;
limit_req_zone $binary_remote_addr zone=se360_auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=se360_api:10m  rate=20r/s;
limit_req_status 429;
limit_conn_zone $binary_remote_addr zone=se360_conn:10m;
NGINX
ok "nginx hardening conf written (server_tokens off, auth/api rate limits)"

if [[ "$HAS_CERT" == "false" ]]; then
  warn "No SSL cert found – writing HTTP-only config so the site works on port 80"
  warn "After DNS is pointed here, run certbot then re-run this script for HTTPS"

  cat > /etc/nginx/sites-available/se360-http << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    client_max_body_size 10M;
    limit_conn se360_conn 40;

    # /.well-known excluded: regex locations outrank the acme-challenge prefix.
    location ~ /\.(?!well-known) { deny all; access_log off; log_not_found off; }

    location /api/auth/ {
        limit_req          zone=se360_auth burst=20 nodelay;
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /api/uploads/ {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/uploads/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        add_header X-Content-Type-Options  "nosniff"                     always;
        add_header Content-Security-Policy "default-src 'none'; sandbox" always;
        add_header X-Frame-Options         "DENY"                        always;
        add_header Cross-Origin-Resource-Policy "same-origin"            always;
    }

    location /api/ {
        limit_req          zone=se360_api burst=60 nodelay;
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

  rm -f /etc/nginx/sites-enabled/se360
  ln -sf /etc/nginx/sites-available/se360-http /etc/nginx/sites-enabled/se360-http

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

  cat > /etc/nginx/sites-available/se360 << NGINX
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
    # 0 on purpose: the legacy XSS auditor is itself exploitable and browsers
    # ignore it. CSP (set by Next.js) is the real defence.
    add_header X-XSS-Protection "0" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 10M;
    limit_conn se360_conn 40;
    gzip on; gzip_vary on; gzip_proxied any; gzip_comp_level 6;
    gzip_types application/json application/javascript text/css text/plain;

    # /.well-known excluded: regex locations outrank the acme-challenge prefix.
    location ~ /\.(?!well-known) { deny all; access_log off; log_not_found off; }

    location /api/auth/ {
        limit_req          zone=se360_auth burst=20 nodelay;
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/auth/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_buffering    off;
    }

    location /api/uploads/ {
        proxy_pass         http://127.0.0.1:${BACKEND_PORT}/api/uploads/;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        add_header X-Content-Type-Options  "nosniff"                     always;
        add_header Content-Security-Policy "default-src 'none'; sandbox" always;
        add_header X-Frame-Options         "DENY"                        always;
        add_header Cross-Origin-Resource-Policy "same-origin"            always;
        add_header Cache-Control           "private, max-age=300"        always;
    }

    location /api/ {
        limit_req          zone=se360_api burst=60 nodelay;
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

  rm -f /etc/nginx/sites-enabled/se360-http
  ln -sf /etc/nginx/sites-available/se360 /etc/nginx/sites-enabled/se360
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
chmod 750 "$LOG_DIR" "${APP_DIR}/backend/uploads"

# Log rotation (matches deploy.sh). Rewritten every run: the rename migration
# removes /etc/logrotate.d/bep-se, and this keeps rotation active either way.
cat > /etc/logrotate.d/se360 <<LOGROTATE
${LOG_DIR}/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ${APP_USER} ${APP_USER}
    sharedscripts
    postrotate
        systemctl kill --signal=USR1 se360-backend  2>/dev/null || true
        systemctl kill --signal=USR1 se360-frontend 2>/dev/null || true
    endscript
}
LOGROTATE
ok "Log rotation configured (/etc/logrotate.d/se360)"

# =============================================================================
#  Create systemd units if missing
# =============================================================================
create_services() {
  step "Creating systemd service units"
  cat > /etc/systemd/system/se360-backend.service << UNIT
[Unit]
Description=SE360 – Backend (NestJS)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node dist/main.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
StandardOutput=append:${LOG_DIR}/backend.log
StandardError=append:${LOG_DIR}/backend-error.log
SyslogIdentifier=se360-backend
EnvironmentFile=${APP_DIR}/backend/.env
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectProc=invisible
ProtectHostname=true
ProtectClock=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictNamespaces=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
RestrictSUIDSGID=true
SystemCallArchitectures=native
LockPersonality=true
UMask=0077
CapabilityBoundingSet=
AmbientCapabilities=
ReadWritePaths=${APP_DIR}/backend/uploads ${LOG_DIR}

[Install]
WantedBy=multi-user.target
UNIT

  cat > /etc/systemd/system/se360-frontend.service << UNIT
[Unit]
Description=SE360 – Frontend (Next.js)
After=network-online.target se360-backend.service
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/frontend
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start --port ${FRONTEND_PORT}
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=10
StandardOutput=append:${LOG_DIR}/frontend.log
StandardError=append:${LOG_DIR}/frontend-error.log
SyslogIdentifier=se360-frontend
EnvironmentFile=${APP_DIR}/frontend/.env.local
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectProc=invisible
ProtectHostname=true
ProtectClock=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictNamespaces=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
RestrictSUIDSGID=true
SystemCallArchitectures=native
LockPersonality=true
UMask=0077
CapabilityBoundingSet=
AmbientCapabilities=
ReadWritePaths=${APP_DIR}/frontend/.next ${LOG_DIR}

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable se360-backend se360-frontend
  ok "Services created and enabled"
}

systemctl list-unit-files se360-backend.service &>/dev/null && \
  systemctl list-unit-files se360-frontend.service &>/dev/null || create_services

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
#  Ensure backend env has the keys newer app versions expect
# =============================================================================
step "Reconciling backend environment file"
BACKEND_ENV_FILE="${APP_DIR}/backend/.env"
[[ -f "$BACKEND_ENV_FILE" ]] || die "Missing backend env file: ${BACKEND_ENV_FILE}"

CORS_ORIGIN_VALUE="$(grep -E '^CORS_ORIGIN=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
DEFAULT_WEBAUTHN_ORIGIN="${CORS_ORIGIN_VALUE:-https://${DOMAIN}}"

# Appends "KEY=value" only when KEY is not already present.
ensure_env() {
  local key="$1" value="$2"
  if ! grep -q "^${key}=" "$BACKEND_ENV_FILE"; then
    echo "${key}=${value}" >> "$BACKEND_ENV_FILE"
    ok "Added ${key}=${value}"
  fi
}

ensure_env WEBAUTHN_RP_ID   "${DOMAIN}"
ensure_env WEBAUTHN_RP_NAME "SE360"
ensure_env WEBAUTHN_ORIGIN  "${DEFAULT_WEBAUTHN_ORIGIN}"

# Without TRUST_PROXY the backend ignores X-Forwarded-For, so every request
# looks like it came from nginx (127.0.0.1): the login throttle becomes a single
# shared bucket for all visitors and audit logs record the wrong IP.
ensure_env TRUST_PROXY "1"

# Session cookie Secure flag. In production behind TLS, cookies should only be
# sent over HTTPS. The backend auto-enables this when APP_ENV=production, but
# an explicit value removes any ambiguity.
ensure_env COOKIE_SECURE "true"

# Path to the CA certificate file (relative to backend/). Required when
# DB_SSL=true and the DB provider uses a self-signed CA (e.g. DigitalOcean).
ensure_env DB_CA_CERT "ca-certificate.crt"

# Session length: the app moved to 24-hour refresh tokens (was 7d). Existing
# env files still carry JWT_REFRESH_EXPIRES_IN=7d, which would override the new
# default baked into the code, so rewrite it in place.
if grep -qE '^JWT_REFRESH_EXPIRES_IN=7d$' "$BACKEND_ENV_FILE"; then
  sed -i 's|^JWT_REFRESH_EXPIRES_IN=.*|JWT_REFRESH_EXPIRES_IN=24h|' "$BACKEND_ENV_FILE"
  ok "Updated JWT_REFRESH_EXPIRES_IN 7d → 24h (24-hour sessions)"
fi

# DB_SSL_REJECT_UNAUTHORIZED must be explicitly set. The backend defaults to
# 'true' (secure by default) when this key is absent, which breaks connections
# to managed DBs using self-signed CAs. 'false' is correct for DigitalOcean
# managed PostgreSQL.
if grep -q '^DB_SSL=true' "$BACKEND_ENV_FILE" && \
   ! grep -q '^DB_SSL_REJECT_UNAUTHORIZED=' "$BACKEND_ENV_FILE"; then
  echo 'DB_SSL_REJECT_UNAUTHORIZED=false' >> "$BACKEND_ENV_FILE"
  ok "Added DB_SSL_REJECT_UNAUTHORIZED=false (required for managed DB with SSL)"
fi

# Read only by 'npm run seed', and only when admin@bep.org does not exist yet.
# SEED_ADMIN_PASSWORD is REQUIRED — seed.ts exits with an error if it is missing
# or still a placeholder value.
if ! grep -q '^SEED_ADMIN_PASSWORD=' "$BACKEND_ENV_FILE"; then
  ensure_env SEED_ADMIN_PASSWORD "$(openssl rand -base64 18 | tr -d '/+=')Aa1"
fi
# Reject placeholder passwords that shipped in older .env files
_seed_val="$(grep -E '^SEED_ADMIN_PASSWORD=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
if [[ -n "$_seed_val" && ("$_seed_val" == *CHANGE_ME* || "$_seed_val" == *change-in-production* || "$_seed_val" == *placeholder*) ]]; then
  _new_seed="$(openssl rand -base64 18 | tr -d '/+=')Aa1"
  sed -i "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=${_new_seed}|" "$BACKEND_ENV_FILE"
  warn "SEED_ADMIN_PASSWORD was a placeholder – auto-generated a new one"
fi
unset _seed_val _new_seed

# ── Signed upload URLs (/api/uploads) ────────────────────────────────────────
# Newer backends serve locally-stored uploads through HMAC-signed, expiring
# URLs. UPLOAD_URL_SECRET is deliberately independent of JWT_SECRET so rotating
# one never invalidates the other's artifacts.
ensure_env UPLOAD_URL_SECRET "$(openssl rand -hex 64)"
ensure_env UPLOAD_URL_TTL_SECONDS "2592000"   # 30 days

# UPLOADS_ALLOW_UNSIGNED controls the legacy grace window:
#   true  -> unsigned URLs (uploaded before signing existed) are still served,
#            so existing DB rows keep rendering. Safe upgrade default.
#   false -> anonymous access requires a valid signature. Logged-in users are
#            unaffected either way (their requests carry the session cookie),
#            so flipping to false never breaks the admin UI.
if grep -q '^UPLOADS_ALLOW_UNSIGNED=' "$BACKEND_ENV_FILE"; then
  if [[ "$STRICT_UPLOADS" == "true" ]]; then
    sed -i 's|^UPLOADS_ALLOW_UNSIGNED=.*|UPLOADS_ALLOW_UNSIGNED=false|' "$BACKEND_ENV_FILE"
    ok "Strict uploads enabled: anonymous access now requires signed URLs"
    ok "  (logged-in users unaffected; re-run without STRICT_UPLOADS=true to keep this setting)"
  else
    info "UPLOADS_ALLOW_UNSIGNED=$(grep -E '^UPLOADS_ALLOW_UNSIGNED=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2) (enforce signed-only later with: sudo STRICT_UPLOADS=true bash redeploy.sh)"
  fi
elif [[ "$STRICT_UPLOADS" == "true" ]]; then
  ensure_env UPLOADS_ALLOW_UNSIGNED "false"
  ok "Strict uploads enabled from the start"
else
  ensure_env UPLOADS_ALLOW_UNSIGNED "true"
  warn "Upload signing added in permissive mode (legacy unsigned URLs still work)."
  warn "Once comfortable, enforce signed-only access: sudo STRICT_UPLOADS=true bash redeploy.sh"
fi

chmod 600 "$BACKEND_ENV_FILE"
chown "$APP_USER":"$APP_USER" "$BACKEND_ENV_FILE"

# Refuse to (re)start with a guessable signing key.
for _k in JWT_SECRET JWT_REFRESH_SECRET; do
  _val="$(grep -E "^${_k}=" "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
  [[ -n "$_val" ]] || die "${_k} is missing from ${BACKEND_ENV_FILE}"
  if [[ ${#_val} -lt 32 || "$_val" == *CHANGE_ME* || "$_val" == *change-in-production* ]]; then
    die "${_k} is a placeholder or shorter than 32 chars. Replace it (openssl rand -hex 64) and re-run."
  fi
done
unset _k _val

# SEED_ADMIN_PASSWORD is required by seed.ts — it exits if missing or placeholder.
_seed_pw="$(grep -E '^SEED_ADMIN_PASSWORD=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2- || true)"
[[ -n "$_seed_pw" ]] || die "SEED_ADMIN_PASSWORD is missing from ${BACKEND_ENV_FILE}"
if [[ "$_seed_pw" == *CHANGE_ME* || "$_seed_pw" == *change-in-production* || "$_seed_pw" == *placeholder* ]]; then
  die "SEED_ADMIN_PASSWORD is a placeholder. Generate a real one: openssl rand -base64 18"
fi
unset _seed_pw

ok "Backend env reconciled and secrets validated"

# =============================================================================
#  Legacy upload sweep
# =============================================================================
# Uploads used to keep the client-supplied file extension while only checking
# the (spoofable) MIME type, so an .html/.svg payload could be stored and then
# served from the API origin. New uploads get a server-chosen extension; any
# pre-existing risky file is only reported here, never deleted automatically.
UPLOAD_DIR="${APP_DIR}/backend/uploads"
if [[ -d "$UPLOAD_DIR" ]]; then
  RISKY=$(find "$UPLOAD_DIR" -type f \
    \( -iname '*.html' -o -iname '*.htm' -o -iname '*.svg' -o -iname '*.xhtml' \
       -o -iname '*.js' -o -iname '*.php' -o -iname '*.sh' \) 2>/dev/null || true)
  if [[ -n "$RISKY" ]]; then
    warn "Uploads containing potentially executable file types were found:"
    printf '%s\n' "$RISKY" | sed 's/^/        /'
    warn "Review them and delete anything unexpected:  rm <path>"
  else
    ok "No risky files in ${UPLOAD_DIR}"
  fi
fi

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

# =============================================================================
#  Database schema sync
# =============================================================================
# APP_ENV=production disables TypeORM 'synchronize', so new entity columns and
# tables (academic_year, dc_student_performance, …) never reach this database
# by themselves and the backend would 500 on first use. schema-sync applies the
# additive DDL only and reports anything that needs a hand-written migration.
# Runs BEFORE the service restart so the new code never sees the old schema.
step "Synchronising database schema"
set +e
sudo -u "$APP_USER" bash -c "cd ${APP_DIR}/backend && node dist/schema-sync.js"
SCHEMA_RC=$?
set -e
case "$SCHEMA_RC" in
  0) ok "Database schema up to date" ;;
  2) warn "Schema synced, but some changes need a manual migration (listed above)." ;;
  *) die "Schema sync failed (exit ${SCHEMA_RC}). Database left untouched — fix it and re-run." ;;
esac

# =============================================================================
#  Seed roles and permissions
# =============================================================================
# seedDefaultRoles() only ever ADDS missing permission rows, so releases that
# introduce a new permission module (school-monitoring, activity-logs,
# data-collection-edit, …) need this or admins cannot grant them. Existing
# roles keep their configuration and admin@bep.org is left alone if it exists.
step "Seeding roles and permissions"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR}/backend && node dist/seed.js"
ok "Roles and permissions reconciled"

systemctl restart se360-backend
sleep 4
if systemctl is-active --quiet se360-backend; then
  ok "se360-backend running"
else
  warn "se360-backend failed. Last 30 lines:"
  journalctl -u se360-backend -n 30 --no-pager
  exit 1
fi

# =============================================================================
#  Build frontend  (NODE_OPTIONS caps heap to avoid OOM on small droplets)
# =============================================================================
step "Rebuilding frontend"
# .next is discarded every time: a cache written by a different Next.js major
# (the app moved 14 → 16) makes the build fail or serve stale chunks.
sudo -u "$APP_USER" bash -c "
  set -e
  export NODE_OPTIONS='--max-old-space-size=1536'
  cd ${APP_DIR}/frontend
  rm -rf .next
  npm ci --prefer-offline
  npm run build
"
ok "Frontend built"

systemctl restart se360-frontend
sleep 4
if systemctl is-active --quiet se360-frontend; then
  ok "se360-frontend running"
else
  warn "se360-frontend failed. Last 30 lines:"
  journalctl -u se360-frontend -n 30 --no-pager
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
echo ""
echo -e "  ${BOLD}Security posture applied${NC}:"
echo -e "    · TRUST_PROXY set — login throttling and audit logs now see the real client IP"
echo -e "    · nginx: server_tokens off, /api/auth/ 10 req/min per IP, dotfiles denied"
echo -e "    · nginx: /api/uploads/ served with nosniff + 'default-src none; sandbox' CSP"
echo -e "    · JWT secrets validated (>= 32 chars, no placeholders)"
echo -e "    · Cookie sessions (httpOnly se360_at/se360_rt) — no tokens in localStorage"
UPLOAD_MODE="$(grep -E '^UPLOADS_ALLOW_UNSIGNED=' "$BACKEND_ENV_FILE" | tail -n 1 | cut -d'=' -f2 || true)"
if [[ "$UPLOAD_MODE" == "false" ]]; then
  echo -e "    · Uploads: signed, expiring URLs; anonymous access requires a signature"
else
  echo -e "    · Uploads: signing active in permissive mode — enforce with:"
  echo -e "        sudo STRICT_UPLOADS=true bash redeploy.sh"
fi
echo ""
echo -e "  ${BOLD}Database${NC}: additive schema changes applied and roles/permissions re-seeded."
echo -e "    Re-run manually with:"
echo -e "      cd ${APP_DIR}/backend && sudo -u ${APP_USER} npm run schema:check"
echo -e "      cd ${APP_DIR}/backend && sudo -u ${APP_USER} npm run seed:prod"
if [[ "$HAS_CERT" == "false" ]]; then
  echo ""
  echo -e "  ${YELLOW}To enable HTTPS, run:${NC}"
  echo -e "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} \\"
  echo -e "    --email YOUR_EMAIL --agree-tos --non-interactive"
  echo -e "  Then run:  sudo bash redeploy.sh"
fi
echo ""
