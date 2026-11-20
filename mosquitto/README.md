# mosquitto : broker MQTT (P1)

| Fichier | Rôle |
|---|---|
| `config/mosquitto.conf` | Broker de **développement** : port 1883 sans mot de passe, publié seulement sur `127.0.0.1` par `docker-compose.yml` (racine). |
| `config/mosquitto.prod.conf` | Broker de **production** : port public **8883 en TLS** avec comptes, port 1883 interne au réseau Docker pour Node-RED. |
| `config/acl.devices` | ACL du port 8883 : chaque appareil publie uniquement sous son propre `deviceId`. |
| `config/acl.internal` | ACL du port 1883 interne : Node-RED lit seulement les topics du musée. |
| `docker-compose.prod.yml` | Mosquitto + Node-RED sur la VM cloud ; seul le port 8883 est public. |
| `scripts/generate-certs.sh` | Crée la CA du broker et le certificat serveur TLS. |
| `scripts/add-device-user.sh` | Crée, modifie ou supprime le compte MQTT d'un appareil. |

Ignorés par Git, jamais commités : `config/passwd` (empreintes des mots de passe) et `certs/` (clés privées).

## Topics (contrat P1.4.1)

| Topic | QoS | Retenu | Émetteur | Contenu |
|---|---|---|---|---|
| `museum/v1/{zoneId}/{deviceId}/telemetry` | 1 | non | passerelle | une mesure (JSON du contrat d'ingestion) |
| `museum/v1/{zoneId}/{deviceId}/status` | 1 | oui | passerelle, LWT par le broker | `online` / `offline` |
| `museum/v1/{zoneId}/{deviceId}/td` | 1 | oui | passerelle | annonce `{deviceId, zoneId, gatewayId, type, td}` |

Identifiants : 1 à 64 caractères parmi lettres, chiffres, `.`, `_`, `-` (même règle que le middleware).
Un appareil simulé utilise `sim-…` ou `gw-sim…`.

## Développement local

```bash
cp .env.example .env     # à la racine : INGEST_SERVICE_TOKEN, BACKEND_URL
docker compose up -d     # Mosquitto 127.0.0.1:1883 + Node-RED http://localhost:1880
```

Observer les messages (client MQTT de l'image Mosquitto, sans rien installer) :

```bash
docker compose exec mosquitto mosquitto_sub -h localhost -t 'museum/v1/#' -v
```

## Production (P1.4)

Tout se fait sur la VM depuis la racine du dépôt ; `<broker>` est le nom DNS public du broker
(par exemple `mqtt.smartmuseum.example`), fourni par P2 avec l'adresse de la VM.

1. **Certificats TLS** (P1.4.5)
   ```bash
   mosquitto/scripts/generate-certs.sh <broker> <IP publique>
   sudo chown 1883:1883 mosquitto/certs/server.key
   ```
   La CA (`certs/ca.crt`) est propre au projet : copier ce fichier **public** sur chaque passerelle.
   Garder `certs/ca.key` hors de la VM après usage si possible. Avec un certificat Let's Encrypt pour
   `<broker>`, remplacer `certfile`/`keyfile` par ceux de Let's Encrypt et `cafile` par la chaîne fournie.

2. **Un compte par appareil** (P1.4.3) : nom d'utilisateur = `deviceId`, mot de passe saisi au clavier.
   ```bash
   mosquitto/scripts/add-device-user.sh bme280-01
   mosquitto/scripts/add-device-user.sh sim-bme280-02
   ```
   Supprimer un compte : `mosquitto/scripts/add-device-user.sh --delete <deviceId>`. Le broker est rechargé
   automatiquement (`SIGHUP`) s'il tourne.

3. **Variables** dans `.env` à la racine (jamais commité) : `BACKEND_URL` (URL publique de l'API, sans `/api`),
   `INGEST_SERVICE_TOKEN` (même valeur que le middleware), `INGEST_MAX_ATTEMPTS` (facultatif).

4. **Démarrage**
   ```bash
   docker compose -f mosquitto/docker-compose.prod.yml --env-file .env up -d
   docker compose -f mosquitto/docker-compose.prod.yml logs -f mosquitto
   ```

5. **Pare-feu** (avec P2) : ouvrir uniquement **8883/tcp** pour MQTT. Le port 1883 n'est pas publié et
   l'éditeur Node-RED écoute sur `127.0.0.1:1880` : y accéder par tunnel SSH
   (`ssh -L 1880:127.0.0.1:1880 <utilisateur>@<VM>` puis http://localhost:1880).

### Sécurité appliquée

| Exigence | Mise en œuvre |
|---|---|
| TLS sur 8883 (P1.4.6) | `listener 8883` avec `certfile`/`keyfile`, TLS 1.2 minimum |
| Authentification (P1.4.3) | `allow_anonymous false`, `password_file` (empreintes uniquement) |
| ACL (P1.4.4) | `pattern write museum/v1/+/%u/...` : un appareil n'écrit que sous son `deviceId`, ne lit rien |
| Administration non exposée (P1.4.7) | aucun port d'administration ; 1883 interne au réseau Docker ; éditeur Node-RED sur 127.0.0.1 |
| Zone d'un appareil | le middleware refuse (403) un appareil annoncé ou publiant dans une autre zone que la sienne |

## Tests de connexion (P1.4.8 à P1.4.10)

Depuis un poste qui possède `ca.crt` (l'image Mosquitto fournit les clients, sans rien installer) :

```bash
# TLS + compte valide : la publication réussit
docker run --rm -v "$PWD/mosquitto/certs/ca.crt:/ca.crt:ro" eclipse-mosquitto:2.0 \
  mosquitto_pub -h <broker> -p 8883 --cafile /ca.crt -u sim-bme280-02 -P '<mot de passe>' \
  -t museum/v1/salle-02/sim-bme280-02/status -m '{"status":"online"}' -d

# Sans mot de passe : refusé (« not authorised »)
docker run --rm -v "$PWD/mosquitto/certs/ca.crt:/ca.crt:ro" eclipse-mosquitto:2.0 \
  mosquitto_pub -h <broker> -p 8883 --cafile /ca.crt -t museum/v1/salle-02/sim-bme280-02/status -m x -d

# Port 1883 depuis l'extérieur : connexion impossible (non publié)
```

**Passerelle** : dans `/etc/smart-museum/agent.env` (voir `gateway-agent/systemd/agent.env.example`) :

```bash
MQTT_HOST=<broker>
MQTT_PORT=8883
MQTT_TLS_ENABLED=true
MQTT_TLS_CA_CERTS=/etc/smart-museum/ca.crt
MQTT_USERNAME=<deviceId>
MQTT_PASSWORD=<mot de passe>
```

Le journal de l'agent affiche `connecté à <broker>:8883`. Pour vérifier la reprise (P1.4.10) : couper le
réseau de la passerelle une minute, puis le rétablir ; les mesures mises en file (5 000 au maximum) sont
renvoyées avec leurs `measurementId` d'origine et le middleware ignore les doublons.

**Node-RED** : `docker compose -f mosquitto/docker-compose.prod.yml logs nodered` doit montrer la connexion au
broker (`mosquitto:1883`), et les annonces/mesures relayées vers `BACKEND_URL`.
