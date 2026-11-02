# Backend Smart Museum (P2)

Jakarta EE 11, WildFly 41.0.1.Final, Java 21, MongoDB.

## Lancer en local (Windows / PowerShell)
```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d        # MongoDB
mvn clean package                                      # tests + target/smart-museum.war
copy target\smart-museum.war C:\wildfly-41.0.1.Final\standalone\deployments\
$env:INGEST_SERVICE_TOKEN = "dev-token"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173"
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
| MONGO_URI | mongodb://localhost:27017 | Connexion MongoDB |
| MONGO_DB | museum | Base |
| INGEST_SERVICE_TOKEN | (obligatoire) | Jeton Node-RED -> backend |
| CORS_ALLOWED_ORIGINS | http://localhost:5173 | Origines des PWA |
| SEED_DEVICES | true | Cree bme280-01 (salle-01) et sim-bme280-02 (salle-02) |

## Codes de reponse de POST /api/ingest/measurements
202 acceptee, 200 doublon, 400 schema, 401 jeton, 403 appareil inconnu/non fiable, 422 hors plage.

## A faire plus tard
Authentification ADMIN/CLIENT et RBAC par zone sur les endpoints de lecture (S3-S4).
