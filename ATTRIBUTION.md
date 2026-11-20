## 👥 1. Identification de l'Équipe
*   **Projet (Nom) :** Smart museum
*   **Équipe (Numéro) :** 4
*   **Membres :**
    *   Membre 1 (Prénom, Nom) : Sirine Ben Yahia
    *   Membre 2 (Prénom, Nom) : Sourour Jaouadi
    *   Membre 3 (Prénom, Nom) : Yesmine Haddar

---

## 🧠 2. Usage des Assistants de Génération (IA)
*Cochez l'option qui correspond à votre réalité et détaillez le périmètre.*

*   [ ] **Option A :** Aucun outil de génération de code par IA n'a été utilisé.
*   [ ] **Option B :** Utilisation modérée (Aide au débogage, génération de fonctions isolées, documentation).
*   [x] **Option C :** Utilisation intensive (Génération de structures de dossiers, squelettes d'API complets, scripts de déploiement).

### 📝 Journal des invites (Prompts) notables et composants générés par IA :

| Composant / Module | Outil utilisé (ChatGPT/Claude/Copilot...) | Description du prompt ou du rôle confié à l'IA |
| :--- | :--- | :--- |
| Passerelle : lecture du capteur BME280 et mesures conformes au contrat | Claude sonnet 5.5 | Génération du code de lecture du capteur et de la mise en forme des mesures selon le contrat d'API, avec une configuration sans secret. Relu et modifié ligne par ligne. |
| Passerelle : publication MQTT, QoS 1, reconnexion, statut online, LWT | Claude sonnet 5.5 | Rédaction du client MQTT avec reconnexion automatique, publication du statut et message de dernière volonté. Revu et adapté. |
| Passerelle : service systemd et documentation de l'agent | Claude sonnet 5.5 | Rédaction du fichier de service systemd, des exemples de configuration et du README de l'agent. |
| Passerelle : simulateur de la deuxième zone | Claude sonnet 5.5 | Génération d'un simulateur de mesures, étiqueté simulated, pour la deuxième zone. |
| P1 : annonce de la Thing Description (passerelle et relais Node-RED) | Claude Opus 5.5 | Génération de la publication de la TD W3C WoT sur `.../td`, de sa validation dans Node-RED et du relais vers `POST /api/things`, avec les tests. À relire avant la démonstration. |
| P1 : broker Mosquitto (dev et production TLS 8883, comptes, ACL) et Docker Compose | Claude Opus 5.5 | Génération des configurations Mosquitto, des fichiers Compose, des scripts de certificats et de comptes MQTT, et de leur documentation. |
| P1 : tests du flux Node-RED et audit IoT | Claude Opus 5.5 | Génération de tests automatiques des nœuds du flux Node-RED et du rapport d'audit `DOCS/P1_IOT_AUDIT.md`. |
| middleware : temps de réponse constant au login | Claude sonnet 5.5 | Correction de sécurité pour ne pas révéler l'existence d'un email par le temps de réponse. |
| middleware : architecture et persistance MongoDB | ChatGPT + Codex | Assistance à la structuration du backend Jakarta EE, de la couche Repository et de la persistance MongoDB pour les utilisateurs, appareils, mesures et Thing Descriptions. |
| Authentification et sécurité | ChatGPT + Codex | Implémentation de l'authentification avec BCrypt, génération et validation de JWT à durée limitée, gestion des rôles ADMIN/CLIENT et contrôle d'accès par zone. |
| API REST sécurisées | ChatGPT + Codex | Mise en place des endpoints d'authentification, de gestion des utilisateurs, des appareils et des mesures, avec vérification des autorisations côté serveur. |
| Validation et ingestion IoT | ChatGPT + Codex | Assistance à la conception de la chaîne de validation des mesures, à la détection des doublons et à leur stockage persistant dans MongoDB. |
| Documentation technique : handoff | ChatGPT + Codex | Génération d'une documentation technique pour le transfert du module d'authentification : architecture, API, configuration, sécurité et tests. |
| Client PWA : intégration backend | ChatGPT + Codex | Préparation d'un prompt d'intégration pour connecter l'interface Client aux API REST, gérer le login JWT et afficher les appareils et mesures réelles tout en conservant le mode démo. |
| Admin PWA : intégration backend | ChatGPT + Codex | Définition des étapes d'intégration future de l'interface administrateur : authentification ADMIN, inventaire des appareils, approbation et rejet. |

---

## 📚 3. Emprunts, Squelettes de Cours & Plagiat
*Précisez si vous avez utilisé une base de code préexistante.*

*   **Code de départ enseignant / squelette du cours :**
    *   [ ] Oui (indiquer quels modules : ________________________)
    *   [x] Non
*   **Réutilisation d'anciens projets (Années précédentes / GitHub externes) :**
    *   [ ] Oui (Lien du dépôt d'origine : `https://github.com...`)
    *   [x] Non
    *   *Si Oui, listez les fichiers ou concepts importés directement :* ________________________

---

## 🛠️ 4. Répartition Réelle de l'Écriture du Code
*Indiquez la provenance réelle (en %) des lignes de code actuellement sur votre branche principale.*

| Module / Composant | % Écrit à la main par l'équipe | % Généré par IA | % Emprunté / Réutilisé |
| :--- | :---: | :---: | :---: |
| **Passerelle IoT / Node-RED / Edge** | 10 % | 90 % | 0 % |
| **Backend / API REST / Middleware** | 10 % | 90 % | 0 % |
| **Sécurité (IAM / Keycloak / mTLS)** | 5 % | 95 % | 0 % |
| **Frontend / PWA** | 10 % | 90 % | 0 % |
| **Scripts d'Infra / Déploiement** | 10 % | 90 % | 0 % |

---

## ✍️ 5. Engagement sur l'Honneur
En validant ce fichier sur notre dépôt GitHub, nous certifions sur l'honneur que les déclarations ci-dessus sont exactes, sincères et reflètent fidèlement notre processus de développement. Nous sommes conscients que la falsification de ce document ou la non-maîtrise technique du code déclaré comme "écrit par l'équipe" lors des soutenances entraînera une **pénalité immédiate et sévère sur la note globale**.

*   [x] **Lu et approuvé par l'ensemble des membres de l'équipe.**
*   **Date de dernière mise à jour :** 16/11/2026
