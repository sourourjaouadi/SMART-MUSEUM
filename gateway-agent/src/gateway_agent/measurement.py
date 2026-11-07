"""
Module  : gateway_agent.measurement
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : construction des messages de mesure du contrat d'API (tâche A1).
          Un message par propriété, chacun avec son propre measurementId.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Callable, Dict, List, Mapping, Optional

# propriété -> unité (contrat d'API v1.1)
UNITS: Dict[str, str] = {
    "temperature": "°C",
    "humidity": "%",
    "pressure": "hPa",
    "illuminance": "lx",
}


def utc_now_iso() -> str:
    """Heure UTC au format ISO 8601 avec suffixe Z (ex. 2026-11-01T08:49:05Z).

    Le backend refuse une date à plus de 5 minutes dans le futur : l'horloge
    du Raspberry Pi doit être synchronisée (NTP).
    """
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_measurements(
    readings: Mapping[str, float],
    *,
    device_id: str,
    zone_id: str,
    gateway_id: str,
    observed_at: Optional[str] = None,
    new_id: Callable[[], str] = lambda: str(uuid.uuid4()),
) -> List[dict]:
    """Transforme une lecture {propriété: valeur} en une liste de messages.

    Les valeurs non finies (NaN, infini) et les propriétés inconnues sont ignorées.
    """
    observed_at = observed_at or utc_now_iso()
    messages: List[dict] = []
    for prop, value in readings.items():
        if prop not in UNITS:
            continue
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if not math.isfinite(number):
            continue
        messages.append(
            {
                "measurementId": new_id(),
                "deviceId": device_id,
                "zoneId": zone_id,
                "gatewayId": gateway_id,
                "property": prop,
                "value": round(number, 2),
                "unit": UNITS[prop],
                "observedAt": observed_at,
                "quality": "good",
            }
        )
    return messages
