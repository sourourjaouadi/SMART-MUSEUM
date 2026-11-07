"""
Module  : gateway_agent.config
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : chargement et validation de la configuration (tâche A4).
          Aucun secret dans le fichier : identifiants MQTT uniquement par
          variables d'environnement.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional

import yaml

# Même règle que le contrat d'API (backend) : 1 à 64 caractères.
ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
SENSOR_TYPES = ("bme280", "fake", "simulated")


class ConfigError(ValueError):
    """Configuration invalide : le message est destiné à l'utilisateur."""


@dataclass(frozen=True)
class TlsConfig:
    enabled: bool = False
    ca_certs: Optional[str] = None


@dataclass(frozen=True)
class MqttConfig:
    host: str = "localhost"
    port: int = 1883
    keepalive: int = 30
    qos: int = 1
    topic_prefix: str = "museum/v1"
    username: Optional[str] = None  # jamais lu dans le fichier
    password: Optional[str] = None  # jamais lu dans le fichier
    tls: TlsConfig = field(default_factory=TlsConfig)


@dataclass(frozen=True)
class SensorConfig:
    type: str = "bme280"
    i2c_bus: int = 1
    i2c_address: int = 0x76
    interval_seconds: float = 10.0


@dataclass(frozen=True)
class Config:
    gateway_id: str
    zone_id: str
    device_id: str
    sensor: SensorConfig
    mqtt: MqttConfig
    log_level: str = "INFO"

    @property
    def is_simulated(self) -> bool:
        return self.sensor.type in ("fake", "simulated")

    def topic(self, suffix: str) -> str:
        """museum/v1/{zoneId}/{deviceId}/{suffix}"""
        return f"{self.mqtt.topic_prefix}/{self.zone_id}/{self.device_id}/{suffix}"


def _check_id(name: str, value: Any) -> str:
    if not isinstance(value, str) or not ID_PATTERN.match(value):
        raise ConfigError(
            f"{name} invalide ({value!r}) : 1 à 64 caractères parmi lettres, chiffres, '.', '_' et '-'."
        )
    return value


def _is_sim_name(gateway_id: str, device_id: str) -> bool:
    return gateway_id.startswith("gw-sim") or device_id.startswith("sim-")


def build_config(raw: Mapping[str, Any], env: Mapping[str, str]) -> Config:
    """Construit la configuration à partir du YAML (raw) et de l'environnement (env).

    L'environnement l'emporte sur le fichier.
    """
    gw = dict(raw.get("gateway") or {})
    sn = dict(raw.get("sensor") or {})
    mq = dict(raw.get("mqtt") or {})
    tl = dict(mq.get("tls") or {})
    lg = dict(raw.get("logging") or {})

    gateway_id = _check_id("gateway.id", env.get("GATEWAY_ID", gw.get("id", "gw-01")))
    zone_id = _check_id("gateway.zone_id", env.get("ZONE_ID", gw.get("zone_id", "salle-01")))
    device_id = _check_id("gateway.device_id", env.get("DEVICE_ID", gw.get("device_id", "bme280-01")))

    sensor_type = str(env.get("SENSOR_TYPE", sn.get("type", "bme280")))
    if sensor_type not in SENSOR_TYPES:
        raise ConfigError(f"sensor.type invalide ({sensor_type!r}) : {', '.join(SENSOR_TYPES)}.")
    try:
        interval = float(env.get("INTERVAL_SECONDS", sn.get("interval_seconds", 10)))
        i2c_bus = int(sn.get("i2c_bus", 1))
        i2c_address = int(sn.get("i2c_address", 0x76))
        port = int(env.get("MQTT_PORT", mq.get("port", 1883)))
        keepalive = int(mq.get("keepalive", 30))
        qos = int(mq.get("qos", 1))
    except (TypeError, ValueError) as exc:
        raise ConfigError(f"valeur numérique invalide dans la configuration : {exc}") from exc
    if interval < 1:
        raise ConfigError("sensor.interval_seconds doit être au moins 1.")
    if qos not in (0, 1, 2):
        raise ConfigError("mqtt.qos doit valoir 0, 1 ou 2.")
    if not (1 <= port <= 65535):
        raise ConfigError("mqtt.port invalide.")
    if keepalive < 5:
        raise ConfigError("mqtt.keepalive doit être au moins 5 secondes.")

    host = str(env.get("MQTT_HOST", mq.get("host", "localhost")))
    if not host:
        raise ConfigError("mqtt.host ne peut pas être vide.")
    prefix = str(mq.get("topic_prefix", "museum/v1")).strip("/")
    if not prefix or "+" in prefix or "#" in prefix:
        raise ConfigError("mqtt.topic_prefix invalide (caractères génériques interdits).")

    # Garde-fou d'honnêteté : une mesure simulée ne doit jamais passer pour réelle.
    simulated_type = sensor_type in ("fake", "simulated")
    simulated_name = _is_sim_name(gateway_id, device_id)
    if simulated_type and not simulated_name:
        raise ConfigError(
            "Un capteur simulé doit utiliser un gateway.id 'gw-sim...' ou un device_id 'sim-...' "
            "pour que Node-RED l'étiquette 'simulated'."
        )
    if not simulated_type and simulated_name:
        raise ConfigError(
            "Un identifiant simulé ('gw-sim...' ou 'sim-...') est réservé à un capteur de type "
            "'fake' ou 'simulated'."
        )

    return Config(
        gateway_id=gateway_id,
        zone_id=zone_id,
        device_id=device_id,
        sensor=SensorConfig(type=sensor_type, i2c_bus=i2c_bus, i2c_address=i2c_address, interval_seconds=interval),
        mqtt=MqttConfig(
            host=host,
            port=port,
            keepalive=keepalive,
            qos=qos,
            topic_prefix=prefix,
            username=env.get("MQTT_USERNAME") or None,
            password=env.get("MQTT_PASSWORD") or None,
            tls=TlsConfig(enabled=bool(tl.get("enabled", False)), ca_certs=tl.get("ca_certs")),
        ),
        log_level=str(env.get("LOG_LEVEL", lg.get("level", "INFO"))).upper(),
    )


def load_config(path: Optional[str], env: Optional[Mapping[str, str]] = None) -> Config:
    env = os.environ if env is None else env
    raw: Mapping[str, Any] = {}
    if path:
        try:
            with open(path, "r", encoding="utf-8") as handle:
                raw = yaml.safe_load(handle) or {}
        except FileNotFoundError as exc:
            raise ConfigError(f"fichier de configuration introuvable : {path}") from exc
        except yaml.YAMLError as exc:
            raise ConfigError(f"YAML invalide dans {path} : {exc}") from exc
        if not isinstance(raw, dict):
            raise ConfigError(f"{path} doit contenir un objet YAML.")
    return build_config(raw, env)
