#!/usr/bin/env bash
# deploy-wars.sh <directory with the five WARs>   deploy, check, restore on failure
# deploy-wars.sh --rollback                       restore the previous release
# If the directory contains SHA256SUMS, the files must match it.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
load_hosts
WARS=(smart-museum-core.war smart-museum-iam.war smart-museum.war smart-museum-client.war smart-museum-admin.war)
target="$WILDFLY_HOME/standalone/deployments"
releases="$BASE/releases"
[ -d "$target" ] || die "No WildFly at $WILDFLY_HOME."
mkdir -p "$releases"

install_war() {
  local war=$1 source=$2 i
  rm -f -- "${target:?}/${war:?}.failed"
  cp "$source" "$target/$war.staging"
  # Whole seconds: WildFly copies this time to the .deployed marker with less precision.
  touch -d "@$(date +%s)" "$target/$war.staging"
  mv -f "$target/$war.staging" "$target/$war"
  touch "$target/$war.dodeploy"
  for ((i = 0; i < 180; i++)); do
    if [ -e "$target/$war.failed" ]; then echo "$war failed to deploy." >&2; return 1; fi
    if [ ! -e "$target/$war.dodeploy" ] && [ ! -e "$target/$war.isdeploying" ] \
      && [ -e "$target/$war.deployed" ] && [ ! "$target/$war" -nt "$target/$war.deployed" ]; then
      echo "$war deployed"
      return 0
    fi
    sleep 1
  done
  echo "$war: no deployment result after 180 s." >&2
  return 1
}

proxied() {
  curl -fsS -m 10 -H "Host: $1" -H "X-Forwarded-Proto: https" -H "X-Forwarded-Port: 443" "http://127.0.0.1:8180$2"
}
internal() { curl -fsS -m 10 --cacert "$CONF/tls/internal.crt" "https://localhost:8443$1"; }
healthy() { grep -q '"mongo":"UP"'; }

check() {
  local i
  for ((i = 0; i < 15; i++)); do
    if proxied "$API_HOST" /api/health 2> /dev/null | healthy \
      && internal /core/health 2> /dev/null | healthy \
      && internal /iam/health 2> /dev/null | healthy \
      && proxied "$CLIENT_HOST" / > /dev/null 2>&1 \
      && proxied "$ADMIN_HOST" / > /dev/null 2>&1; then
      echo "Health checks passed: API, CORE, IAM, Client, Admin."
      return 0
    fi
    sleep 2
  done
  echo "Health checks failed." >&2
  return 1
}

install_all() {
  local w
  for w in "${WARS[@]}"; do install_war "$w" "$1/$w" || return 1; done
  check
}

if [ "${1:-}" = --rollback ]; then
  [ -f "$releases/previous/SHA256SUMS" ] || die "There is no previous release."
  (cd "$releases/previous" && sha256sum -c --quiet SHA256SUMS) || die "The previous release is damaged."
  install_all "$releases/previous" || die "Rollback failed."
  echo "Rolled back to the previous release."
  exit 0
fi

source=${1:?directory with the five WARs}
for w in "${WARS[@]}"; do [ -s "$source/$w" ] || die "$source/$w is missing or empty."; done
if [ -f "$source/SHA256SUMS" ]; then
  (cd "$source" && sha256sum -c --quiet SHA256SUMS) || die "Checksums do not match; nothing was deployed."
fi

have_previous=
if [ -f "$target/smart-museum.war" ]; then
  backup="$releases/backup-$(date +%Y%m%d-%H%M%S)"
  mkdir "$backup"
  for w in "${WARS[@]}"; do cp -p "$target/$w" "$backup/"; done
  (cd "$backup" && sha256sum "${WARS[@]}" > SHA256SUMS)
  ln -sfn "$backup" "$releases/previous"
  have_previous=1
fi
if ! install_all "$source"; then
  [ -n "$have_previous" ] || die "Deployment failed and there is no earlier release to restore."
  echo "Restoring the previous release..." >&2
  install_all "$releases/previous" || die "Deployment failed AND the restore failed."
  die "Deployment failed; the previous release was restored."
fi
(cd "$target" && sha256sum "${WARS[@]}") | tee "$releases/current.sha256"
