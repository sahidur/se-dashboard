#!/usr/bin/env bash
# =============================================================================
#  SE360 – One-Click DigitalOcean Deployment
#  Domain  : se.somadhanhobe.com
#  OS      : Ubuntu 22.04 | 24.04 LTS  (Node 24 needs glibc >= 2.28)
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
APP_USER="${APP_USER:-se360}"       # Dedicated OS user for the app
APP_DIR="${APP_DIR:-/opt/se360}" # Installation directory
LOG_DIR="${LOG_DIR:-/var/log/se360}"
NODE_MAJOR="${NODE_MAJOR:-24}"    # Node.js Active LTS major version
BACKEND_PORT="${BACKEND_PORT:-4000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
SKIP_SSL="${SKIP_SSL:-false}"     # Set to 'true' to skip certbot (CI/testing)

# Number of trusted reverse-proxy hops in front of the API. This deployment
# always puts nginx in front, so 1 is correct. The backend ignores
# X-Forwarded-For unless this is set, which would make the login rate limiter
# bucket every visitor under nginx's 127.0.0.1 and record that as the audit IP.
TRUST_PROXY="${TRUST_PROXY:-1}"

# DB / S3 defaults (populated from current .env – override via env vars)
DB_HOST="${DB_HOST:-db-postgresql-ams-do-user-2226216-0.i.db.ondigitalocean.com}"
DB_PORT="${DB_PORT:-25060}"
DB_USERNAME="${DB_USERNAME:-bep_se_admin}"
DB_DATABASE="${DB_DATABASE:-bep_se}"
DB_SCHEMA="${DB_SCHEMA:-bep}"
DB_SSL="${DB_SSL:-true}"
DB_SSL_REJECT_UNAUTHORIZED="${DB_SSL_REJECT_UNAUTHORIZED:-false}"
# Path to the CA certificate file (relative to backend/). Required when
# DB_SSL=true and the DB provider uses a self-signed CA (e.g. DigitalOcean).
DB_CA_CERT="${DB_CA_CERT:-ca-certificate.crt}"
S3_ENDPOINT="${S3_ENDPOINT:-https://sgp1.digitaloceanspaces.com}"
S3_REGION="${S3_REGION:-sgp1}"
S3_BUCKET="${S3_BUCKET:-dev-shomadhanhobe-resources}"
S3_FOLDER="${S3_FOLDER:-bep-se}" # keep in sync with existing uploads folder in the bucket
S3_ACCESS_KEY="${S3_ACCESS_KEY:-}"
S3_SECRET_KEY="${S3_SECRET_KEY:-}"
WEBAUTHN_RP_ID="${WEBAUTHN_RP_ID:-${DOMAIN}}"
WEBAUTHN_RP_NAME="${WEBAUTHN_RP_NAME:-SE360}"
WEBAUTHN_ORIGIN="${WEBAUTHN_ORIGIN:-https://${DOMAIN}}"

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

# Reject the placeholder/short secrets that shipped in .env.example — a guessable
# signing key means anyone can mint an admin token.
for _s in JWT_SECRET JWT_REFRESH_SECRET; do
  _v="${!_s}"
  [[ ${#_v} -ge 32 ]] || die "${_s} must be at least 32 characters (got ${#_v}). Generate one with: openssl rand -hex 64"
  [[ "$_v" == *CHANGE_ME* || "$_v" == *change-in-production* ]] && die "${_s} is still a placeholder value. Set a real secret."
done
unset _s _v
ok "JWT secrets validated"

# Password used by `npm run seed` for the initial admin@bep.org account. Must
# satisfy the app's policy: 8+ chars with an upper, a lower and a digit.
if [[ -z "${SEED_ADMIN_PASSWORD:-}" ]]; then
  SEED_ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=')Aa1"
  warn "Auto-generated SEED_ADMIN_PASSWORD – save this in a password manager!"
  warn "  SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}"
  warn "  (used only by 'npm run seed' when admin@bep.org does not exist yet)"
fi

# Secret used to HMAC-sign locally-stored upload URLs (/api/uploads/...).
# Deliberately independent of JWT_SECRET so rotating one never invalidates the
# other's artifacts. Only relevant while S3 credentials are unset (local mode).
if [[ -z "${UPLOAD_URL_SECRET:-}" ]]; then
  UPLOAD_URL_SECRET=$(openssl rand -hex 64)
  warn "Auto-generated UPLOAD_URL_SECRET – save this in a password manager!"
  warn "  UPLOAD_URL_SECRET=${UPLOAD_URL_SECRET}"
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
  info "Node ${INSTALLED_NODE_MAJOR:-none} found – installing Node ${NODE_MAJOR}.x from NodeSource"
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
    chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
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
      "       rsync -av --exclude node_modules --exclude .next ./SE360/ root@<droplet-ip>:${APP_DIR}/"
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
# Trust the nginx reverse proxy in front of us so rate limiting and audit logs
# see the real client IP instead of 127.0.0.1.
TRUST_PROXY=${TRUST_PROXY}
# Session cookie Secure flag. In production behind TLS, cookies should only be
# sent over HTTPS. The backend auto-enables this when APP_ENV=production, but
# an explicit value removes any ambiguity.
COOKIE_SECURE=true
# ── Database (DigitalOcean Managed PostgreSQL) ───────────────────────────────
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=${DB_DATABASE}
DB_SCHEMA=${DB_SCHEMA}
DB_SSL=${DB_SSL}
# Secure by default: TLS without certificate validation is still MITM-able.
# DigitalOcean managed DBs need this set to false (their CA is not in the
# default trust store). Set to true only when your host trusts the DB CA.
DB_SSL_REJECT_UNAUTHORIZED=${DB_SSL_REJECT_UNAUTHORIZED}
# Path to the CA certificate file (relative to backend/). Required when
# DB_SSL=true and the DB provider uses a self-signed CA.
DB_CA_CERT=${DB_CA_CERT}

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=6h
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
# ── Signed upload URLs (/api/uploads) ────────────────────────────────────────
# Locally stored files are served via HMAC-signed, expiring URLs. A fresh
# install has no pre-signing uploads, so strict mode is on from day one:
# anonymous access requires a valid signature; logged-in users are unaffected.
# Set UPLOADS_ALLOW_UNSIGNED=true here only if migrating an existing dataset.
UPLOAD_URL_SECRET=${UPLOAD_URL_SECRET}
UPLOAD_URL_TTL_SECONDS=2592000
UPLOADS_ALLOW_UNSIGNED=${UPLOADS_ALLOW_UNSIGNED:-false}
# ── Seeding ───────────────────────────────────────────────────────
# Only read by 'npm run seed' when admin@bep.org does not already exist.
SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}
# ── WebAuthn / Passkeys ──────────────────────────────────────────────────────
WEBAUTHN_RP_ID=${WEBAUTHN_RP_ID}
WEBAUTHN_RP_NAME=${WEBAUTHN_RP_NAME}
WEBAUTHN_ORIGIN=${WEBAUTHN_ORIGIN}
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
chmod 750 "${APP_DIR}/backend/uploads"

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
# Prune dev deps after build – keeps the production footprint small.
# NOTE: this removes ts-node, so 'npm run seed' (ts-node) no longer works here.
# Use the compiled entrypoints instead: seed:prod / schema:sync.
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/backend
  npm prune --omit=dev 2>&1
"
ok "Backend built  →  dist/"

# =============================================================================
#  Step 6b – Database schema sync
# =============================================================================
# TypeORM 'synchronize' is off when APP_ENV=production, so entity changes never
# reach this database on their own. schema-sync applies the additive DDL (new
# tables/columns/indexes) and refuses to run anything destructive.
step "Synchronising database schema"
set +e
sudo -u "$APP_USER" bash -c "cd ${APP_DIR}/backend && node dist/schema-sync.js"
SCHEMA_RC=$?
set -e
case "$SCHEMA_RC" in
  0) ok "Database schema up to date" ;;
  2) warn "Schema synced, but some changes need a manual migration (listed above)." ;;
  *) die "Schema sync failed (exit ${SCHEMA_RC}). Fix the database before continuing." ;;
esac

# =============================================================================
#  Step 6c – Seed roles, permissions and the initial admin
# =============================================================================
# Idempotent: existing roles keep their configuration and only newly-added
# permission modules are appended; admin@bep.org is created only if missing.
step "Seeding roles, permissions and admin account"
sudo -u "$APP_USER" bash -c "cd ${APP_DIR}/backend && node dist/seed.js"
ok "Roles, permissions and admin account seeded"

step "Installing frontend dependencies"
sudo -u "$APP_USER" bash -c "
  set -e
  cd ${APP_DIR}/frontend
  npm ci --prefer-offline 2>&1
"
ok "Frontend npm ci done"

step "Building frontend (Next.js production build)"
# Next.js reads NEXT_PUBLIC_* at build time from the .env.local we wrote above.
# NODE_OPTIONS raises the heap: the Turbopack build needs well over the default
# on a small droplet. A stale .next from an older Next major breaks the build,
# so it is always discarded first.
sudo -u "$APP_USER" bash -c "
  set -e
  export NODE_OPTIONS='--max-old-space-size=1536'
  cd ${APP_DIR}/frontend
  rm -rf .next
  npm run build 2>&1
"
ok "Frontend built  →  .next/"

# =============================================================================
#  Step 7 – systemd service: se360-backend
# =============================================================================
step "Creating systemd service: se360-backend"

cat > /etc/systemd/system/se360-backend.service <<UNIT
[Unit]
Description=SE360 – Backend (NestJS)
Documentation=https://docs.nestjs.com
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

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

# Logging (journald + file)
StandardOutput=append:${LOG_DIR}/backend.log
StandardError=append:${LOG_DIR}/backend-error.log
SyslogIdentifier=se360-backend

# Load secrets from .env
EnvironmentFile=${APP_DIR}/backend/.env

# ── Hardening ───────────────────────────────────────────────────────────────
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectProc=invisible
ProtectHostname=true
ProtectClock=true
ReadWritePaths=${APP_DIR}/backend/uploads ${LOG_DIR}
# The service listens on :${BACKEND_PORT} behind nginx — no privileged port needed.
CapabilityBoundingSet=
AmbientCapabilities=
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictNamespaces=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
RestrictRealtime=true
RestrictSUIDSGID=true
SystemCallArchitectures=native
LockPersonality=true
# Uploaded files and logs are readable only by the app user.
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT

ok "se360-backend.service written"

# =============================================================================
#  Step 8 – systemd service: se360-frontend
# =============================================================================
step "Creating systemd service: se360-frontend"

cat > /etc/systemd/system/se360-frontend.service <<UNIT
[Unit]
Description=SE360 – Frontend (Next.js)
Documentation=https://nextjs.org
After=network-online.target se360-backend.service
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=5

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

# Logging
StandardOutput=append:${LOG_DIR}/frontend.log
StandardError=append:${LOG_DIR}/frontend-error.log
SyslogIdentifier=se360-frontend

# Runtime env (NEXT_PUBLIC_* already baked in at build time)
EnvironmentFile=${APP_DIR}/frontend/.env.local
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}

# ── Hardening ───────────────────────────────────────────────────────────────
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectProc=invisible
ProtectHostname=true
ProtectClock=true
ReadWritePaths=${APP_DIR}/frontend/.next ${LOG_DIR}
CapabilityBoundingSet=
AmbientCapabilities=
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictNamespaces=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
RestrictRealtime=true
RestrictSUIDSGID=true
SystemCallArchitectures=native
LockPersonality=true
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT

ok "se360-frontend.service written"

systemctl daemon-reload
systemctl enable se360-backend se360-frontend
ok "Services enabled for auto-start on reboot"

# =============================================================================
#  Step 9 – Nginx: HTTP-only config (used by certbot challenge)
# =============================================================================
step "Configuring Nginx (initial HTTP config)"

rm -f /etc/nginx/sites-enabled/default

# http{}-level directives. limit_req_zone can only live here, not in a server{}.
cat > /etc/nginx/conf.d/se360-hardening.conf <<'NGINX'
# Generated by deploy.sh — global hardening for the SE360 vhosts.

# Don't advertise the nginx version in responses and error pages.
server_tokens off;

# Brute-force throttles, keyed on the client IP. These sit in front of the
# app's own @Throttle guards as a second layer that also protects the box from
# the request volume itself.
limit_req_zone $binary_remote_addr zone=se360_auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=se360_api:10m  rate=20r/s;
limit_req_status 429;
limit_conn_zone $binary_remote_addr zone=se360_conn:10m;
NGINX

cat > /etc/nginx/sites-available/se360-http <<NGINX
# Temporary HTTP-only vhost used during Let's Encrypt certificate issuance.
# After SSL is obtained this file is replaced by se360 (HTTPS).
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # ACME challenge for certbot webroot plugin
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'SE360 – obtaining SSL certificate…';
        add_header Content-Type text/plain;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/se360-http /etc/nginx/sites-enabled/se360-http

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

cat > /etc/nginx/sites-available/se360 <<NGINX
# =============================================================================
#  SE360 – Nginx reverse proxy
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
    # Explicitly disabled: the legacy auditor is itself exploitable and is
    # ignored by every current browser. CSP is the real defence (set by Next.js).
    add_header X-XSS-Protection           "0"                                             always;
    add_header Referrer-Policy            "strict-origin-when-cross-origin"               always;
    add_header Permissions-Policy         "camera=(), microphone=(), geolocation=()"      always;

    # Cap concurrent connections per IP (slowloris / scraping)
    limit_conn se360_conn 40;

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

    # ── Never serve dotfiles (.env, .git, editor backups) ─────────────────────
    # Regex locations outrank prefix ones, so /.well-known must be excluded
    # explicitly or certbot renewals would start returning 403.
    location ~ /\.(?!well-known) {
        deny all;
        access_log off;
        log_not_found off;
    }

    # ── Auth endpoints: strict brute-force throttle ───────────────────────────
    # Longest-prefix match wins, so this takes precedence over /api/ below.
    location /api/auth/ {
        limit_req           zone=se360_auth burst=20 nodelay;

        proxy_pass          http://127.0.0.1:${BACKEND_PORT}/api/auth/;
        proxy_http_version  1.1;
        proxy_set_header    Host               \$host;
        proxy_set_header    X-Real-IP          \$remote_addr;
        proxy_set_header    X-Forwarded-For    \$proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto  \$scheme;
        proxy_read_timeout  60s;
        proxy_buffering     off;
    }

    # ── User-uploaded files ───────────────────────────────────────────────────
    # Served from the same origin as the app, so they get their own locked-down
    # header set (the backend sets these too; add_header in a location block
    # discards the server-level ones, hence the repetition).
    location /api/uploads/ {
        proxy_pass          http://127.0.0.1:${BACKEND_PORT}/api/uploads/;
        proxy_http_version  1.1;
        proxy_set_header    Host               \$host;
        proxy_set_header    X-Forwarded-Proto  \$scheme;

        add_header X-Content-Type-Options    "nosniff"                           always;
        add_header Content-Security-Policy   "default-src 'none'; sandbox"       always;
        add_header X-Frame-Options           "DENY"                              always;
        add_header Cross-Origin-Resource-Policy "same-origin"                    always;
        add_header Cache-Control             "private, max-age=300"              always;
    }

    # ── Backend API (NestJS on :${BACKEND_PORT}) ──────────────────────────────
    location /api/ {
        limit_req           zone=se360_api burst=60 nodelay;

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
rm -f /etc/nginx/sites-enabled/se360-http
ln -sf /etc/nginx/sites-available/se360 /etc/nginx/sites-enabled/se360

if [[ "$SKIP_SSL" == "true" ]]; then
  # Comment out TLS lines so nginx can start without the cert files
  sed -i 's|^\(    ssl_\)|    # \1|g; s|^\(    include /etc/\)|    # \1|g' \
      /etc/nginx/sites-available/se360
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
        # Signal both services to re-open log files
        systemctl kill --signal=USR1 se360-backend  2>/dev/null || true
        systemctl kill --signal=USR1 se360-frontend 2>/dev/null || true
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
# 'limit' rate-limits repeated SSH connection attempts from the same IP
ufw limit ssh        comment 'SSH (rate-limited)'
ufw allow 80/tcp     comment 'HTTP (certbot + redirect)'
ufw allow 443/tcp    comment 'HTTPS'
# Backend and frontend ports are NOT opened – nginx proxies them internally
ufw --force enable
ok "ufw active:  limit 22, allow 80/443 | deny everything else"

# =============================================================================
#  Step 15 – Start application services
# =============================================================================
step "Starting application services"

systemctl restart se360-backend
sleep 4
systemctl restart se360-frontend
sleep 4

if systemctl is-active --quiet se360-backend; then
  ok "se360-backend  is running"
else
  warn "se360-backend did not start. Check: journalctl -u se360-backend -n 50"
fi

if systemctl is-active --quiet se360-frontend; then
  ok "se360-frontend is running"
else
  warn "se360-frontend did not start. Check: journalctl -u se360-frontend -n 50"
fi

# =============================================================================
#  Done ✓
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  SE360 deployed successfully!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Application URL${NC}  :  https://${DOMAIN}"
echo -e "  ${BOLD}API base URL${NC}     :  https://${DOMAIN}/api"
echo ""
echo -e "  ${BOLD}Service commands${NC}:"
echo -e "    systemctl status  se360-backend se360-frontend"
echo -e "    systemctl restart se360-backend"
echo -e "    journalctl -u se360-backend  -f     # live backend logs"
echo -e "    journalctl -u se360-frontend -f     # live frontend logs"
echo ""
echo -e "  ${BOLD}Log files${NC}  :  ${LOG_DIR}/"
echo -e "  ${BOLD}App dir${NC}    :  ${APP_DIR}/"
echo ""
echo -e "  ${BOLD}SSL renewal${NC} : automatic via certbot.timer"
echo -e "    Test with:  certbot renew --dry-run"
echo ""
echo -e "  ${BOLD}Seeding${NC}: roles, permissions and admin@bep.org were seeded automatically."
echo -e "    Login: admin@bep.org"
echo -e "    ${YELLOW}The seed admin password was printed above during secret collection.${NC}"
echo -e "    ${YELLOW}Change this password immediately after the first login.${NC}"
echo ""
echo -e "  ${BOLD}Database maintenance${NC} (dev deps are pruned – use the compiled scripts):"
echo -e "    cd ${APP_DIR}/backend && sudo -u ${APP_USER} npm run schema:check   # dry run"
echo -e "    cd ${APP_DIR}/backend && sudo -u ${APP_USER} npm run schema:sync    # apply additive DDL"
echo -e "    cd ${APP_DIR}/backend && sudo -u ${APP_USER} npm run seed:prod      # re-seed roles/permissions"
echo ""
echo -e "  ${BOLD}Security notes${NC}:"
echo -e "    · TRUST_PROXY=${TRUST_PROXY} — required so login rate limiting and audit"
echo -e "      logs see the real client IP instead of nginx's 127.0.0.1."
echo -e "    · nginx throttles /api/auth/ to 10 req/min per IP (burst 20)."
echo -e "    * Sessions use httpOnly cookies (se360_at/se360_rt); tokens are never"
echo -e "      stored in browser localStorage."
echo -e "    * Uploads under /api/uploads/ require HMAC-signed URLs (30-day TTL)"
echo -e "      or an authenticated session, and are served with nosniff + a"
echo -e "      'default-src none; sandbox' CSP so they cannot execute."
echo -e "    · backend/.env is chmod 600 and owned by ${APP_USER}."
echo ""
if [[ "$SKIP_SSL" == "true" ]]; then
  warn "SSL was skipped. Run the following once your DNS is pointing here:"
  warn "  certbot certonly --webroot -w /var/www/certbot -d ${DOMAIN} \\"
  warn "    --email ${SSL_EMAIL} --agree-tos --non-interactive"
  warn "  nginx -t && systemctl reload nginx"
fi
echo ""
