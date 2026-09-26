#!/usr/bin/env bash
# install.sh — Pemasangan otomatis satu perintah untuk Ubuntu 24.04 / Debian 12 (root).
#
# Pemakaian:
#   sudo bash install.sh domain.com
#
# Yang dikerjakan: memasang Node.js, MariaDB dan Caddy; membuat database + user
# dengan sandi acak; mengisi .env; menjalankan aplikasi sebagai layanan systemd
# yang hidup otomatis saat server menyala; mengaktifkan HTTPS otomatis lewat
# Caddy. Aman dijalankan ulang — .env dan data yang sudah ada tidak ditimpa.
# Aplikasi terpasang di /opt/qr-nfc (lihat README bagian Instalasi).

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_DIR="/opt/qr-nfc"
SERVICE_NAME="qr-nfc"
SERVICE_USER="www-data"
NODE_MAJOR="22"

log()  { echo -e "\n\033[1;34m==>\033[0m $*"; }
die()  { echo -e "\033[1;31mGagal:\033[0m $*" >&2; exit 1; }

# --- Prasyarat dasar ---------------------------------------------------------

[ "$(id -u)" -eq 0 ] || die "Jalankan sebagai root, mis.: sudo bash install.sh domain.com"

DOMAIN="${1:-}"
[[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$ ]] \
  || die "Domain tidak valid. Contoh: sudo bash install.sh domain.com"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

log "Memeriksa prasyarat (curl, gnupg, rsync, openssl) ..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg rsync openssl

# --- Salin berkas aplikasi ke /opt/qr-nfc ------------------------------------
# Skrip ini biasanya dijalankan dari folder hasil unzip di lokasi lain (mis.
# /root/qr-nfc); disalin ke lokasi tetap agar systemd punya WorkingDirectory
# yang stabil. .env yang sudah ada di /opt/qr-nfc TIDAK pernah ditimpa.

log "Menyalin berkas aplikasi ke ${APP_DIR} ..."
mkdir -p "$APP_DIR"
if [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
  rsync -a --exclude 'node_modules' --exclude '.git' --exclude '.env' "$SCRIPT_DIR"/ "$APP_DIR"/
fi
cd "$APP_DIR"

# --- Node.js ------------------------------------------------------------------

if command -v node >/dev/null 2>&1 && [ "$(node -v | sed 's/^v//' | cut -d. -f1)" -ge 18 ]; then
  log "Node.js sudah terpasang: $(node -v)"
else
  log "Memasang Node.js ${NODE_MAJOR}.x lewat NodeSource ..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

# --- MariaDB --------------------------------------------------------------------

if command -v mysql >/dev/null 2>&1 || command -v mariadb >/dev/null 2>&1; then
  log "MariaDB/MySQL sudah terpasang."
else
  log "Memasang MariaDB ..."
  apt-get install -y mariadb-server
fi
systemctl enable --now mariadb

DB_CLIENT="mysql"
command -v mysql >/dev/null 2>&1 || DB_CLIENT="mariadb"

# --- Caddy (reverse proxy + HTTPS otomatis) --------------------------------------

if command -v caddy >/dev/null 2>&1; then
  log "Caddy sudah terpasang."
else
  log "Memasang Caddy ..."
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    -o /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  chmod o+r /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# --- .env + database (hanya sekali; tidak menimpa yang sudah ada) ---------------

if [ -f "$APP_DIR/.env" ]; then
  log ".env sudah ada — dipakai apa adanya, database tidak disentuh."
else
  log "Membuat database dan .env baru ..."
  DB_NAME="qrnfc"
  DB_USER="qrnfc"
  DB_PASS="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 24)"
  ADMIN_USER="admin"
  ADMIN_PASS="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 20)"

  "$DB_CLIENT" -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT SELECT, INSERT, UPDATE, CREATE ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

  cp "$APP_DIR/env.example" "$APP_DIR/.env"
  sed -i \
    -e "s#^BASE_URL=.*#BASE_URL=https://${DOMAIN}#" \
    -e "s/^HOST=.*/HOST=127.0.0.1/" \
    -e "s/^TRUST_PROXY=.*/TRUST_PROXY=1/" \
    -e "s/^ADMIN_USER=.*/ADMIN_USER=${ADMIN_USER}/" \
    -e "s/^ADMIN_PASS=.*/ADMIN_PASS=${ADMIN_PASS}/" \
    -e "s/^DB_NAME=.*/DB_NAME=${DB_NAME}/" \
    -e "s/^DB_USER=.*/DB_USER=${DB_USER}/" \
    -e "s/^DB_PASS=.*/DB_PASS=${DB_PASS}/" \
    "$APP_DIR/.env"
fi

# --- Dependensi npm ------------------------------------------------------------

log "Menjalankan npm install ..."
npm install --omit=dev

# --- Kepemilikan dan hak akses berkas -------------------------------------------

chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

# --- Layanan systemd (hidup otomatis saat boot) ---------------------------------

log "Menyiapkan layanan systemd ..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=QR NFC
After=network.target mariadb.service

[Service]
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v node) server.js
Restart=always
User=${SERVICE_USER}

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

# --- Caddyfile (HTTPS otomatis) -------------------------------------------------

log "Menyiapkan Caddy untuk ${DOMAIN} ..."
touch /etc/caddy/Caddyfile
if ! grep -qF "${DOMAIN} {" /etc/caddy/Caddyfile; then
  {
    echo ""
    echo "${DOMAIN} {"
    echo "    reverse_proxy 127.0.0.1:$(grep '^PORT=' "$APP_DIR/.env" | cut -d= -f2)"
    echo "}"
  } >> /etc/caddy/Caddyfile
fi
systemctl enable caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# --- Firewall (bila ufw aktif) ---------------------------------------------------

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

# --- Ringkasan --------------------------------------------------------------------

sleep 1
if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
  echo ""
  echo "Peringatan: layanan ${SERVICE_NAME} belum aktif. Periksa log dengan:"
  echo "  journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
fi

log "Selesai."
echo "-----------------------------------------------------------------"
echo "Alamat admin : https://${DOMAIN}/admin"
echo "Username     : $(grep '^ADMIN_USER=' "$APP_DIR/.env" | cut -d= -f2)"
echo "Password     : $(grep '^ADMIN_PASS=' "$APP_DIR/.env" | cut -d= -f2)"
echo "-----------------------------------------------------------------"
echo "Simpan info di atas di tempat aman. Pastikan DNS ${DOMAIN} sudah"
echo "mengarah ke IP server ini dan port 80/443 terbuka, agar HTTPS"
echo "otomatis dari Caddy bisa aktif (bisa makan waktu semenit setelah"
echo "DNS baru mengarah)."
