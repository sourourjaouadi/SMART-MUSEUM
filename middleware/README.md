# Middleware Smart Museum (P2)

Jakarta EE 11, WildFly 41/42, Java 21, MongoDB via Jakarta NoSQL et Jakarta Data (Eclipse JNoSQL).

## Architecture: three independently deployed applications
`middleware/pom.xml` builds three WARs and one shared HTTP-contract JAR. The
contracts JAR contains DTOs and the internal name-binding annotation, not
service implementations.

| Module | Role | Routes and implementation |
|---|---|---|
| `contracts` JAR | Shared request/response DTOs and errors, packaged into each WAR | No CDI services or persistence |
| `core` WAR | Museum business logic and collections `devices`, `measurements`, `things` | Internal `/core/internal/core/*`; `core.entity`, `core.data`, `core.repository`, `core.validation`, `core.wot`, `core.startup` |
| `iam` WAR | Accounts, collection `users`, BCrypt, JWT, role and zone checks | Internal `/iam/internal/iam/*`; `iam.security`, `iam.entity`, `iam.data`, `iam.repository`, `iam.startup` |
| `api` WAR | Public REST endpoints, CORS and HTTP clients to CORE/IAM | Public routes remain `/api/*`; final artifact is `smart-museum.war` |

The applications communicate through HTTP authenticated with
`X-Internal-Service-Token`; there is no CDI injection across deployments. The
public API preserves its current URLs and responses. CORE and IAM contexts are
internal service routes and must not be routed to public clients.

## Local DEV middleware (Windows / PowerShell)

The DEV profile is locked to the isolated `museum-m2-sandbox-mongo` container,
loopback port 27018 and database `museum_m2_sandbox`. Do not use
`docker-compose.dev.yml` for M2 runtime testing: that older file names the
original `museum-mongo` container and `backend_mongo-data` volume.

From the repository root:

```powershell
docker compose -f middleware/docker-compose.m2-sandbox.yml up -d
docker inspect museum-m2-sandbox-mongo --format '{{.State.Status}} {{json .NetworkSettings.Ports}}'
.\deployment\initialize-dev-environment.ps1 -CreateBootstrapAdmin
```

The initializer creates random service and JWT secrets without printing them,
then prompts for a sandbox admin password without echoing it. Keep `dev.env`
local; `.env` files are not automatically loaded by WildFly. The repo
`.gitignore` excludes `middleware/config/*.env`. Omit `-CreateBootstrapAdmin`
to skip account creation.

If `dev.env` was created before the independent services were added, update
only its new internal token with:

```powershell
.\deployment\Set-InternalServiceToken.ps1
```

The script preserves the existing JWT and ingest secrets. Use `-Rotate` only
when deliberately rotating the inter-service token in the same DEV process.

```powershell
$env:WILDFLY_HOME = 'C:\wildfly-41.0.1.Final\wildfly-42.0.0.Final'
.\deployment\start-wildfly.ps1 -Profile dev
```

`start-wildfly.ps1` imports the ignored `middleware/config/dev.env` into its
process, validates the profile, refuses occupied HTTP/management ports, and
starts WildFly in the current console. API validates its service URLs, CORS and
service tokens; CORE validates its Mongo/seed settings and IAM validates its
Mongo/JWT/bootstrap settings. CORE and IAM each connect
to the isolated DEV database; only CORE seeds museum devices. Use
`SEED_DEVICES=true` only with this isolated DEV profile.

Build all three independently packaged WARs from the repo root:

```powershell
.\deployment\build-all.ps1
```

This runs Client and Admin tests/builds, packages their WARs, then runs the
middleware parent `clean verify`. Expected artifacts are:

```text
pwa-client/deployment/target/smart-museum-client.war
pwa-admin/deployment/target/smart-museum-admin.war
middleware/core/target/smart-museum-core.war
middleware/iam/target/smart-museum-iam.war
middleware/api/target/smart-museum.war
```

## Verifier
Open these health URLs in Edge using the Windows user profile where the local
mkcert CA is trusted:

- `https://api.smartmuseum.test/api/health`
- `http://localhost:8080/core/health`
- `http://localhost:8080/iam/health`

Each should return HTTP 200 with status and Mongo reported as `UP`. For a
repeatable strict TLS and integration check, use
`deployment/test-m2-runtime.ps1 -ConfirmSandboxWrites` after confirming the DEV
database is the isolated sandbox. Windows Schannel curl may return
`CRYPT_E_NO_REVOCATION_CHECK` for this local CA; do not disable certificate
validation.
The CORE and IAM health routes are independent probes; their internal operation
routes require `X-Internal-Service-Token`.
Les endpoints `/api/devices` et de mesures exigent maintenant un JWT Bearer; voir
la section Authentification ci-dessous.

For local HTTPS setup, follow `deployment/README.md`. Public browser origins
use the standard HTTPS port (no port in the URL): Client `https://smartmuseum.test/`, Admin
`https://admin.smartmuseum.test/`, and API
`https://api.smartmuseum.test/api`. CORE and IAM are internal services;
they run on the internal loopback-only server; their health probes are
`http://localhost:8080/core/health` and
`http://localhost:8080/iam/health`, but their business routes are not public.
HTTP requests to the public hosts redirect to HTTPS. Do not disable certificate
validation if Windows curl reports its revocation-check limitation with the
local mkcert certificate; use a browser with the installed Current User CA or
OpenSSL with the local root CA file.

## Variables
| Variable | Defaut | Role |
|---|---|---|
| JNOSQL_MONGODB_HOST | required; DEV is localhost:27018 | Host MongoDB (Jakarta NoSQL, MicroProfile Config) |
| JNOSQL_DOCUMENT_DATABASE | required; DEV is museum_m2_sandbox | Database name |
| CORE_SERVICE_URL | required; DEV is http://localhost:8080/core | CORE internal service base URL |
| IAM_SERVICE_URL | required; DEV is http://localhost:8080/iam | IAM internal service base URL |
| INTER_SERVICE_TOKEN | required, >= 32 characters | API-to-CORE/IAM authentication secret |
| INGEST_SERVICE_TOKEN | required, >= 32 characters | Node-RED -> middleware token |
| CORS_ALLOWED_ORIGINS | required | Exact PWA origins, comma separated |
| JWT_SIGNING_KEY_BASE64 | (obligatoire, 32 octets aleatoires minimum) | Cle HMAC JWT Base64, uniquement cote serveur |
| JWT_ISSUER | smart-museum | Valeur issuer attendue dans les JWT |
| JWT_ACCESS_TOKEN_SECONDS | 900 | Duree de vie du jeton (60 a 3600 secondes) |
| BOOTSTRAP_ADMIN_NAME / EMAIL / PASSWORD | (tous optionnels, ensemble) | Cree le premier ADMIN actif s'il n'existe pas; variables serveur seulement |
| MQTT_BROKER_URI | required | MQTT base used in seeded Thing Description forms |
| SEED_DEVICES | required; DEV true, PROD false | Seeds two sample devices and their zones (sample Tunis coordinates) only in DEV |
| SMART_MUSEUM_ENV | required: dev or prod | Startup safety profile |
| TLS_KEYSTORE_PATH / TLS_KEYSTORE_PASSWORD | required for local WildFly HTTPS | Local PKCS#12 path and password; generated/configured by `deployment/prepare-local-https.ps1`, stored only in ignored `dev.env` |

`middleware/config/dev.properties` documents non-secret DEV properties;
`prod.properties.example` and `prod.env.example` are templates only. The
MicroProfile/JNoSQL file contains the provider but intentionally has no database
or host defaults. JNoSQL obtains those from the WildFly process environment.
For PROD, supply the complete environment from the service/secret manager and
start with `deployment/start-wildfly.ps1 -Profile prod -UseParentEnvironment`.
Keep `SEED_DEVICES=false`; bootstrap is optional and occurs only when all three
bootstrap values are deliberately provided together. Remove them after setup.
JNoSQL 1.1.20 requires Jakarta Data 1.0.2. The Maven dependency is aligned to
1.0.2 and the API is server-provided; the installed WildFly 42 module contains
1.0.2, so the WAR does not bundle a second Jakarta Data API jar.

## Persistance : Jakarta NoSQL + Jakarta Data
- Entites Jakarta NoSQL (`@Entity`, `@Id`, `@Column`) dans `core/entity/` : `DeviceEntity` (devices),
  `MeasurementEntity` (measurements), `ThingEntity` (things), `ZoneEntity` (zones).
- Repositories Jakarta Data (`@Repository`, `BasicRepository`, `@Insert`, requetes par nom de methode)
  dans `core/data/`, implementes a l'execution par Eclipse JNoSQL 1.1 (Jakarta Data 1.0).
- Configuration per application in `core/src/main/resources/META-INF/` and
  `iam/src/main/resources/META-INF/microprofile-config.properties` (MicroProfile
  Config supplied by WildFly).
- Les `_id` MongoDB sont les identifiants metier (deviceId, measurementId). Aucun
  effacement ou changement de volume n'est requis pour la modularisation M2.

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
2. Le middleware valide l'identifiant et la TD, puis enregistre l'appareil en `pending` (201).
   Une nouvelle annonce d'un appareil connu met a jour sa TD sans changer son statut (200) ;
   un appareil `rejected` ou une zone differente est refuse (403).
3. Un ADMIN authentifie liste `GET /api/devices?status=pending`, consulte `GET /api/things/{deviceId}`,
   puis `POST /api/devices/{deviceId}/approve` (ou `/reject`) avec un JWT Bearer.
4. Les mesures ne sont acceptees que pour un appareil `active`, et seulement pour les
   proprietes (et unites) declarees dans sa TD.

`GET /api/devices/{deviceId}` renvoie un en-tete RFC 8288
`Link: <.../api/things/{deviceId}>; rel="describedby"; type="application/td+json"`.

## Geolocalisation des zones et des appareils
Systeme de coordonnees : WGS84 (latitude/longitude en degres decimaux) et numero d'etage
optionnel (`floor`). Une zone (collection `zones`) a un `zoneId`, un `name` et une `location`.
Un appareil a soit sa localisation propre, soit herite de celle de sa zone : `GET /api/devices`
renvoie alors les champs optionnels `location` et `locationSource` (`device` ou `zone`), absents
si aucune coordonnee n'est connue. Affecter une localisation ne modifie jamais le `zoneId`
(lie a la TD et au topic MQTT).

| Methode | Endpoint | Acces |
|---|---|---|
| GET | `/api/zones` | Bearer ; ADMIN toutes les zones, CLIENT seulement ses zones |
| GET | `/api/zones/{zoneId}` | Bearer ; zone non attribuee au CLIENT -> 403 (avant tout 404) |
| PUT | `/api/zones/{zoneId}` | ADMIN ; corps `{ "name", "location": { "latitude", "longitude", "floor" } }`, idempotent |
| PUT | `/api/devices/{deviceId}/location` | ADMIN ; corps `{ "latitude", "longitude", "floor" }` |
| DELETE | `/api/devices/{deviceId}/location` | ADMIN ; l'appareil herite a nouveau de sa zone |

Validation (CORE, `LocationService`) : latitude dans [-90, 90], longitude dans [-180, 180],
toutes deux obligatoires ; `floor` entier dans [-10, 200] ; `name` de 1 a 100 caracteres ->
sinon 400. Zone ou appareil inconnu -> 404. Appareil `pending` ou `rejected` -> 409
(`active` et `offline` ont ete approuves). Les routes internes correspondantes sont
`/internal/core/zones...` et `/internal/core/devices/{id}/location`.

Avec `SEED_DEVICES=true` (DEV), `SeedBean` cree `salle-01` et `salle-02` avec des
**coordonnees d'exemple fictives dans le centre de Tunis** (pas un batiment reel), seulement
si la zone n'existe pas : les modifications ADMIN sont conservees au redemarrage.

Demonstration : dossier `Geolocalisation` de `postman/smart-museum-v1.postman_collection.json`.
Renseigner localement `adminEmail`/`adminPassword` (jamais dans Git), executer `Login ADMIN`
puis les requetes dans l'ordre contre `{{apiUrl}}` (`https://api.smartmuseum.test`).
Postman doit faire confiance a l'AC mkcert locale (`%LOCALAPPDATA%\mkcert\rootCA.pem`).

## Authentification et autorisation des PWA

Les comptes sont stockes dans la collection MongoDB `users`. L'identifiant MongoDB
est l'adresse email normalisee en minuscules, ce qui impose son unicite au niveau
de la base; `userId` est un UUID. Les mots de passe sont stockes en BCrypt (cost 12)
et ne sont jamais inclus dans les DTO de compte. Les mots de passe doivent avoir au
moins 12 caracteres et au plus 72 octets UTF-8.

### Configuration et premier ADMIN

Le serveur refuse de demarrer si `JWT_SIGNING_KEY_BASE64` est absent, invalide ou
decode en moins de 32 octets. Generer une cle aleatoire (ne pas reutiliser la cle
de test ou une valeur d'exemple) :

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Fournir la cle via un gestionnaire de secrets ou l'environnement du processus WildFly.
Les identifiants et jetons doivent transiter en HTTPS hors de la boucle locale.
`JWT_ISSUER` vaut `smart-museum` par defaut. `JWT_ACCESS_TOKEN_SECONDS` vaut 900
par defaut et accepte 60 a 3600 secondes. La cle de signature, les mots de passe,
les jetons et les hashes ne doivent jamais etre places dans `VITE_*` ni journalises.

Pour le premier demarrage, definir ensemble `BOOTSTRAP_ADMIN_NAME`,
`BOOTSTRAP_ADMIN_EMAIL` et `BOOTSTRAP_ADMIN_PASSWORD` cote serveur. Le compte est
cree actif avec le role ADMIN si l'adresse n'existe pas. Au redemarrage, un compte
ADMIN deja actif est conserve sans reinitialiser son mot de passe; une collision
avec un compte non-ADMIN ou desactive echoue sans changer ce compte. Retirer ces
variables apres le bootstrap. Utiliser une console securisee/secret manager pour
la valeur du mot de passe (ne pas le mettre dans un script versionne).

### Jetons et roles

`POST /api/auth/login` accepte `{ "email", "password" }` et renvoie un JWT signe
HS256, `tokenType: Bearer`, `expiresIn` et un DTO utilisateur sans hash. Le JWT
contient seulement `sub` (UUID utilisateur), `role`, `iat`, `exp` et `iss`.
Les endpoints proteges exigent `Authorization: Bearer <accessToken>`. Il n'y a
pas de refresh token ni de liste de revocation: logout signifie supprimer le jeton
du client, et un jeton vole reste utilisable jusqu'a expiration. Les comptes
desactives et les changements de role invalident l'acces car le compte actif et
son role sont relus dans MongoDB a chaque requete. Les zones sont egalement relues
depuis le compte; aucune zone fournie par le navigateur ou le JWT n'accorde l'acces.

Un ADMIN peut lire l'inventaire complet, consulter les Thing Descriptions, approuver
ou rejeter les appareils, et creer un compte CLIENT avec zones assignees via
`POST /api/users`. Un CLIENT ne voit que les appareils et mesures de ses zones.
Une affectation vide n'accorde aucun acces. La lecture des Thing Descriptions est
ADMIN seulement. Les comptes CLIENT sont provisionnes par un ADMIN; l'interface
de gestion complete, modification/desactivation des comptes et Zone CRUD restent
hors de cette phase.

Les jetons humains ne remplacent pas les jetons de service. `POST /api/things` et
`POST /api/ingest/measurements` continuent d'exiger `X-Service-Token` cote serveur.
`ADMIN_TOKEN` / `X-Admin-Token` n'est plus accepte pour les actions navigateur.

### Essai local

Apres le bootstrap et le deploiement, saisir les identifiants du compte ADMIN
configure localement. Ne pas inscrire les identifiants dans une commande ou un
fichier versionne :

```powershell
$email = Read-Host "Admin email"
$securePassword = Read-Host "Admin password" -AsSecureString
$password = [Net.NetworkCredential]::new('', $securePassword).Password
$body = @{ email = $email; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri https://api.smartmuseum.test/api/auth/login -ContentType application/json -Body $body
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri https://api.smartmuseum.test/api/devices -Headers $headers
$password = $null
```

Les requetes CLIENT vers des zones non assignees renvoient `403 FORBIDDEN`;
les jetons absents, invalides ou expires renvoient `401 UNAUTHORIZED`.

### Limites de rotation

La configuration active accepte une seule cle HMAC. Remplacer la cle invalide
immediatement tous les jetons emis precedemment; les utilisateurs doivent se
reconnecter. Une rotation sans interruption (ancienne + nouvelle cle), refresh
tokens, recupération de mot de passe, invitations et protections anti-brute-force
ne sont pas implementees dans cette fondation.
