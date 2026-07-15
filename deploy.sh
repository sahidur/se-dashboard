#!/usr/bin/env bash
# =============================================================================
#  BEP Social Enterprise Platform – One-Click DigitalOcean Deployment
#  Domain  : se.somadhanhobe.com
#  OS      : Ubuntu 20.04 | 22.04 | 24.04 LTS
#  Run as  : sudo bash deploy.sh
#  Re-run  : safe – the script is fully idempotent
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()  { printf "${BLUE}  ·  ${NC}%s\n"      "$*"; }
ok()    { printf "${GREEN}  ✓  ${NC}%s\n"     "$*"; }
warn()  { printf "${YELLOW}  !  ${NC}%s\n"    "$*"; }
step()  { printf "\n${BOLD}${CYAN}━━━━  %s  ━━━━${NC}\n\n" "$*"; }
die()   { printf "${RED}  ✗  ERROR: %s${NC}\n" "$*" >&2; exit 1; }
ask()   { printf "${YELLOW}  ?  ${NC}%s: " "$1"; read -r  "${2?}"; }
askpw() { printf "${YELLOW}  ?  ${NC}%s: " "$1"; read -rs "${2?}"; echo; }

# ── Guard: must run as root ───────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run this script as root:  sudo bash deploy.sh"

# ── Guard: Ubuntu only ────────────────────────────────────────────────────────
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "ubuntu" ]] || die "This script targets Ubuntu (detected: $ID)."

# =============================================================================
#  ★  CONFIGURABLE SETTINGS
#  All values can be overridden by exporting environment variables before
#  running the script, e.g.:  REPO_URL=https://… sudo -E bash deploy.sh
# =============================================================================
DOMAIN="${DOMAIN:-se.somadhanhobe.com}"
REPO_URL="${REPO_URL:-}"          # Git HTTPS/SSH clone URL (optional)
APP_BRANCH="${APP_BRANCH:-main}"  # Git branch to deploy
APP_USER="${APP_USER:-bep}"       # Dedicated OS user for the app
APP_DIR="${APP_DIR:-/opt/bep-se}" # Installation directory
LOG_DIR="${LOG_DIR:-/var/log/bep-se}"
NODE_MAJOR="${NODE_MAJOR:-20}"    # Node.js LTS major version
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
SKIP_SSL="${SKIP_SSL:-false}"     # Set to 'true' to skip certbot (CI/testing)

# DB / S3 defaults (populated from current .env – override via env vars)
DB_HOST="${DB_HOST:-db-postgresql-ams-do-user-2226216-0.i.db.ondigitalocean.com}"
DB_PORT="${DB_PORT:-25060}"
DB_USERNAME="${DB_USERNAME:-bep_se_admin}"
DB_DATABASE="${DB_DATABASE:-bep_se}"
DB_SCHEMA="${DB_SCHEMA:-bep}"
DB_SSL="${DB_SSL:-true}"
DB_SSL_REJECT_UNAUTHORIZED="${DB_SSL_REJECT_UNAUTHORIZED:-false}"
S3_ENDPOINT="${S3_ENDPOINT:-https://sgp1.digitaloceanspaces.com}"
S3_REGION="${S3_REGION:-sgp1}"
S3_BUCKET="${S3_BUCKET:-dev-shomadhanhobe-resources}"
S3_FOLDER="${S3_FOLDER:-bep-se}"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"

# =============================================================================
#  Step 0 – Collect secrets interactively (skip if already exported)
# =============================================================================
step "Collecting required secrets"

if [[ -z "${SSL_EMAIL:-}" ]]; then
  ask "Email address for Let's Encrypt renewal notices" SSL_EMAIL
fi

if [[ -z "${DB_PASSWORD:-}" ]]; then
  askpw "DigitalOcean PostgreSQL password (DB_PASSWORD)" DB_PASSWORD
fi

if [[ -z "${JWT_SECRET:-}" ]]; then
  JWT_SECRET=$(openssl rand -hex 64)
  warn "Auto-generated JWT_SECRET – save this in a password manager!"
  warn "  JWT_SECRET=${JWT_SECRET}"
fi

if [[ -z "${JWT_REFRESH_SECRET:-}" ]]; then
  JWT_REFRESH_SECRET=$(openssl rand -hex 64)
  warn "Auto-generated JWT_REFRESH_SECRET – save this in a password manager!"
  warn "  JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}"
fi

# If no repo URL and code is not present, ask
if [[ -z "$REPO_URL" && ! -d "$APP_DIR/backend" ]]; then
  ask "Git repository URL (leave empty if you will upload files via rsync/scp)" REPO_URL
fi

# =============================================================================
#  Step 1 – System update & core packages
# =============================================================================
step "Updating system and installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade  -y -qq
apt-get install  -y -qq \
  curl wget git unzip build-essential \
  nginx \
  certbot python3-certbot-nginx \
  ufw \
  logrotate
ok "System packages ready"

# =============================================================================
#  Step 2 – Node.js (NodeSource LTS)
# =============================================================================
step "Installing Node.js ${NODE_MAJOR} LTS"
INSTALLED_NODE_MAJOR=0
if command -v node &>/dev/null; then
  INSTALLED_NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
fi

if [[ "$INSTALLED_NODE_MAJOR" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
ok "Node $(node --version)  /  npm $(npm --version)"

# =============================================================================
#  Step 3 – Application user & directories
# =============================================================================
step "Creating application user and directories"
if ! id "$APP_USER" &>/dev/null; then
  useradd --system \
          --shell /bin/false \
          --home-dir "$APP_DIR" \
          --create-home \
          "$APP_USER"
  ok "User '${APP_USER}' created"
else
  ok "User '${APP_USER}' already exists"
fi

mkdir -p "$APP_DIR" "$LOG_DIR" /var/www/certbot
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"
ok "Directories: ${APP_DIR}  ${LOG_DIR}"

# =============================================================================
#  Step 4 – Deploy application code
# =============================================================================
step "Deploying application code"

if [[ -n "$REPO_URL" ]]; then
  if [[ -d "$APP_DIR/.git" ]]; then
    info "Repository exists – pulling latest from origin/${APP_BRANCH}"
    sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/${APP_BRANCH}"
  else
    info "Cloning ${REPO_URL}"
    sudo -u "$APP_USER" git clone --branch "$APP_BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  ok "Code deployed from ${REPO_URL}@${APP_BRANCH}"
elif [[ -d "$APP_DIR/backend" && -d "$APP_DIR/frontend" ]]; then
  ok "Code already present at ${APP_DIR}"
else
  die "No code found at ${APP_DIR} and REPO_URL is not set.\n\n" \
      "Either:\n" \
      "  a) Set REPO_URL=https://github.com/your/repo.git and re-run, or\n" \
      "  b) Upload the project to ${APP_DIR} first:\n" \
      "       rsync -av --exclude node_modules --exclude .next ./BEP-SE/ root@<droplet-ip>:${APP_DIR}/"
fi

chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# =============================================================================
#  Step 5 – Write environment files
# =============================================================================
step "Writing environment files"

# ── backend/.env ─────────────────────────────────────────────────────────────
cat > "${APP_DIR}/backend/.env" <<ENV
# ── App ──────────────────────────────────────────────────────────────────────
APP_PORT=${BACKEND_PORT}
APP_ENV=production

# ── Database (DigitalOcean Managed PostgreSQL) ───────────────────────────────
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=${DB_DATABASE}
DB_SCHEMA=${DB_SCHEMA}
DB_SSL=${DB_SSL}
DB_SSL_REJECT_UNAUTHORIZED=${DB_SSL_REJECT_UNAUTHORIZED}

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d

# ── S3-Compatible Storage (DigitalOcean Spaces) ───────────────────────────────
S3_ENDPOINT=${S3_ENDPOINT}
S3_REGION=${S3_REGION}
S3_BUCKET=${S3_BUCKET}
S3_FOLDER=${S3_FOLDER}
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGIN=https://${DOMAIN}
ENV

chmod 600 "${APP_DIR}/backend/.env"
chown "$APP_USER":"$APP_USER" "${APP_DIR}/backend/.env"

# ── frontend/.env.local ───────────────────────────────────────────────────────
cat > "${APP_DIR}/frontend/.env.local" <<ENV
# NEXT_PUBLIC_* vars are embedded at build time.
NEXT_PUBLIC_API_URL=https://${DOMAIN}/api
ENV

chmod 600 "${APP_DIR}/frontend/.env.local"
chown "$APP_USER":"$APP_USER" "${APP_DIR}/frontend/.env.local"

ok "Environment files written and locked (chmod 600)"

# Ensure uploads directory exists inside backend
mkdir -p "${APP_DIR}/backend/uploads"
chown -R "$APP_USER":"$APP_USER" "${APP_DIR}/backend/uploads"

# =============================================================================
#  Step 6 – Install dependencies & build
# =============================================================================
step "Installing backend dependencies"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/backend
  npm ci --prefer-offline 2>&1
"
ok "Backend npm ci done"

step "Building backend (TypeScript → JavaScript)"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/backend
  npm run build 2>&1
"
# Prune dev deps after build – keeps the production footprint small
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/backend
  npm prune --omit=dev 2>&1
"
ok "Backend built  →  dist/"

step "Installing frontend dependencies"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/frontend
  npm ci --prefer-offline 2>&1
"
ok "Frontend npm ci done"

step "Building frontend (Next.js production build)"
# Next.js reads NEXT_PUBLIC_* at build time from the .env.local we wrote above.
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/frontend
  npm run build 2>&1
"
ok "Frontend built  →  .next/"

# =============================================================================
#  Step 7 – systemd service: bep-backend
# =============================================================================
step "Creating systemd service: bep-backend"

cat > /etc/systemd/system/bep-backend.service <<UNIT
[Unit]
Description=BEP SE – Backend (NestJS)
Documentation=https://docs.nestjs.com
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend

# Startup
ExecStart=/usr/bin/node dist/main.js
ExecReload=/bin/kill -HUP \$MAINPID

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=60

# Logging (journald + file)
StandardOutput=append:${LOG_DIR}/backend.log
StandardError=append:${LOG_DIR}/backend-error.log
SyslogIdentifier=bep-backend

# Load secrets from .env
EnvironmentFile=${APP_DIR}/backend/.env

# ── Hardening ───────────────────────────────────────────────────────────────
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/backend/uploads ${LOG_DIR}
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT

ok "bep-backend.service written"

# =============================================================================
#  Step 8 – systemd service: bep-frontend
# =============================================================================
step "Creating systemd service: bep-frontend"

cat > /etc/systemd/system/bep-frontend.service <<UNIT
[Unit]
Description=BEP SE – Frontend (Next.js)
Documentation=https://nextjs.org
After=network-online.target bep-backend.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/frontend

# Startup – invoke the Next.js binary directly via node
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start --port ${FRONTEND_PORT}
ExecReload=/bin/kill -HUP \$MAINPID

# Restart policy
Restart=on-failure
RestartSec=10
StartLimitBurst=5
StartLimitIntervalSec=60

# Logging
StandardOutput=append:${LOG_DIR}/frontend.log
StandardError=append:${LOG_DIR}/frontend-error.log
SyslogIdentifier=bep-frontend

# Runtime env (NEXT_PUBLIC_* already baked in at build time)
EnvironmentFile=${APP_DIR}/frontend/.env.local
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}

# ── Hardening ───────────────────────────────────────────────────────────────
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/frontend/.next ${LOG_DIR}
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT

ok "bep-frontend.service written"

systemctl daemon-reload
systemctl enable bep-backend bep-frontend
ok "Services enabled for auto-start on reboot"

# =============================================================================
#  Step 9 – Nginx: HTTP-only config (used by certbot challenge)
# =============================================================================
step "Configuring Nginx (initial HTTP config)"

rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/bep-se-http <<NGINX
# Temporary HTTP-only vhost used during Let's Encrypt certificate issuance.
# After SSL is obtained this file is replaced by bep-se (HTTPS).
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # ACME challenge for certbot webroot plugin
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'BEP SE – obtaining SSL certificate…';
        add_header Content-Type text/plain;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bep-se-http /etc/nginx/sites-enabled/bep-se-http

nginx -t
systemctl enable nginx
systemctl restart nginx
ok "Nginx HTTP vhost active"

# =============================================================================
#  Step 10 – SSL certificate (Let's Encrypt)
# =============================================================================
step "Obtaining SSL certificate"

if [[ "$SKIP_SSL" == "true" ]]; then
  warn "SKIP_SSL=true – skipping certbot. Run manually later:"
  warn "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} --email <email> --agree-tos --non-interactive"
else
  certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$SSL_EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring \
    -d "$DOMAIN"
  ok "SSL certificate issued for ${DOMAIN}"

  # Ensure dhparam file exists (required by the HTTPS nginx config)
  if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    info "Generating DH parameters (this takes ~30 s)…"
    openssl dhparam -out /etc/letsencrypt/ssl-dhparams.pem 2048 2>/dev/null
  fi

  # Download Certbot's recommended options-ssl-nginx.conf if missing
  if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    curl -fsSL \
      https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
      -o /etc/letsencrypt/options-ssl-nginx.conf
  fi
fi

# =============================================================================
#  Step 11 – Nginx: full HTTPS reverse-proxy config
# =============================================================================
step "Writing final Nginx HTTPS configuration"

cat > /etc/nginx/sites-available/bep-se <<NGINX
# =============================================================================
#  BEP SE – Nginx reverse proxy
#  Generated by deploy.sh  $(date -u '+%Y-%m-%d %H:%M UTC')
# =============================================================================

# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Allow ACME renewals through
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# ── HTTPS ─────────────────────────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    # ── TLS ──────────────────────────────────────────────────────────────────
    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Modern TLS settings (Mozilla Intermediate profile)
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling        on;
    ssl_stapling_verify on;
    resolver            1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout    5s;

    # ── Security headers (nginx layer; app also sets them) ────────────────────
    add_header Strict-Transport-Security  "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options            "DENY"                                          always;
    add_header X-Content-Type-Options     "nosniff"                                       always;
    add_header X-XSS-Protection           "1; mode=block"                                 always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin"               always;
    add_header Permissions-Policy         "camera=(), microphone=(), geolocation=()"      always;

    # ── Gzip ─────────────────────────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_min_length 256;
    gzip_types
        application/json
        application/javascript
        application/x-javascript
        text/css
        text/javascript
        text/plain
        text/xml
        image/svg+xml;

    # ── Request limits ────────────────────────────────────────────────────────
    client_max_body_size 10M;   # mirrors backend 10 MB upload guard
    client_body_timeout  30s;
    client_header_timeout 10s;
    keepalive_timeout    65s;
    send_timeout         30s;

    # ── Backend API (NestJS on :${BACKEND_PORT}) ──────────────────────────────
    location /api/ {
        proxy_pass          http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_http_version  1.1;

        # Required headers for NestJS / express
        proxy_set_header    Host               \$host;
        proxy_set_header    X-Real-IP          \$remote_addr;
        proxy_set_header    X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto  \$scheme;
        proxy_set_header    Upgrade            \$http_upgrade;
        proxy_set_header    Connection         "upgrade";

        proxy_read_timeout  120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout  120s;
        proxy_buffering     off;
        proxy_cache_bypass  \$http_upgrade;

        # Hide internal error details from clients
        proxy_intercept_errors off;
    }

    # ── Next.js immutable static assets (long-lived browser cache) ────────────
    location /_next/static/ {
        proxy_pass          http://127.0.0.1:${FRONTEND_PORT}/_next/static/;
        proxy_http_version  1.1;
        proxy_set_header    Host \$host;
        # These assets have unique hashes – safe to cache forever
        add_header          Cache-Control "public, max-age=31536000, immutable" always;
        access_log          off;
    }

    # ── Next.js image optimisation endpoint ───────────────────────────────────
    location /_next/image {
        proxy_pass          http://127.0.0.1:${FRONTEND_PORT}/_next/image;
        proxy_http_version  1.1;
        proxy_set_header    Host               \$host;
        proxy_set_header    X-Forwarded-Proto  \$scheme;
        proxy_set_header    X-Forwarded-For    \$proxy_add_x_forwarded_for;
    }

    # ── Frontend (Next.js SSR on :${FRONTEND_PORT}) ───────────────────────────
    location / {
        proxy_pass          http://127.0.0.1:${FRONTEND_PORT};
        proxy_http_version  1.1;

        proxy_set_header    Host               \$host;
        proxy_set_header    X-Real-IP          \$remote_addr;
        proxy_set_header    X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto  \$scheme;
        proxy_set_header    Upgrade            \$http_upgrade;
        proxy_set_header    Connection         "upgrade";

        proxy_read_timeout  60s;
        proxy_connect_timeout 10s;
        proxy_send_timeout  60s;
        proxy_cache_bypass  \$http_upgrade;
    }
}
NGINX

# Swap in the full HTTPS config
rm -f /etc/nginx/sites-enabled/bep-se-http
ln -sf /etc/nginx/sites-available/bep-se /etc/nginx/sites-enabled/bep-se

if [[ "$SKIP_SSL" == "true" ]]; then
  # Comment out TLS lines so nginx can start without the cert files
  sed -i 's|^\(    ssl_\)|    # \1|g; s|^\(    include /etc/\)|    # \1|g' \
      /etc/nginx/sites-available/bep-se
  warn "SSL lines commented out (SKIP_SSL=true). Uncomment after obtaining certs."
fi

nginx -t
systemctl reload nginx
ok "Nginx HTTPS config active"

# =============================================================================
#  Step 12 – Automatic certificate renewal (systemd timer)
# =============================================================================
step "Setting up automatic SSL renewal"

# certbot itself installs a systemd timer; verify it is enabled
systemctl enable  certbot.timer 2>/dev/null || true
systemctl start   certbot.timer 2>/dev/null || true

# Add a reload hook so nginx picks up renewed certs
RENEWAL_HOOK=/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
cat > "$RENEWAL_HOOK" <<'HOOK'
#!/bin/sh
nginx -t && systemctl reload nginx
HOOK
chmod +x "$RENEWAL_HOOK"
ok "certbot.timer active – certs auto-renew and nginx reloads on renewal"

# =============================================================================
#  Step 13 – Log rotation
# =============================================================================
step "Configuring log rotation"

cat > /etc/logrotate.d/bep-se <<LOGROTATE
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
        # Signal both services to re-open log files
        systemctl kill --signal=USR1 bep-backend  2>/dev/null || true
        systemctl kill --signal=USR1 bep-frontend 2>/dev/null || true
    endscript
}
LOGROTATE

ok "Log rotation configured (14-day rolling, daily, compressed)"

# =============================================================================
#  Step 14 – Firewall (ufw)
# =============================================================================
step "Configuring firewall"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp     comment 'HTTP (certbot + redirect)'
ufw allow 443/tcp    comment 'HTTPS'
# Backend and frontend ports are NOT opened – nginx proxies them internally
ufw --force enable
ok "ufw active:  allow 22, 80, 443 | deny everything else"

# =============================================================================
#  Step 15 – Start application services
# =============================================================================
step "Starting application services"

systemctl restart bep-backend
sleep 4
systemctl restart bep-frontend
sleep 4

if systemctl is-active --quiet bep-backend; then
  ok "bep-backend  is running"
else
  warn "bep-backend did not start. Check: journalctl -u bep-backend -n 50"
fi

if systemctl is-active --quiet bep-frontend; then
  ok "bep-frontend is running"
else
  warn "bep-frontend did not start. Check: journalctl -u bep-frontend -n 50"
fi

# =============================================================================
#  Done ✓
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  BEP SE deployed successfully!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Application URL${NC}  :  https://${DOMAIN}"
echo -e "  ${BOLD}API base URL${NC}     :  https://${DOMAIN}/api"
echo ""
echo -e "  ${BOLD}Service commands${NC}:"
echo -e "    systemctl status  bep-backend bep-frontend"
echo -e "    systemctl restart bep-backend"
echo -e "    journalctl -u bep-backend  -f     # live backend logs"
echo -e "    journalctl -u bep-frontend -f     # live frontend logs"
echo ""
echo -e "  ${BOLD}Log files${NC}  :  ${LOG_DIR}/"
echo -e "  ${BOLD}App dir${NC}    :  ${APP_DIR}/"
echo ""
echo -e "  ${BOLD}SSL renewal${NC} : automatic via certbot.timer"
echo -e "    Test with:  certbot renew --dry-run"
echo ""
if [[ "$SKIP_SSL" == "true" ]]; then
  warn "SSL was skipped. Run the following once your DNS is pointing here:"
  warn "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} \\"
  warn "    --email ${SSL_EMAIL} --agree-tos --non-interactive"
  warn "  nginx -t && systemctl reload nginx"
fi
echo ""
