"""
Module  : tests.test_sensor
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
"""
from gateway_agent.simulator import SimulatedSensor

RANGES = {"temperature": (-40, 85), "humidity": (0, 100), "pressure": (300, 1100)}


def test_simulated_values_stay_inside_backend_ranges():
    sensor = SimulatedSensor(seed=1)
    for _ in range(2000):
        reading = sensor.read()
        assert set(reading) == set(RANGES)
        for prop, (low, high) in RANGES.items():
            assert low <= reading[prop] <= high


def test_simulated_values_are_plausible_and_vary():
    sensor = SimulatedSensor(seed=2)
    series = [sensor.read()["temperature"] for _ in range(200)]
    assert max(series) - min(series) > 0.1
    assert all(10 < t < 35 for t in series)
