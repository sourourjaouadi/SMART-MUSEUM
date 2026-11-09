# node-red : flux d'ingestion (P1)

`flows.json` contient un seul onglet « Smart Museum - ingestion (P1) ».

```
mqtt in museum/v1/+/+/telemetry (QoS 1)
   -> « Valider + source » ---- sortie 1 ---> debug (JSON propre) + http request POST /api/ingest/measurements
                            \-- sortie 2 ---> « Formater le rejet » -> rejected.jsonl + debug
http request -> « Aiguiller la réponse »
        202  succès                       200  doublon : succès, pas une erreur
        400 / 403 / 422  rejet définitif -> journal (jamais réessayé)
        401  jeton refusé                -> alerte + journal
        5xx / pas de réponse             -> « Planifier un nouvel essai » (même measurementId, 2 s ... 60 s)
catch (erreur réseau de l'http request) -> même aiguillage
```

* **Validation (A6)** : JSON valide, champs obligatoires, UUID, identifiants (1 à 64 caractères), propriété
  connue, valeur numérique finie, unité, date ISO UTC, cohérence topic / `zoneId` / `deviceId`. Les plages
  de valeurs, le statut de l'appareil et la date future restent validés par le backend (une seule source de vérité).
* **Champ `source`** : `simulated` si `deviceId` commence par `sim-` ou `gatewayId` par `gw-sim`, sinon `real`.
  L'émetteur ne choisit jamais.
* **Journal des rejets (A7)** : une ligne JSON par rejet dans `REJECTED_LOG_FILE`
  (`/data/logs/rejected.jsonl`). Un message cassé n'arrête jamais le flux.
* **Jeton** : variable d'environnement `INGEST_SERVICE_TOKEN` uniquement ; `flows.json` ne contient aucun
  secret (vérifier avant chaque commit, y compris après un export).
* **Variables lues** : `MQTT_HOST`, `MQTT_PORT`, `BACKEND_URL`, `INGEST_SERVICE_TOKEN`, `INGEST_MAX_ATTEMPTS`
  (30 par défaut), `REJECTED_LOG_FILE`.
* **Tests manuels** : les boutons `TEST mesure valide` et `TEST JSON casse` utilisent l'appareil **simulé**
  (`sim-bme280-02`), jamais le capteur réel.

Lancement : `docker compose up -d` à la racine (voir `.env.example`). Éditeur : http://localhost:1880.
Après avoir modifié le flux dans l'éditeur (Deploy), `flows.json` est réécrit : relire le diff avant de commiter.
