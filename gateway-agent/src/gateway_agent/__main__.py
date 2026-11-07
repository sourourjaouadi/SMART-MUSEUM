"""
Module  : gateway_agent.__main__
Auteur  : P1 (passerelle, MQTT, Node-RED)
Date    : 2026-11-01
Version : 1.0
Rôle    : point d'entrée : python -m gateway_agent --config config.yaml
"""

from __future__ import annotations

import argparse
import logging
import sys

from .agent import run
from .config import ConfigError, load_config


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="gateway_agent", description="Agent passerelle Smart Museum")
    parser.add_argument("--config", help="fichier YAML (voir config.yaml.example)")
    parser.add_argument("--once", action="store_true", help="une seule lecture puis arrêt")
    parser.add_argument("--no-mqtt", action="store_true", help="lire et afficher sans publier (test du capteur)")
    args = parser.parse_args(argv)

    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        print(f"Erreur de configuration : {exc}", file=sys.stderr)
        return 2

    logging.basicConfig(
        level=getattr(logging, cfg.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    return run(cfg, once=args.once, no_mqtt=args.no_mqtt)


if __name__ == "__main__":
    sys.exit(main())
