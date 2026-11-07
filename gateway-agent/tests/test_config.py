"""
Module  : tests.test_config
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
"""
import pytest

from gateway_agent.config import ConfigError, build_config


def test_defaults_match_the_seed_devices():
    cfg = build_config({}, {})
    assert (cfg.gateway_id, cfg.zone_id, cfg.device_id) == ("gw-01", "salle-01", "bme280-01")
    assert cfg.mqtt.qos == 1 and cfg.mqtt.keepalive == 30
    assert cfg.topic("telemetry") == "museum/v1/salle-01/bme280-01/telemetry"
    assert cfg.topic("status") == "museum/v1/salle-01/bme280-01/status"


def test_environment_overrides_file_and_secrets_come_from_env_only():
    raw = {"mqtt": {"host": "from-file", "username": "ignored", "password": "ignored"}}
    cfg = build_config(raw, {"MQTT_HOST": "from-env", "MQTT_USERNAME": "u", "MQTT_PASSWORD": "p"})
    assert cfg.mqtt.host == "from-env"
    assert (cfg.mqtt.username, cfg.mqtt.password) == ("u", "p")
    assert build_config(raw, {}).mqtt.username is None  # jamais lu dans le fichier


@pytest.mark.parametrize("bad", ["", "a b", "x" * 65, "salle/01", "é"])
def test_invalid_identifiers_are_rejected(bad):
    with pytest.raises(ConfigError):
        build_config({"gateway": {"zone_id": bad}}, {})


@pytest.mark.parametrize(
    "raw",
    [
        {"sensor": {"interval_seconds": 0}},
        {"sensor": {"type": "dht22"}},
        {"mqtt": {"qos": 3}},
        {"mqtt": {"port": 70000}},
        {"mqtt": {"topic_prefix": "museum/#"}},
    ],
)
def test_invalid_values_are_rejected(raw):
    with pytest.raises(ConfigError):
        build_config(raw, {})


def test_simulated_sensor_cannot_pose_as_real():
    with pytest.raises(ConfigError):
        build_config({"sensor": {"type": "simulated"}}, {})  # ids réels + capteur simulé


def test_real_sensor_cannot_use_simulated_ids():
    with pytest.raises(ConfigError):
        build_config({"gateway": {"id": "gw-sim", "device_id": "sim-bme280-02"}}, {})


def test_simulated_configuration_is_accepted():
    cfg = build_config(
        {"gateway": {"id": "gw-sim", "zone_id": "salle-02", "device_id": "sim-bme280-02"},
         "sensor": {"type": "simulated"}},
        {},
    )
    assert cfg.is_simulated and cfg.zone_id == "salle-02"
