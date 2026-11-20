#!/usr/bin/env bash
# P1.4.5 : autorite de certification (CA) du broker + certificat serveur TLS pour le port 8883.
# Usage : mosquitto/scripts/generate-certs.sh <nom DNS du broker> [adresse IP]
#   ex.   mosquitto/scripts/generate-certs.sh mqtt.smartmuseum.example 203.0.113.10
# Resultat dans mosquitto/certs/ (ignore par Git) :
#   ca.crt      a copier sur chaque passerelle (MQTT_TLS_CA_CERTS)  - public
#   ca.key      cle de la CA : a garder hors de la VM si possible     - SECRET
#   server.crt  certificat du broker                                 - public
#   server.key  cle du broker                                        - SECRET
# La CA existante est reutilisee : relancer le script renouvelle seulement le certificat serveur.
set -euo pipefail

HOST="${1:-}"
IP="${2:-}"
if [ -z "$HOST" ]; then
  echo "Usage : $0 <nom DNS du broker> [adresse IP]" >&2
  exit 1
fi
if ! [[ "$HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "Nom DNS invalide : $HOST" >&2
  exit 1
fi
if [ -n "$IP" ] && ! [[ "$IP" =~ ^[0-9.]+$|^[0-9A-Fa-f:]+$ ]]; then
  echo "Adresse IP invalide : $IP" >&2
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl est requis." >&2; exit 1; }

DIR="$(cd "$(dirname "$0")/.." && pwd)/certs"
mkdir -p "$DIR"
cd "$DIR"
umask 077

if [ ! -f ca.key ]; then
  # Extensions exigees par la verification stricte de Python 3.13+ (paho-mqtt) et d'OpenSSL 3.
  openssl req -x509 -newkey rsa:4096 -sha256 -days 1825 -nodes \
    -keyout ca.key -out ca.crt -subj "/O=Smart Museum/CN=Smart Museum MQTT CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -addext "subjectKeyIdentifier=hash" 2>/dev/null
  echo "CA creee : $DIR/ca.crt"
else
  echo "CA existante reutilisee : $DIR/ca.crt"
fi

SAN="DNS:$HOST"
[ -n "$IP" ] && SAN="$SAN,IP:$IP"
openssl req -newkey rsa:2048 -sha256 -nodes -keyout server.key -out server.csr \
  -subj "/O=Smart Museum/CN=$HOST" 2>/dev/null
printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName=%s\n' "$SAN" > server.ext
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 825 -sha256 -extfile server.ext 2>/dev/null
rm -f server.csr server.ext
chmod 644 ca.crt server.crt
chmod 600 ca.key server.key

openssl verify -CAfile ca.crt server.crt
echo "Certificat serveur cree pour $SAN : $DIR/server.crt"
echo
echo "Sur la VM, le conteneur Mosquitto (utilisateur 1883) doit pouvoir lire la cle :"
echo "  sudo chown 1883:1883 $DIR/server.key"
echo "Sur chaque passerelle, copier $DIR/ca.crt puis definir MQTT_TLS_CA_CERTS=<chemin de ca.crt>."
