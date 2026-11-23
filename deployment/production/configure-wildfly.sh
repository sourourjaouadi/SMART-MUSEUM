#!/usr/bin/env bash
# Configures WildFly for production, with WildFly stopped. It always starts from the
# pristine standalone.xml, so it can be run again after a host name change.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_hosts
load_prod_env
config="$WILDFLY_HOME/standalone/configuration/standalone.xml"
pristine="$config.pristine"
[ -f "$config" ] || die "No WildFly at $WILDFLY_HOME."
if pgrep -f org.jboss.as.standalone > /dev/null; then die "Stop WildFly first."; fi
[ -f "$pristine" ] || cp -p "$config" "$pristine"
before="$config.before-$(date +%Y%m%d-%H%M%S)"
cp -p "$config" "$before"
cp -p "$pristine" "$config"
cli=$(mktemp)
trap 'rm -f -- "${cli:?}"' EXIT
sed -e "s/@CLIENT_HOST@/$CLIENT_HOST/" -e "s/@ADMIN_HOST@/$ADMIN_HOST/" -e "s/@API_HOST@/$API_HOST/" \
  "$HERE/wildfly-production.cli.template" > "$cli"
if ! "$WILDFLY_HOME/bin/jboss-cli.sh" --file="$cli" || ! grep -q '<server name="internal-server"' "$config"; then
  cp -p "$before" "$config"
  die "WildFly CLI failed; the previous standalone.xml was restored."
fi
# The API must trust the internal certificate when it calls CORE and IAM.
conf="$WILDFLY_HOME/bin/standalone.conf"
if ! grep -q "smart-museum truststore" "$conf"; then
  {
    echo
    echo "# smart-museum truststore"
    echo "JAVA_OPTS=\"\$JAVA_OPTS -Djavax.net.ssl.trustStore=$CONF/tls/truststore -Djavax.net.ssl.trustStorePassword=changeit\""
  } >> "$conf"
fi
echo "WildFly configured: proxy listener 127.0.0.1:8180, CORE/IAM on https://localhost:8443 only."
