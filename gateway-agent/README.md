# gateway-agent : passerelle Raspberry Pi (P1)

Agent Python qui lit le BME280 (I2C) et publie **une mesure MQTT par propriété** (température, humidité,
pression) selon le contrat d'API v1.1. Dossier propriétaire : P1. Toute modification du contrat passe
par une issue GitHub.

## Parcours d'une mesure

```
BME280 --I2C--> agent.py --MQTT QoS 1--> Mosquitto --> Node-RED --HTTP POST--> backend (P2)
                museum/v1/{zoneId}/{deviceId}/telemetry         /api/ingest/measurements
```

| Sujet | Valeur |
|---|---|
| Topic des mesures | `museum/v1/{zoneId}/{deviceId}/telemetry` (QoS 1) |
| Topic du statut | `museum/v1/{zoneId}/{deviceId}/status` (QoS 1, retenu) |
| Statut | `{"status":"online",...}` à la connexion ; `{"status":"offline","reason":"lwt"}` publié par le broker si l'agent disparaît ; `reason":"shutdown"` à l'arrêt propre |
| Identifiants réel | `bme280-01` / `salle-01` / `gw-01` |
| Identifiants simulé | `sim-bme280-02` / `salle-02` / `gw-sim` |
| `observedAt` | UTC, suffixe `Z`, une seule date par lecture |
| `measurementId` | UUID v4 par propriété et par lecture |

L'agent n'envoie **pas** `source` ni `receivedAt` : `source` est décidé par Node-RED, `receivedAt` par le backend.

## Matériel et câblage (BME280, 3,3 V uniquement)

| BME280 | Raspberry Pi |
|---|---|
| VIN / VCC | 3V3 (broche 1) : **jamais 5 V** |
| GND | GND (broche 6) |
| SDA | GPIO 2 (broche 3) |
| SCL | GPIO 3 (broche 5) |
| SDO | GND pour l'adresse `0x76` (3V3 pour `0x77`) |

```bash
sudo raspi-config nonint do_i2c 0        # active l'I2C
sudo apt install -y i2c-tools python3-venv
sudo i2cdetect -y 1                       # doit afficher 76 (ou 77)
timedatectl                               # « System clock synchronized: yes » est indispensable
```

Un horloge non synchronisée fait refuser les mesures (422 si la date dépasse de 5 min le futur du serveur).

## Installation sur le Pi

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin smartmuseum
sudo usermod -aG i2c smartmuseum
sudo mkdir -p /opt/smart-museum /etc/smart-museum
sudo git clone https://github.com/sourourjaouadi/SMART-MUSEUM.git /opt/smart-museum/repo   # adapter
sudo ln -sfn /opt/smart-museum/repo/gateway-agent /opt/smart-museum/gateway-agent
cd /opt/smart-museum/gateway-agent
sudo python3 -m venv .venv && sudo .venv/bin/pip install -r requirements.txt
sudo cp config.yaml.example /etc/smart-museum/config.yaml       # éditer mqtt.host
sudo cp systemd/agent.env.example /etc/smart-museum/agent.env && sudo chmod 600 /etc/smart-museum/agent.env
```

### Vérifier la lecture du capteur (A1)

```bash
PYTHONPATH=src .venv/bin/python -m gateway_agent --config /etc/smart-museum/config.yaml --once --no-mqtt
# ... T=21.43 °C  H=48.10 %  P=1008.25 hPa
```

### Service systemd (A5)

```bash
sudo cp systemd/smart-museum-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now smart-museum-agent
journalctl -u smart-museum-agent -f                # journal en direct
sudo systemctl kill -s SIGKILL smart-museum-agent  # test : il redémarre seul après 5 s
```

## Configuration (A4)

`config.yaml` ne contient **aucun secret** (il est ignoré par Git). L'environnement l'emporte sur le fichier :
`MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `GATEWAY_ID`, `ZONE_ID`, `DEVICE_ID`,
`SENSOR_TYPE`, `INTERVAL_SECONDS`, `LOG_LEVEL`. Une configuration invalide arrête l'agent avec le code 2.

## 2e zone simulée (A8)

```bash
cp config.simulated.yaml.example config.sim.yaml
PYTHONPATH=src python3 -m gateway_agent --config config.sim.yaml
# ... [SIMULATED] T=21.10 °C ...
```

Garde-fou : un capteur simulé **doit** utiliser `gw-sim…` ou `sim-…` (sinon l'agent refuse de démarrer),
et inversement. Node-RED étiquette alors les mesures `source = "simulated"` ; aucune mesure simulée ne peut
passer pour réelle.

## Comportement en cas de panne

| Situation | Comportement |
|---|---|
| Broker absent au démarrage | L'agent démarre, se reconnecte tout seul (1 s à 30 s) |
| Coupure réseau | Les mesures QoS 1 sont mises en file (5 000 max) puis renvoyées |
| Lecture du capteur impossible | Erreur journalisée ; après 10 échecs consécutifs : code 4, systemd redémarre |
| `SIGTERM` | Statut `offline` (reason `shutdown`) puis arrêt avec le code 0 |
| Coupure brutale | Le broker publie le LWT `offline` (reason `lwt`) après ~1,5 × `keepalive` |

## Tests

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m pytest -q          # 25 tests, sans Raspberry Pi ni broker
```
