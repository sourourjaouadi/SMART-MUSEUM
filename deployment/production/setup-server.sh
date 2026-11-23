#!/usr/bin/env bash
# First setup of an Ubuntu 24.04 server. Run as root from a checkout of the repository.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
[ "$(id -u)" = 0 ] || die "Run as root."
load_hosts
VERSION=42.0.0.Final
SHA1=95d45f6b4eeeddeefb17aa329800ce90929799c8

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq openjdk-21-jre-headless nginx certbot curl unzip openssl procps ufw docker.io docker-compose-v2

id smartmuseum > /dev/null 2>&1 || useradd --system --home-dir "$BASE" --shell /usr/sbin/nologin smartmuseum
mkdir -p "$BASE"
if [ ! -d "$WILDFLY_HOME" ]; then
  download="$BASE/wildfly-$VERSION.zip"
  curl -fL --retry 5 -o "$download" "https://github.com/wildfly/wildfly/releases/download/$VERSION/wildfly-$VERSION.zip"
  echo "$SHA1  $download" | sha1sum -c -
  unzip -q "$download" -d "$BASE"
  mv "$BASE/wildfly-$VERSION" "$WILDFLY_HOME"
fi
[ -f "$CONF/prod.env" ] || "$HERE/create-secrets.sh"
systemctl stop smart-museum-wildfly 2> /dev/null || true
"$HERE/configure-wildfly.sh"
chown -R smartmuseum:smartmuseum "$BASE" "$CONF/tls"
chgrp smartmuseum "$CONF"
chmod 750 "$CONF"

# Public: SSH, HTTP, HTTPS and MQTT over TLS. MongoDB, WildFly and management stay on loopback.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8883/tcp
ufw --force enable

docker compose -f "$HERE/mongo/docker-compose.yml" up -d
install -m 644 "$HERE/smart-museum-wildfly.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now smart-museum-wildfly
echo "Server ready. Next: deploy-wars.sh <directory>, then enable-https.sh."
