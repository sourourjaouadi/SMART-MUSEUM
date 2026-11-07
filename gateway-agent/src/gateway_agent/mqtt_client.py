"""
Module  : gateway_agent.mqtt_client
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : publication MQTT QoS 1 avec reconnexion automatique (tâche A2) et
          statut online / message LWT offline retenu (tâche A3).
"""

from __future__ import annotations

import json
import logging
import threading
from typing import Optional

import paho.mqtt.client as mqtt

from .config import Config
from .measurement import utc_now_iso

log = logging.getLogger("gateway_agent.mqtt")


def status_payload(cfg: Config, status: str, **extra) -> str:
    body = {"status": status, "gatewayId": cfg.gateway_id, "deviceId": cfg.device_id}
    body.update(extra)
    return json.dumps(body, separators=(",", ":"))


class Publisher:
    """Client MQTT de la passerelle.

    - connexion asynchrone : l'agent démarre même si le broker est absent ;
    - reconnexion automatique avec délai croissant (1 s à 30 s) ;
    - les messages QoS 1 publiés hors connexion sont mis en file et renvoyés ;
    - le broker publie le LWT « offline » (retenu) si l'agent disparaît.
    """

    def __init__(self, cfg: Config) -> None:
        self.cfg = cfg
        self.status_topic = cfg.topic("status")
        self.telemetry_topic = cfg.topic("telemetry")
        self._connected = threading.Event()
        client_id = f"{cfg.gateway_id}-{cfg.device_id}"
        self._client = mqtt.Client(
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            client_id=client_id,
            protocol=mqtt.MQTTv311,
        )
        if cfg.mqtt.username:
            self._client.username_pw_set(cfg.mqtt.username, cfg.mqtt.password)
        if cfg.mqtt.tls.enabled:
            self._client.tls_set(ca_certs=cfg.mqtt.tls.ca_certs)
        # A3 : message de dernière volonté, retenu, publié par le broker.
        self._client.will_set(
            self.status_topic,
            payload=status_payload(cfg, "offline", reason="lwt"),
            qos=1,
            retain=True,
        )
        self._client.reconnect_delay_set(min_delay=1, max_delay=30)
        self._client.max_inflight_messages_set(20)
        self._client.max_queued_messages_set(5000)
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect

    # -- callbacks -------------------------------------------------------
    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0 or getattr(reason_code, "is_failure", False) is False:
            log.info("connecté à %s:%s", self.cfg.mqtt.host, self.cfg.mqtt.port)
            self._connected.set()
            # A3 : statut « online » retenu à chaque (re)connexion.
            client.publish(
                self.status_topic,
                status_payload(self.cfg, "online", at=utc_now_iso()),
                qos=1,
                retain=True,
            )
        else:
            log.error("connexion MQTT refusée : %s", reason_code)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self._connected.clear()
        log.warning("déconnecté du broker (%s) : reconnexion automatique", reason_code)

    # -- API -------------------------------------------------------------
    def start(self) -> None:
        self._client.connect_async(self.cfg.mqtt.host, self.cfg.mqtt.port, keepalive=self.cfg.mqtt.keepalive)
        self._client.loop_start()

    @property
    def connected(self) -> bool:
        return self._connected.is_set()

    def publish_measurement(self, message: dict) -> mqtt.MQTTMessageInfo:
        return self._client.publish(
            self.telemetry_topic,
            json.dumps(message, separators=(",", ":"), ensure_ascii=False),
            qos=self.cfg.mqtt.qos,
            retain=False,
        )

    def stop(self, timeout: float = 3.0) -> None:
        """Arrêt propre : statut « offline » volontaire, puis déconnexion."""
        if self._connected.is_set():
            info = self._client.publish(
                self.status_topic,
                status_payload(self.cfg, "offline", reason="shutdown", at=utc_now_iso()),
                qos=1,
                retain=True,
            )
            try:
                info.wait_for_publish(timeout)
            except Exception:  # pragma: no cover
                pass
        self._client.disconnect()
        self._client.loop_stop()
