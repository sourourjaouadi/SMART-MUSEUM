#!/usr/bin/env bash
# Run as root once the three names resolve to this server and ports 80/443 are open.
# DRY_RUN=1 only validates with the Let's Encrypt staging service.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_hosts
[ "$(id -u)" = 0 ] || die "Run as root."
[ -n "${LETSENCRYPT_EMAIL:-}" ] || die "Set LETSENCRYPT_EMAIL in server.env."
for h in "$CLIENT_HOST" "$ADMIN_HOST" "$API_HOST"; do
  getent hosts "$h" > /dev/null || die "$h does not resolve yet."
done
site=/etc/nginx/conf.d/smart-museum.conf
mkdir -p /var/www/letsencrypt
install -m 644 "$HERE/nginx/proxy.conf" /etc/nginx/smart-museum-proxy.conf
rm -f /etc/nginx/sites-enabled/default
if [ ! -f /etc/letsencrypt/live/smart-museum/fullchain.pem ]; then
  "$HERE/render-nginx.sh" http > "$site"
  nginx -t
  systemctl reload-or-restart nginx
  certbot certonly --webroot -w /var/www/letsencrypt --cert-name smart-museum --non-interactive --agree-tos \
    -m "$LETSENCRYPT_EMAIL" -d "$CLIENT_HOST" -d "$ADMIN_HOST" -d "$API_HOST" \
    --deploy-hook "systemctl reload nginx" ${DRY_RUN:+--dry-run}
  if [ -n "${DRY_RUN:-}" ]; then echo "Dry run passed."; exit 0; fi
fi
"$HERE/render-nginx.sh" https > "$site"
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
echo "HTTPS enabled for $CLIENT_HOST, $ADMIN_HOST and $API_HOST; renewal is automatic."
