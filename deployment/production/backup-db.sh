#!/usr/bin/env bash
# backup-db.sh <file>             writes a compressed backup of the production database
# backup-db.sh --restore <file>   replaces the database content with a backup (asks first)
# The file contains personal data (accounts): keep it private.
set -euo pipefail
. "$(dirname "$0")/lib.sh"
container=${MONGO_CONTAINER:-smart-museum-prod-mongo}
auth='-u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin'
umask 077
if [ "${1:-}" = --restore ]; then
  file=${2:?backup file}
  [ -s "$file" ] || die "$file is missing or empty."
  gzip -t "$file" || die "$file is damaged."
  if [ "${CONFIRM:-}" != RESTORE ]; then
    read -rp "This replaces the production data. Type RESTORE to continue: " CONFIRM || true
    [ "$CONFIRM" = RESTORE ] || die "Cancelled; nothing was changed."
  fi
  docker exec -i "$container" sh -c "mongorestore --quiet --archive --gzip --drop --nsInclude \"\$MONGO_APP_DATABASE.*\" $auth" < "$file"
  echo "Database restored from $file."
  exit 0
fi
file=${1:?output file}
[ ! -e "$file" ] || die "$file already exists."
docker exec "$container" sh -c "mongodump --quiet --archive --gzip --db \"\$MONGO_APP_DATABASE\" $auth" > "$file"
gzip -t "$file" || die "The backup is damaged."
echo "Backup written to $file ($(wc -c < "$file") bytes)."
