# Backend Smart Museum (P2)

Jakarta EE 11, WildFly 41/42, Java 21, MongoDB via Jakarta NoSQL et Jakarta Data (Eclipse JNoSQL).

## Lancer en local (Windows / PowerShell)
```powershell
cd backend
docker compose -f docker-compose.dev.yml up -d        # MongoDB
mvn clean package                                      # tests + target/smart-museum.war
copy target\smart-museum.war C:\wildfly-41.0.1.Final\standalone\deployments\
$env:INGEST_SERVICE_TOKEN = "dev-token"
$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:5174"
$env:JWT_SIGNING_KEY_BASE64 = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:JWT_ISSUER = "smart-museum"
$env:JWT_ACCESS_TOKEN_SECONDS = "900"
# Optional first-run bootstrap; supply real secrets through a protected secret store.
$env:BOOTSTRAP_ADMIN_NAME = "Museum Administrator"
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@museum.example"
# Set BOOTSTRAP_ADMIN_PASSWORD through a protected environment/secret manager.
C:\wildfly-41.0.1.Final\bin\standalone.bat
```
Les variables d'environnement doivent etre definies dans le terminal qui lance WildFly.

## Verifier
```powershell
curl.exe http://localhost:8080/api/health
```
Les endpoints `/api/devices` et de mesures exigent maintenant un JWT Bearer; voir
la section Authentification ci-dessous.

## Variables
| Variable | Defaut | Role |
|---|---|---|
| JNOSQL_MONGODB_HOST | localhost:27017 | Hote MongoDB (Jakarta NoSQL, MicroProfile Config) |
| JNOSQL_DOCUMENT_DATABASE | museum | Base MongoDB |
| INGEST_SERVICE_TOKEN | (obligatoire) | Jeton Node-RED -> backend |
| CORS_ALLOWED_ORIGINS | http://localhost:5173,http://localhost:5174 | Origines locales autorisees pour les PWA |
| JWT_SIGNING_KEY_BASE64 | (obligatoire, 32 octets aleatoires minimum) | Cle HMAC JWT Base64, uniquement cote serveur |
| JWT_ISSUER | smart-museum | Valeur issuer attendue dans les JWT |
| JWT_ACCESS_TOKEN_SECONDS | 900 | Duree de vie du jeton (60 a 3600 secondes) |
| BOOTSTRAP_ADMIN_NAME / EMAIL / PASSWORD | (tous optionnels, ensemble) | Cree le premier ADMIN actif s'il n'existe pas; variables serveur seulement |
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
3. Un ADMIN authentifie liste `GET /api/devices?status=pending`, consulte `GET /api/things/{deviceId}`,
   puis `POST /api/devices/{deviceId}/approve` (ou `/reject`) avec un JWT Bearer.
4. Les mesures ne sont acceptees que pour un appareil `active`, et seulement pour les
   proprietes (et unites) declarees dans sa TD.

`GET /api/devices/{deviceId}` renvoie un en-tete RFC 8288
`Link: <.../api/things/{deviceId}>; rel="describedby"; type="application/td+json"`.

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

Apres le bootstrap et le deploiement du WAR, se connecter avec le compte initial :

```powershell
$body = @{ email = "admin@museum.example"; password = (Read-Host "Password") } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login -ContentType application/json -Body $body
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod -Uri http://localhost:8080/api/devices -Headers $headers
```

Les requetes CLIENT vers des zones non assignees renvoient `403 FORBIDDEN`;
les jetons absents, invalides ou expires renvoient `401 UNAUTHORIZED`.

### Limites de rotation

La configuration active accepte une seule cle HMAC. Remplacer la cle invalide
immediatement tous les jetons emis precedemment; les utilisateurs doivent se
reconnecter. Une rotation sans interruption (ancienne + nouvelle cle), refresh
tokens, recupération de mot de passe, invitations et protections anti-brute-force
ne sont pas implementees dans cette fondation.
