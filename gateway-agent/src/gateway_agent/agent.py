"""
Module  : gateway_agent.agent
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : boucle principale de la passerelle : lire, horodater, publier.
"""

from __future__ import annotations

import logging
import signal
import threading
from typing import Optional

from .config import Config
from .measurement import build_measurements
from .mqtt_client import Publisher
from .sensor import SensorError, open_sensor

log = logging.getLogger("gateway_agent")

MAX_CONSECUTIVE_SENSOR_ERRORS = 10


def format_reading(readings: dict, simulated: bool) -> str:
    tag = "[SIMULATED] " if simulated else ""
    return (
        f"{tag}T={readings['temperature']:.2f} °C  "
        f"H={readings['humidity']:.2f} %  "
        f"P={readings['pressure']:.2f} hPa"
    )


def run(cfg: Config, *, once: bool = False, no_mqtt: bool = False) -> int:
    """Retourne un code de sortie (0 = arrêt normal)."""
    stop = threading.Event()

    def _stop(signum, _frame):
        log.info("signal %s reçu : arrêt", signal.Signals(signum).name)
        stop.set()

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    try:
        sensor = open_sensor(cfg)
    except SensorError as exc:
        log.error("%s", exc)
        return 3

    publisher: Optional[Publisher] = None
    if not no_mqtt:
        publisher = Publisher(cfg)
        publisher.start()

    log.info(
        "agent démarré : capteur=%s device=%s zone=%s gateway=%s intervalle=%ss",
        cfg.sensor.type, cfg.device_id, cfg.zone_id, cfg.gateway_id, cfg.sensor.interval_seconds,
    )
    errors = 0
    exit_code = 0
    try:
        while not stop.is_set():
            try:
                readings = sensor.read()
                errors = 0
            except SensorError as exc:
                errors += 1
                log.error("lecture impossible (%s/%s) : %s", errors, MAX_CONSECUTIVE_SENSOR_ERRORS, exc)
                if errors >= MAX_CONSECUTIVE_SENSOR_ERRORS:
                    log.error("trop d'erreurs consécutives : sortie pour redémarrage par systemd")
                    exit_code = 4
                    break
                readings = None
            if readings is not None:
                log.info(format_reading(readings, cfg.is_simulated))
                if publisher is not None:
                    for message in build_measurements(
                        readings, device_id=cfg.device_id, zone_id=cfg.zone_id, gateway_id=cfg.gateway_id
                    ):
                        publisher.publish_measurement(message)
                if once:
                    break
            elif once:
                exit_code = 4
                break
            stop.wait(cfg.sensor.interval_seconds)
    finally:
        if publisher is not None:
            publisher.stop()
        sensor.close()
    return exit_code
