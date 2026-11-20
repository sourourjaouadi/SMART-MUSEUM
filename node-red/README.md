# node-red : flux d'ingestion (P1)

`flows.json` contient un seul onglet « Smart Museum - ingestion (P1) » : l'ingestion des mesures (A6, A7),
le statut des appareils (A3) et le relais des annonces de Thing Description (P1.3).

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

## Annonces de Thing Description (P1.3)

```
mqtt in museum/v1/+/+/td (QoS 1, messages retenus)
   -> « Valider annonce TD » ---- sortie 1 ---> debug + http request POST /api/things
                              \-- sortie 2 ---> « Formater le rejet » (journal)
http request -> « Aiguiller la réponse (TD) »
        201  nouvel appareil enregistré en pending      200  appareil connu : TD mise à jour
        400 / 403 / 422  rejet définitif -> journal (TD invalide, appareil rejeté, autre zone)
        401  jeton refusé                -> alerte + journal
        409 / 5xx / pas de réponse       -> « Nouvel essai (TD) » (même annonce, 2 s ... 60 s)
```

* **Contrat** : corps `{ "deviceId", "zoneId", "gatewayId", "type", "td" }` (`ThingAnnouncement` du middleware),
  envoyé avec `X-Service-Token`.
* **Vérifications** : JSON valide, identifiants (1 à 64 caractères), cohérence topic / `zoneId` / `deviceId`,
  `td` objet, `@context` W3C TD 1.1, `td.id` terminé par le `deviceId`, `title`. Les règles complètes
  (`securityDefinitions`, affordances, `forms`) sont vérifiées par le middleware.
* **Messages retenus** : la passerelle publie son annonce en `retain`. Après un redémarrage de Node-RED,
  l'annonce est relayée de nouveau ; le middleware répond `200` (mise à jour) sans créer de doublon.
* **Test manuel** : le bouton `TEST annonce TD` annonce le nouvel appareil simulé `sim-bme280-03`
  (`salle-02`), qui apparaît en `pending` dans `GET /api/devices?status=pending` et dans la PWA admin.

## Lancer en local

Depuis la racine du dépôt (Docker requis) :

```bash
cp .env.example .env          # renseigner INGEST_SERVICE_TOKEN (= celui du middleware) et BACKEND_URL
docker compose up -d          # Mosquitto (127.0.0.1:1883) + Node-RED (http://localhost:1880)
docker compose logs -f nodered
```

`BACKEND_URL` est l'URL du middleware **vue depuis le conteneur** (sans `/api`). Pour l'API locale en HTTPS
(`https://api.smartmuseum.test`), `API_CA_CERT` doit désigner la racine mkcert publique (`rootCA.pem`) :
voir `.env.example`. Vérifier que Node-RED joint le middleware :

```bash
docker compose exec nodered node -e "fetch(process.env.BACKEND_URL + '/api/health').then(r => r.text()).then(console.log, e => console.error(e.cause || e))"
```

Production (MQTT sur TLS 8883, comptes, ACL, éditeur non public) : [`../mosquitto/README.md`](../mosquitto/README.md).

## Tests automatiques

```bash
node --test node-red/test/flows.test.mjs
```

31 tests, sans Node-RED ni broker : structure de `flows.json` (fils, onglets, abonnements QoS 1, aucun secret),
logique de chaque nœud `function` (validation, `source`, aiguillage 200/202/400/401/403/422/5xx, nouveaux
essais avec le même `measurementId`, abandon, journal) et relais des annonces TD.

Après avoir modifié le flux dans l'éditeur (Deploy), `flows.json` est réécrit : relire le diff et relancer les
tests avant de commiter. Ne jamais commiter `flows_cred.json` ni les fichiers `.config.*.json` (ignorés par Git).
