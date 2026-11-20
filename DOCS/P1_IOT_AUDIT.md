# P1 : audit et livraison IoT, passerelle et messagerie

Périmètre : `gateway-agent/`, `node-red/`, `mosquitto/`, `docker-compose.yml` et `.env.example` à la racine.
Référence : *Smart Museum : Complete 3-Person Work Distribution*, section 2 (P1.1 à P1.5).

## 1. Résultats des tests automatiques

| Suite | Commande | Résultat |
|---|---|---|
| Passerelle | `cd gateway-agent && python3 -m pytest -q` | 39 tests (25 existants + 14 nouveaux) |
| Flux Node-RED | `node --test node-red/test/flows.test.mjs` | 31 tests, sans Node-RED ni broker |
| Fichiers Compose | `docker compose config` (dev et prod) | valides ; un jeton manquant arrête le démarrage avec un message clair |
| Certificats TLS | `mosquitto/scripts/generate-certs.sh localhost 127.0.0.1` puis poignée de main TLS 1.2 avec Python 3.13 (vérification stricte) | accepté ; nom d'hôte incorrect refusé |

## 2. Constats de l'audit et corrections

| # | Constat | Correction |
|---|---|---|
| 1 | `node-red/README.md` renvoyait à un `docker-compose.yml` et un `.env.example` absents du dépôt : impossible de lancer Mosquitto et Node-RED. | `docker-compose.yml`, `.env.example` et `mosquitto/config/mosquitto.conf` ajoutés. |
| 2 | Annonce de la Thing Description manquante : le middleware acceptait `POST /api/things`, mais ni la passerelle ni Node-RED ne l'utilisaient. | La passerelle publie sa TD sur `.../td` ; Node-RED la valide et la relaie (P1.3). |
| 3 | Aucune configuration de broker de production : pas de TLS, de comptes ni d'ACL. | `mosquitto.prod.conf`, ACL, `docker-compose.prod.yml`, scripts de certificats et de comptes (P1.4). |
| 4 | Le TLS de la passerelle ne pouvait pas être activé par variable d'environnement (seulement dans le YAML). | `MQTT_TLS_ENABLED` et `MQTT_TLS_CA_CERTS` ajoutés. |
| 5 | Test de connexion MQTT fragile (`reason_code == 0 or getattr(...) is False`) : un code entier non nul aurait été pris pour un succès. | `if not reason_code.is_failure` (API paho v2). |
| 6 | Les copies locales `config.sim.yaml` (documentées dans le README) n'étaient pas ignorées par Git. | `config.*.yaml` ignoré ; les fichiers `.example` restent versionnés. |
| 7 | Le flux Node-RED n'avait aucun test automatique. | `node-red/test/flows.test.mjs` (31 tests). |
| 8 | Le conteneur Node-RED écrit des fichiers d'exécution dans `node-red/` (`.config.*.json`, `settings.js`…). | Ajoutés à `node-red/.gitignore`. |

Aucun secret trouvé : identifiants MQTT et jeton de service uniquement par variables d'environnement ;
`flows.json` sans `credentials` ni jeton (vérifié par un test).

## 3. Suivi des tâches P1

Légende : **fait** = livré et testé automatiquement ; **à vérifier** = demande le matériel ou la VM.

### P1.1 : passerelle

| Tâche | État | Preuve |
|---|---|---|
| P1.1.1 à P1.1.3 structure, dépendances, tests | fait | 39 tests |
| P1.1.4 lecture réelle du BME280 | à vérifier | Raspberry Pi nécessaire ; démonstration en **simulation** |
| P1.1.5 identifiants `sim-` / `gw-sim` | fait | `test_config.py` (garde-fou dans les deux sens) |
| P1.1.6 publication QoS 1 | fait | `mqtt.qos` = 1, `test_publisher.py` |
| P1.1.7 file d'attente et reconnexion | fait (code) | `max_queued_messages_set(5000)`, reconnexion 1 à 30 s ; à démontrer en coupant le réseau |
| P1.1.8 statut et LWT | fait | `test_last_will_is_retained_offline_on_status_topic` |
| P1.1.9 aucun secret en dur | fait | audit, section 2 |
| P1.1.10 documentation | fait | `gateway-agent/README.md` |

### P1.2 : Node-RED

| Tâche | État | Preuve |
|---|---|---|
| P1.2.1 audit de `flows.json` | fait | tests de structure |
| P1.2.2 abonnements `telemetry` et `status` (+ `td`) | fait | test « abonnements MQTT attendus en QoS 1 » |
| P1.2.3 à P1.2.5 JSON, UUID, identifiants, propriété, unité, date, cohérence topic | fait | 7 tests de rejet |
| P1.2.6 `source` real / simulated | fait | 3 tests |
| P1.2.7 et P1.2.8 POST vers l'ingestion, jeton par variable | fait | tests « mesure valide » et « jeton absent » |
| P1.2.9 nouvel essai sur erreur réseau et 5xx | fait | aiguillage + nouvel essai (même `measurementId`, 2 s à 60 s) |
| P1.2.10 rejet définitif 400 / 403 / 422 | fait | test d'aiguillage |
| P1.2.11 journal des rejets | fait | test du journal |
| P1.2.12 doublons sans double enregistrement | fait | même `measurementId` réessayé ; `200` traité comme un succès |

### P1.3 : annonce de la Thing Description

| Tâche | État | Preuve |
|---|---|---|
| P1.3.1 contrat avec P2 | fait | corps `ThingAnnouncement` du middleware : `deviceId`, `zoneId`, `gatewayId`, `type`, `td` |
| P1.3.2 à P1.3.4 publication sur `.../td`, TD W3C valide | fait | `gateway_agent/thing.py`, `test_thing.py` (mêmes règles que le validateur du middleware) |
| P1.3.5 à P1.3.7 abonnement, validation, POST `/api/things` | fait | 12 tests Node-RED sur les annonces |
| P1.3.8 réponse du middleware | fait | 201 / 200 succès ; 400 / 403 / 422 journal ; 401 alerte ; 409 / 5xx nouvel essai |
| P1.3.9 nouvel appareil en pending | à vérifier en local | `config.simulated-new.yaml.example` (`sim-bme280-03`) ou bouton `TEST annonce TD` |
| P1.3.10 annonces en double ou invalides | fait | double : `200` mise à jour (message retenu) ; invalides : tests de rejet |

### P1.4 : MQTT de production

| Tâche | État | Preuve |
|---|---|---|
| P1.4.1 conventions de topics | fait | `mosquitto/README.md` |
| P1.4.2 configuration de production | fait | `mosquitto/config/mosquitto.prod.conf` |
| P1.4.3 comptes | fait | `scripts/add-device-user.sh` (mot de passe saisi au clavier) |
| P1.4.4 ACL | fait | `acl.devices` (un appareil n'écrit que sous son `deviceId`), `acl.internal` (lecture seule) |
| P1.4.5 certificats | fait | `scripts/generate-certs.sh`, testé avec Python 3.13 en vérification stricte |
| P1.4.6 TLS 8883 | fait (config) | seul port publié par `docker-compose.prod.yml` |
| P1.4.7 administration non exposée | fait | 1883 interne, éditeur Node-RED sur 127.0.0.1 |
| P1.4.8 à P1.4.10 connexions passerelle / Node-RED, reprise | à vérifier sur la VM | procédure dans `mosquitto/README.md` |

### P1.5 : démonstration

Scénario en simulation, dans l'ordre : zone simulée `sim-bme280-02` → mesures dans la PWA client
(`source = simulated`) ; bouton `TEST JSON casse` → ligne dans le journal des rejets ; arrêt du middleware →
nouveaux essais visibles dans Node-RED, puis reprise sans doublon ; nouvel appareil `sim-bme280-03` → `pending`
→ approbation dans la PWA admin → ses mesures sont acceptées ; arrêt brutal de l'agent → statut `offline` (LWT).

## 4. Limites connues

- La lecture du capteur réel n'est pas démontrée sans Raspberry Pi ; la démonstration utilise le simulateur,
  et toutes ses mesures sont étiquetées `simulated`.
- Le statut MQTT (`online` / `offline`) est visible dans Node-RED mais n'est pas encore transmis au middleware.
- Les tests de connexion TLS de production (P1.4.8 à P1.4.10) demandent la VM et le nom DNS fournis par P2.
