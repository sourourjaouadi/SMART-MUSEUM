#!/usr/bin/env bash
# Usage: render-nginx.sh http|https   (prints the configuration)
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_hosts
case "${1:-}" in http | https) ;; *) die "Usage: render-nginx.sh http|https" ;; esac
cert=${TLS_CERT:-/etc/letsencrypt/live/smart-museum/fullchain.pem}
key=${TLS_KEY:-/etc/letsencrypt/live/smart-museum/privkey.pem}
proxy=${NGINX_PROXY_FILE:-/etc/nginx/smart-museum-proxy.conf}
sed -e "s/@CLIENT_HOST@/$CLIENT_HOST/g" -e "s/@ADMIN_HOST@/$ADMIN_HOST/g" -e "s/@API_HOST@/$API_HOST/g" \
  -e "s#@CERT@#$cert#g" -e "s#@KEY@#$key#g" -e "s#@PROXY@#$proxy#g" "$HERE/nginx/$1.conf.template"
