#!/usr/bin/env bash
# Creates the production environment once: random secrets, internal TLS, first ADMIN.
# Nothing secret is printed. Existing files are never overwritten.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_hosts
umask 077
mkdir -p "$CONF/tls"
[ ! -e "$CONF/prod.env" ] || die "$CONF/prod.env already exists; it was not changed."

admin_name=${BOOTSTRAP_ADMIN_NAME:-}
admin_email=${BOOTSTRAP_ADMIN_EMAIL:-}
admin_password=${BOOTSTRAP_ADMIN_PASSWORD:-}
[ -n "$admin_name" ] || read -rp "First ADMIN name: " admin_name
[ -n "$admin_email" ] || read -rp "First ADMIN email: " admin_email
if [ -z "$admin_password" ]; then
  read -rsp "First ADMIN password (12 to 72 characters: letters digits . _ @ % + -): " admin_password
  echo
fi
[[ "$admin_name" =~ ^[A-Za-z0-9\ ._-]{1,120}$ ]] || die "Invalid ADMIN name."
[[ "$admin_email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Invalid ADMIN email."
[[ "$admin_password" =~ ^[A-Za-z0-9._@%+-]{12,72}$ ]] || die "Invalid ADMIN password."

random() { openssl rand -hex 32; }
KEYSTORE_PASSWORD=$(random)
export KEYSTORE_PASSWORD
mongo_root=$(random)
mongo_app=$(random)

# CORE and IAM are called over HTTPS on loopback: a certificate for localhost, and a
# truststore made of the JDK authorities plus that certificate.
JAVA_HOME=${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")}
keytool -genkeypair -alias internal -keyalg EC -groupname secp256r1 -validity 825 \
  -dname "CN=localhost" -ext "SAN=dns:localhost,ip:127.0.0.1" -storetype PKCS12 \
  -keystore "$CONF/tls/internal.p12" -storepass:env KEYSTORE_PASSWORD > /dev/null 2>&1
keytool -exportcert -rfc -alias internal -keystore "$CONF/tls/internal.p12" \
  -storepass:env KEYSTORE_PASSWORD -file "$CONF/tls/internal.crt" > /dev/null 2>&1
# Public certificates only: "changeit" protects nothing secret here.
cp -L "$JAVA_HOME/lib/security/cacerts" "$CONF/tls/truststore"
chmod 600 "$CONF/tls/truststore"
keytool -importcert -noprompt -alias smart-museum-internal -file "$CONF/tls/internal.crt" \
  -keystore "$CONF/tls/truststore" -storepass changeit > /dev/null 2>&1

cat > "$CONF/mongo.env" <<ENV
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=$mongo_root
MONGO_APP_DATABASE=smart_museum_prod
MONGO_APP_USER=smartmuseum
MONGO_APP_PASSWORD=$mongo_app
ENV
cat > "$CONF/prod.env" <<ENV
SMART_MUSEUM_ENV=prod
JNOSQL_MONGODB_HOST=localhost:27017
JNOSQL_DOCUMENT_DATABASE=smart_museum_prod
JNOSQL_MONGODB_USER=smartmuseum
JNOSQL_MONGODB_PASSWORD=$mongo_app
JNOSQL_MONGODB_AUTHENTICATION_SOURCE=smart_museum_prod
JNOSQL_MONGODB_AUTHENTICATION_MECHANISM=SCRAM-SHA-256
CORE_SERVICE_URL=https://localhost:8443/core
IAM_SERVICE_URL=https://localhost:8443/iam
INTER_SERVICE_TOKEN=$(random)
INGEST_SERVICE_TOKEN=$(random)
JWT_SIGNING_KEY_BASE64=$(openssl rand -base64 48 | tr -d "\n")
JWT_ISSUER=smart-museum
JWT_ACCESS_TOKEN_SECONDS=900
CORS_ALLOWED_ORIGINS=https://$CLIENT_HOST,https://$ADMIN_HOST
SEED_DEVICES=false
MQTT_BROKER_URI=mqtts://$API_HOST:8883
TLS_KEYSTORE_PATH=$CONF/tls/internal.p12
TLS_KEYSTORE_PASSWORD=$KEYSTORE_PASSWORD
BOOTSTRAP_ADMIN_NAME="$admin_name"
BOOTSTRAP_ADMIN_EMAIL=$admin_email
BOOTSTRAP_ADMIN_PASSWORD=$admin_password
ENV
echo "Created $CONF/prod.env, $CONF/mongo.env and $CONF/tls. Secret values were not displayed."
