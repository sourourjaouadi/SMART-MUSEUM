"""
Module  : gateway_agent.simulator
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : capteur simulé pour la 2e zone et pour les tests (tâche A8).
          Marche aléatoire bornée dans les plages de validation du backend.
"""

from __future__ import annotations

import random
from typing import Dict


class SimulatedSensor:
    """Les valeurs restent dans les plages de validation du backend."""

    BOUNDS = {
        "temperature": (-40.0, 85.0),
        "humidity": (0.0, 100.0),
        "pressure": (300.0, 1100.0),
    }

    def __init__(self, seed: int | None = None) -> None:
        self._rng = random.Random(seed)
        self._state = {"temperature": 21.0, "humidity": 48.0, "pressure": 1013.0}
        self._step = {"temperature": 0.15, "humidity": 0.6, "pressure": 0.4}
        self._centre = dict(self._state)

    def read(self) -> Dict[str, float]:
        for prop, value in self._state.items():
            drift = (self._centre[prop] - value) * 0.05  # rappel vers la valeur centrale
            value += drift + self._rng.uniform(-self._step[prop], self._step[prop])
            low, high = self.BOUNDS[prop]
            self._state[prop] = min(max(value, low), high)
        return dict(self._state)

    def close(self) -> None:
        pass
