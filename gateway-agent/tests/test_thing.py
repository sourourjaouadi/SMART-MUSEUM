"""
Module  : tests.test_thing
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-21
Version : 1.0
Rôle    : la Thing Description publiée respecte les règles du middleware
          (ThingDescriptionValidator) et le contrat POST /api/things.
"""
import json
from urllib.parse import urlparse

import pytest

from gateway_agent.config import build_config
from gateway_agent.measurement import UNITS, build_measurements
from gateway_agent.thing import TD_CONTEXT_V11, build_announcement, build_thing_description

SIM = {"gateway": {"id": "gw-sim", "zone_id": "salle-02", "device_id": "sim-bme280-02"}, "sensor": {"type": "simulated"}}


def middleware_rules(td, device_id):
    """Mêmes vérifications que ThingDescriptionValidator (middleware/core)."""
    errors = []
    ctx = td.get("@context")
    if not (ctx == TD_CONTEXT_V11 or (isinstance(ctx, list) and ctx and ctx[0] == TD_CONTEXT_V11)):
        errors.append("@context")
    tid = td.get("id")
    if not isinstance(tid, str) or not urlparse(tid).scheme or not (tid.endswith(":" + device_id) or tid.endswith("/" + device_id)):
        errors.append("id")
    if not isinstance(td.get("title"), str) or not td["title"].strip():
        errors.append("title")
    defs = td.get("securityDefinitions")
    if not isinstance(defs, dict) or not defs or any(not isinstance(v, dict) or not v.get("scheme") for v in defs.values()):
        errors.append("securityDefinitions")
    sec = td.get("security")
    refs = [sec] if isinstance(sec, str) else sec if isinstance(sec, list) else []
    if not refs or any(r not in (defs or {}) for r in refs):
        errors.append("security")
    total = 0
    for kind in ("properties", "actions", "events"):
        section = td.get(kind)
        if section is None:
            continue
        total += len(section)
        for name, aff in section.items():
            forms = aff.get("forms")
            if not isinstance(forms, list) or not forms or any(not f.get("href") for f in forms):
                errors.append(f"{kind}.{name}.forms")
    if total == 0:
        errors.append("affordances")
    return errors


def test_real_device_td_passes_middleware_rules():
    cfg = build_config({}, {})
    td = build_thing_description(cfg)
    assert middleware_rules(td, "bme280-01") == []
    assert td["id"] == "urn:museum:device:bme280-01"


def test_simulated_device_td_passes_and_says_simulated():
    cfg = build_config(SIM, {})
    td = build_thing_description(cfg)
    assert middleware_rules(td, "sim-bme280-02") == []
    assert "simulé" in td["description"]


def test_declared_units_match_published_measurements():
    """Le middleware refuse (422) une mesure dont la propriété ou l'unité n'est pas dans la TD."""
    cfg = build_config({}, {})
    props = build_thing_description(cfg)["properties"]
    for message in build_measurements({"temperature": 21.0, "humidity": 48.0, "pressure": 1013.0},
                                      device_id="bme280-01", zone_id="salle-01", gateway_id="gw-01"):
        assert message["property"] in props
        assert props[message["property"]]["unit"] == message["unit"] == UNITS[message["property"]]


def test_forms_point_to_the_device_topics():
    cfg = build_config({}, {"MQTT_HOST": "broker.local", "MQTT_PORT": "1884"})
    td = build_thing_description(cfg)
    assert td["properties"]["temperature"]["forms"][0]["href"] == "mqtt://broker.local:1884/museum/v1/salle-01/bme280-01/telemetry"
    assert td["events"]["status"]["forms"][0]["href"] == "mqtt://broker.local:1884/museum/v1/salle-01/bme280-01/status"


def test_tls_uses_mqtts_scheme():
    cfg = build_config({}, {"MQTT_TLS_ENABLED": "true", "MQTT_PORT": "8883"})
    href = build_thing_description(cfg)["properties"]["humidity"]["forms"][0]["href"]
    assert href.startswith("mqtts://localhost:8883/")


def test_announcement_matches_api_contract():
    cfg = build_config(SIM, {})
    body = build_announcement(cfg)
    assert set(body) == {"deviceId", "zoneId", "gatewayId", "type", "td"}
    assert (body["deviceId"], body["zoneId"], body["gatewayId"], body["type"]) == ("sim-bme280-02", "salle-02", "gw-sim", "bme280")
    json.dumps(body, ensure_ascii=False)  # sérialisable


@pytest.mark.parametrize("value, expected", [("true", True), ("1", True), ("false", False), ("off", False)])
def test_announce_td_can_be_disabled_by_environment(value, expected):
    assert build_config({}, {"ANNOUNCE_TD": value}).mqtt.announce_td is expected


def test_tls_settings_come_from_environment():
    cfg = build_config({}, {"MQTT_TLS_ENABLED": "yes", "MQTT_TLS_CA_CERTS": "/etc/smart-museum/ca.crt"})
    assert cfg.mqtt.tls.enabled is True
    assert cfg.mqtt.tls.ca_certs == "/etc/smart-museum/ca.crt"
