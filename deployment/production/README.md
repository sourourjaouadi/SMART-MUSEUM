# Production server

One Ubuntu 24.04 VM: Nginx (HTTPS), WildFly (five WARs) and MongoDB. Only 22, 80, 443 and
8883 are public. WildFly (8180), CORE/IAM (8443), management (9990) and MongoDB (27017)
listen on loopback. Mosquitto and Node-RED: see [`mosquitto/README.md`](../../mosquitto/README.md).

## Status

Rehearsed on 2026-11-23 in Linux containers with the production profile and an
authenticated MongoDB: configuration, deployment, refused and failed releases, rollback,
Nginx isolation and headers, database backup and restore, and 46 browser checks of the
Admin to Client workflow.

**Not run yet**, because they need a real server: `setup-server.sh` as a whole (packages,
firewall, systemd start), `enable-https.sh` (Let's Encrypt) and the MQTT broker. The WARs of
the rehearsal were built from branch `feature/p3-demo-workflow`.

## 1. Server and names

- VM with a public IP, Ubuntu 24.04, 4 GB of RAM recommended, SSH key sign-in.
- Open 22, 80, 443 and 8883 in the **cloud provider** firewall too.
- Three names pointing to that IP. A bought domain is not required:
  - **DuckDNS** (free): create three names, for example `<team>-client`, `<team>-admin` and
    `<team>-api` under `duckdns.org`. It is on the Public Suffix List, so the Let's Encrypt
    limit is not shared with other users.
  - **sslip.io** (no account): `client.<ip-with-dashes>.sslip.io` and so on. Use it as a
    fallback only: its Let's Encrypt limit is shared.

## 2. Install

```bash
git clone https://github.com/sourourjaouadi/SMART-MUSEUM.git && cd SMART-MUSEUM
sudo mkdir -p /etc/smart-museum
sudo cp deployment/production/server.env.example /etc/smart-museum/server.env
sudo nano /etc/smart-museum/server.env          # the three names and a contact email
sudo deployment/production/setup-server.sh      # asks for the first ADMIN account
```

Secrets are generated on the server in `/etc/smart-museum/prod.env` (root only) and are never
printed. Do not copy them to Git, chat or Vite variables.

## 3. Build and deploy

On a development PC, then copy the five WARs to the server:

```powershell
.\deployment\build-all.ps1 -ApiBaseUrl https://<API_HOST>/api
```

```bash
sudo deployment/production/deploy-wars.sh ~/wars    # optional SHA256SUMS file is verified
sudo DRY_RUN=1 deployment/production/enable-https.sh  # Let's Encrypt staging check
sudo deployment/production/enable-https.sh
```

`deploy-wars.sh` deploys CORE, IAM, API, Client, Admin, checks their health, and restores
the previous release if anything fails. Undo a release with `deploy-wars.sh --rollback`.

After the first ADMIN sign-in, remove the three `BOOTSTRAP_ADMIN_*` lines from
`/etc/smart-museum/prod.env` and run `sudo systemctl restart smart-museum-wildfly`.

## 4. Check

```bash
curl -fsS https://<API_HOST>/api/health            # "UP" for status and mongo
curl -s -o /dev/null -w '%{http_code}\n' https://<API_HOST>/core/health   # must be 404
sudo ss -ltn                                       # only 22, 80, 443, 8883 off loopback
sudo journalctl -u smart-museum-wildfly -n 50
```

Then follow [`DOCS/P3_DEMO_SCRIPT.md`](../../DOCS/P3_DEMO_SCRIPT.md) with the public URLs. It is
added by branch `feature/p3-demo-workflow`.

## Operations

- Backup: `sudo deployment/production/backup-db.sh /root/museum-$(date +%F).gz`. Keep it private.
- Restore: `sudo deployment/production/backup-db.sh --restore <file>` (asks for confirmation).
- Host name change: edit `server.env` and `CORS_ALLOWED_ORIGINS` in `prod.env`, run
  `setup-server.sh`, rebuild the PWAs with the new API URL, deploy, then request a new certificate.
- The internal certificate is valid for 825 days.
