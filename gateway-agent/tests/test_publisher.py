"""
Module  : tests.test_publisher
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : vérifie le message LWT et le format du statut, sans broker.
"""
import json

from gateway_agent.config import build_config
from gateway_agent.mqtt_client import Publisher, status_payload


def test_status_payload_is_compact_json():
    cfg = build_config({}, {})
    body = json.loads(status_payload(cfg, "online", at="2026-11-01T08:00:00Z"))
    assert body == {"status": "online", "gatewayId": "gw-01", "deviceId": "bme280-01", "at": "2026-11-01T08:00:00Z"}


def test_last_will_is_retained_offline_on_status_topic():
    cfg = build_config({}, {})
    pub = Publisher(cfg)
    will = pub._client._will_payload  # paho : charge utile du LWT enregistrée avant connexion
    assert pub._client._will is True
    assert pub._client._will_topic == b"museum/v1/salle-01/bme280-01/status"
    assert json.loads(will)["status"] == "offline"
    assert pub._client._will_retain is True
    assert pub._client._will_qos == 1
