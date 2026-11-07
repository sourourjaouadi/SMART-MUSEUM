"""
Module  : tests.test_measurement
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
"""
import re
import uuid

from gateway_agent.measurement import UNITS, build_measurements, utc_now_iso

ARGS = dict(device_id="bme280-01", zone_id="salle-01", gateway_id="gw-01")


def test_one_message_per_property_with_distinct_uuid():
    msgs = build_measurements({"temperature": 21.4, "humidity": 48.0, "pressure": 1008.2}, **ARGS)
    assert [m["property"] for m in msgs] == ["temperature", "humidity", "pressure"]
    ids = [m["measurementId"] for m in msgs]
    assert len(set(ids)) == 3
    for i in ids:
        assert str(uuid.UUID(i)) == i


def test_contract_fields_and_units():
    (m,) = build_measurements({"temperature": 21.456}, **ARGS)
    assert m["value"] == 21.46
    assert m["unit"] == "°C"
    assert m["deviceId"] == "bme280-01" and m["zoneId"] == "salle-01" and m["gatewayId"] == "gw-01"
    assert m["quality"] == "good"
    assert "source" not in m and "receivedAt" not in m  # ajoutés par Node-RED / le backend
    assert UNITS["humidity"] == "%" and UNITS["pressure"] == "hPa"


def test_observed_at_is_utc_with_z_suffix():
    stamp = utc_now_iso()
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", stamp)


def test_all_messages_of_one_reading_share_the_timestamp():
    msgs = build_measurements({"temperature": 1, "humidity": 2, "pressure": 3}, **ARGS)
    assert len({m["observedAt"] for m in msgs}) == 1


def test_non_finite_and_unknown_values_are_dropped():
    msgs = build_measurements(
        {"temperature": float("nan"), "humidity": float("inf"), "pressure": 1000.0, "colour": 3}, **ARGS
    )
    assert [m["property"] for m in msgs] == ["pressure"]


def test_explicit_timestamp_and_id_factory():
    seq = iter(["id-1", "id-2"])
    msgs = build_measurements(
        {"temperature": 20, "humidity": 40}, observed_at="2026-11-01T08:00:00Z", new_id=lambda: next(seq), **ARGS
    )
    assert [m["measurementId"] for m in msgs] == ["id-1", "id-2"]
    assert msgs[0]["observedAt"] == "2026-11-01T08:00:00Z"
