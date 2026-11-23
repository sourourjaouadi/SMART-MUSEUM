# shellcheck shell=bash
# Shared settings, sourced by the other scripts.
CONF=${SMART_MUSEUM_CONF:-/etc/smart-museum}
BASE=${SMART_MUSEUM_BASE:-/opt/smart-museum}
WILDFLY_HOME=${WILDFLY_HOME:-$BASE/wildfly}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

die() { echo "ERROR: $*" >&2; exit 1; }

load_hosts() {
  [ -f "$CONF/server.env" ] || die "$CONF/server.env is missing (copy server.env.example)."
  # shellcheck disable=SC1091
  . "$CONF/server.env"
  local h
  for h in CLIENT_HOST ADMIN_HOST API_HOST; do
    [[ "${!h:-}" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || die "$h must be a lowercase host name."
    [[ "${!h}" != *example.invalid ]] || die "$h still has the example value."
  done
  if [ "$CLIENT_HOST" = "$ADMIN_HOST" ] || [ "$CLIENT_HOST" = "$API_HOST" ] || [ "$ADMIN_HOST" = "$API_HOST" ]; then
    die "The three host names must be different."
  fi
}

load_prod_env() {
  [ -f "$CONF/prod.env" ] || die "$CONF/prod.env is missing (run create-secrets.sh)."
  set -a
  # shellcheck disable=SC1091
  . "$CONF/prod.env"
  set +a
}
