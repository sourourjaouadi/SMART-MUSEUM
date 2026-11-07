"""
Module  : gateway_agent.sensor
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : lecture du BME280 en I2C (tâche A1). Le capteur simulé (A8) est dans
          simulator.py et n'est importé que lorsqu'il est demandé.
          Les bibliothèques matérielles ne sont importées qu'à l'ouverture du
          capteur réel : le reste du code se teste sans Raspberry Pi.
"""

from __future__ import annotations

from typing import Dict, Protocol

from .config import Config


class Sensor(Protocol):
    def read(self) -> Dict[str, float]:
        """Retourne {'temperature': °C, 'humidity': %, 'pressure': hPa}."""

    def close(self) -> None:
        ...


class SensorError(RuntimeError):
    """Lecture impossible (bus I2C absent, capteur débranché...)."""


class Bme280Sensor:
    """BME280 réel sur le bus I2C. Alimentation en 3,3 V uniquement."""

    def __init__(self, bus_number: int, address: int) -> None:
        try:
            import bme280  # paquet PyPI « RPi.bme280 »
            import smbus2
        except ImportError as exc:  # pragma: no cover - dépend du Pi
            raise SensorError(
                "Bibliothèques manquantes : pip install smbus2 RPi.bme280"
            ) from exc
        self._bme280 = bme280
        self._address = address
        try:
            self._bus = smbus2.SMBus(bus_number)
            self._params = bme280.load_calibration_params(self._bus, address)
        except Exception as exc:  # pragma: no cover - dépend du Pi
            raise SensorError(
                f"BME280 introuvable sur le bus I2C {bus_number} à l'adresse {address:#04x} "
                "(vérifier le câblage, 3,3 V, 'sudo i2cdetect -y 1')."
            ) from exc

    def read(self) -> Dict[str, float]:  # pragma: no cover - dépend du Pi
        try:
            sample = self._bme280.sample(self._bus, self._address, self._params)
        except Exception as exc:
            raise SensorError(f"lecture BME280 impossible : {exc}") from exc
        return {
            "temperature": float(sample.temperature),
            "humidity": float(sample.humidity),
            "pressure": float(sample.pressure),
        }

    def close(self) -> None:  # pragma: no cover - dépend du Pi
        try:
            self._bus.close()
        except Exception:
            pass


def open_sensor(cfg: Config) -> Sensor:
    if cfg.sensor.type == "bme280":
        return Bme280Sensor(cfg.sensor.i2c_bus, cfg.sensor.i2c_address)
    from .simulator import SimulatedSensor  # tâche A8

    return SimulatedSensor()
