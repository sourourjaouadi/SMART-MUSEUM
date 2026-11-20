"""
Module  : gateway_agent.thing
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-21
Version : 1.0
Rôle    : Thing Description W3C WoT 1.1 de l'appareil et message d'annonce publié
          sur museum/v1/{zoneId}/{deviceId}/td (tâche P1.3).
          Node-RED relaie l'annonce vers POST /api/things ; le middleware enregistre
          l'appareil en statut « pending » jusqu'à l'approbation par un ADMIN.
"""

from __future__ import annotations

from typing import Dict, List

from .config import Config
from .measurement import UNITS

TD_CONTEXT_V11 = "https://www.w3.org/2022/wot/td/v1.1"
THING_ID_PREFIX = "urn:museum:device:"
SENSOR_MODEL = "bme280"

# Propriétés réellement publiées par le BME280 (réel ou simulé) : titre, minimum, maximum.
# Les bornes sont celles de la validation du middleware (RangeHandler).
PROPERTIES = {
    "temperature": ("Temperature", -40.0, 85.0),
    "humidity": ("Humidite relative", 0.0, 100.0),
    "pressure": ("Pression", 300.0, 1100.0),
}


def thing_id(device_id: str) -> str:
    return THING_ID_PREFIX + device_id


def broker_uri(cfg: Config) -> str:
    scheme = "mqtts" if cfg.mqtt.tls.enabled else "mqtt"
    return f"{scheme}://{cfg.mqtt.host}:{cfg.mqtt.port}"


def _form(href: str, op: str) -> Dict[str, object]:
    return {"href": href, "op": [op], "contentType": "application/json"}


def build_thing_description(cfg: Config) -> Dict[str, object]:
    """TD JSON-LD 1.1 conforme aux règles du middleware (ThingDescriptionValidator)."""
    base = f"{broker_uri(cfg)}/{cfg.topic('')}"
    kind = "simulé" if cfg.is_simulated else "réel"
    properties: Dict[str, object] = {}
    for name, (title, minimum, maximum) in PROPERTIES.items():
        properties[name] = {
            "title": title,
            "type": "number",
            "unit": UNITS[name],
            "minimum": minimum,
            "maximum": maximum,
            "readOnly": True,
            "observable": True,
            "forms": [_form(base + "telemetry", "observeproperty")],
        }
    return {
        "@context": [TD_CONTEXT_V11, {"museum": "urn:museum:"}],
        "@type": "Thing",
        "id": thing_id(cfg.device_id),
        "title": f"BME280 {cfg.device_id}",
        "description": f"Capteur environnemental {kind} de la zone {cfg.zone_id} (passerelle {cfg.gateway_id})",
        "securityDefinitions": {"nosec_sc": {"scheme": "nosec"}},
        "security": "nosec_sc",
        "properties": properties,
        "events": {
            "status": {
                "title": "Statut de l'appareil (online/offline, LWT)",
                "data": {"type": "string", "enum": ["online", "offline"]},
                "forms": [_form(base + "status", "subscribeevent")],
            }
        },
    }


def build_announcement(cfg: Config) -> Dict[str, object]:
    """Corps attendu par POST /api/things (ThingAnnouncement du middleware)."""
    return {
        "deviceId": cfg.device_id,
        "zoneId": cfg.zone_id,
        "gatewayId": cfg.gateway_id,
        "type": SENSOR_MODEL,
        "td": build_thing_description(cfg),
    }


def declared_properties(td: Dict[str, object]) -> List[str]:
    props = td.get("properties")
    return sorted(props) if isinstance(props, dict) else []
