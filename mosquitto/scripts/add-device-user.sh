#!/usr/bin/env bash
# P1.4.3 : cree ou change le compte MQTT d'un appareil (nom d'utilisateur = deviceId).
# Le mot de passe est demande au clavier (jamais en argument, jamais dans l'historique).
# Usage : mosquitto/scripts/add-device-user.sh <deviceId>
#         mosquitto/scripts/add-device-user.sh --delete <deviceId>
# Le fichier mosquitto/config/passwd (ignore par Git) contient seulement des empreintes.
set -euo pipefail

DELETE=""
if [ "${1:-}" = "--delete" ]; then
  DELETE="-D"
  shift
fi
DEVICE="${1:-}"
if ! [[ "$DEVICE" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
  echo "Usage : $0 [--delete] <deviceId>   (1 a 64 caracteres : lettres, chiffres, . _ -)" >&2
  exit 1
fi
command -v docker >/dev/null || { echo "docker est requis." >&2; exit 1; }

CONF="$(cd "$(dirname "$0")/.." && pwd)/config"
CREATE=""
[ -f "$CONF/passwd" ] || { CREATE="-c"; [ -z "$DELETE" ] || { echo "Aucun fichier passwd." >&2; exit 1; }; }

if [ -n "$DELETE" ]; then
  docker run --rm -v "$CONF:/mosquitto/config" eclipse-mosquitto:2.0 \
    mosquitto_passwd -D /mosquitto/config/passwd "$DEVICE"
  echo "Compte supprime : $DEVICE"
else
  docker run --rm -it -v "$CONF:/mosquitto/config" eclipse-mosquitto:2.0 \
    sh -c "mosquitto_passwd $CREATE /mosquitto/config/passwd '$DEVICE' && chown 1883:1883 /mosquitto/config/passwd && chmod 0600 /mosquitto/config/passwd"
  echo "Compte cree ou mis a jour : $DEVICE"
fi

if docker ps --format '{{.Names}}' | grep -qx smart-museum-mosquitto; then
  docker kill -s HUP smart-museum-mosquitto >/dev/null
  echo "Broker recharge (comptes et ACL relus sans coupure)."
fi
