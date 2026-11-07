# Backend Smart Museum (P2)

Jakarta EE 11, WildFly 41/42, Java 21, MongoDB via Jakarta NoSQL et Jakarta Data (Eclipse JNoSQL).

## Lancer en local (Windows / PowerShell)
```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d        # MongoDB
mvn clean package                                      # tests + target/smart-museum.war
copy target\smart-museum.war C:\wildfly-41.0.1.Final\standalone\deployments\
$env:INGEST_SERVICE_TOKEN = "dev-token"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173"
$env:ADMIN_TOKEN = "admin-dev-token"
C:\wildfly-41.0.1.Final\bin\standalone.bat
```
Les variables d'environnement doivent etre definies dans le terminal qui lance WildFly.

## Verifier
```powershell
curl.exe http://localhost:8080/api/health
curl.exe http://localhost:8080/api/devices
```

## Variables
| Variable | Defaut | Role |
|---|---|---|
| JNOSQL_MONGODB_HOST | localhost:27017 | Hote MongoDB (Jakarta NoSQL, MicroProfile Config) |
| JNOSQL_DOCUMENT_DATABASE | museum | Base MongoDB |
| INGEST_SERVICE_TOKEN | (obligatoire) | Jeton Node-RED -> backend |
| CORS_ALLOWED_ORIGINS | http://localhost:5173 | Origines des PWA |
| ADMIN_TOKEN | (obligatoire pour approuver) | Jeton ADMIN provisoire (en-tete X-Admin-Token) |
| MQTT_BROKER_URI | mqtt://localhost:1883 | Base des liens "forms" des TD semees |
| SEED_DEVICES | true | Cree bme280-01 (salle-01) et sim-bme280-02 (salle-02), actifs, avec leur TD |

## Persistance : Jakarta NoSQL + Jakarta Data
- Entites Jakarta NoSQL (`@Entity`, `@Id`, `@Column`) dans `entity/` : `DeviceEntity` (devices),
  `MeasurementEntity` (measurements), `ThingEntity` (things).
- Repositories Jakarta Data (`@Repository`, `BasicRepository`, `@Insert`, requetes par nom de methode)
  dans `data/`, implementes a l'execution par Eclipse JNoSQL 1.1 (Jakarta Data 1.0).
- Configuration dans `src/main/resources/META-INF/microprofile-config.properties`
  (MicroProfile Config fourni par WildFly).
- Les `_id` MongoDB sont les identifiants metier (deviceId, measurementId) : une base creee
  avec l'ancienne version doit etre videe (`docker compose -f docker-compose.dev.yml down -v`).

## Codes de reponse de POST /api/ingest/measurements
202 acceptee, 200 doublon, 400 schema, 401 jeton, 403 appareil inconnu/non fiable,
422 hors plage (OUT_OF_RANGE) ou propriete/unite absente de la Thing Description (UNDECLARED_PROPERTY).

Chaine de validation : schema -> identite -> plage/qualite -> confiance (active) -> affordance WoT -> persistance.

## W3C WoT Thing Description et decouverte
Chaque appareil a une Thing Description W3C WoT 1.1 en JSON-LD 1.1 (collection `things`) :
`@context` = `https://www.w3.org/2022/wot/td/v1.1`, `id` = `urn:museum:device:{deviceId}`, `title`,
`securityDefinitions`/`security`, et ses affordances `properties`, `actions`, `events`, chacune avec ses `forms`.

1. Node-RED recoit l'annonce MQTT sur `museum/v1/{zoneId}/{deviceId}/td` et la relaie :
   `POST /api/things` (jeton X-Service-Token), corps `{ "deviceId", "zoneId", "gatewayId", "type", "td": { ... } }`.
2. Le backend valide l'identifiant et la TD, puis enregistre l'appareil en `pending` (201).
   Une nouvelle annonce d'un appareil connu met a jour sa TD sans changer son statut (200) ;
   un appareil `rejected` ou une zone differente est refuse (403).
3. L'ADMIN liste `GET /api/devices?status=pending`, consulte `GET /api/things/{deviceId}`,
   puis `POST /api/devices/{deviceId}/approve` (ou `/reject`) avec l'en-tete X-Admin-Token.
4. Les mesures ne sont acceptees que pour un appareil `active`, et seulement pour les
   proprietes (et unites) declarees dans sa TD.

`GET /api/devices/{deviceId}` renvoie un en-tete RFC 8288
`Link: <.../api/things/{deviceId}>; rel="describedby"; type="application/td+json"`.

## A faire plus tard
Authentification ADMIN/CLIENT et RBAC par zone sur les endpoints de lecture (S3-S4) ;
le jeton ADMIN_TOKEN est provisoire et sera remplace par le role ADMIN.
