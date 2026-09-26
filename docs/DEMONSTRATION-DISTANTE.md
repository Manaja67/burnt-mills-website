# Démonstration distante temporaire

Une instance distincte est lancée sur le port 4311 avec une nouvelle base dans `data/previews/<date>/`. Aucun compte, fichier ou dossier métier de la base de travail n'est copié. Le port 4310 continue de servir l'application locale.

Le fichier `data/preview-current.json` indique le lien HTTPS courant, l'expiration UTC et le dossier de la démonstration. Les identifiants à transmettre au testeur sont dans `ACCES-CLIENT.txt` dans ce dossier. Ce fichier est confidentiel et exclu de Git par la règle `data/`.

Deux accès sont fournis :

- `gestion@example.com` : rôle Direction pour tester les modules métier sur des données fictives, sans administration des utilisateurs.
- `client@example.com` : portail lié à Jordan Taylor DEMO, un chantier et un devis publié ; messagerie et décision sur le devis.

Les mots de passe sont générés aléatoirement pour chaque démonstration. Aucun mot de passe de travail n'est réutilisé. Les tests modifient uniquement la base de démonstration. Ne pas y saisir de données confidentielles. Les paiements, signatures certifiées et emails externes ne sont pas connectés.

## Arrêter et relancer

Double-cliquer `ARRETER-DEMO.cmd` pour couper le tunnel et le serveur de démonstration. L'application locale continue. Les données de test restent sur le PC.

Le lien fonctionne tant que le PC, Internet et le processus de démonstration restent actifs, au maximum 47 heures après la création du lien. Une panne ou une mise en veille peut interrompre l'accès plus tôt. Le lien n'est pas un hébergement permanent.

Pour une nouvelle session, arrêter la précédente, puis lancer `node server/preview.mjs` depuis le dossier de l'application. Cela crée une nouvelle base, de nouveaux mots de passe et un nouveau lien. Garder le terminal ouvert. Le programme officiel `data/tools/cloudflared.exe` est requis (version téléchargée 2026.9.1 ; SHA256 vérifié contre GitHub : `2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712`).

## Contrôles appliqués

L'instance publique exige une origine HTTPS exacte, un Host correspondant et `X-Forwarded-Proto: https`. Elle conserve la protection CSRF, le contrôle des rôles, les limites de connexion et les en-têtes de sécurité. Les cookies de cette instance portent Secure. L'inscription administrateur publique est interdite : les comptes sont préparés localement avant le tunnel. Le serveur refuse les requêtes après l'expiration, et le superviseur arrête les deux processus. La configuration refuse le dossier de travail par défaut et une expiration dépassant 48 heures.

Les tests `tests/preview.test.mjs` vérifient le Host, HTTPS, l'origine, les cookies et les permissions. `server/verify-preview.mjs` vérifie les deux accès sur le lien public sans afficher les mots de passe. Les contrôles API ne constituent pas une recette visuelle sur les téléphones du client.

Service de transport : [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). Destiné aux essais, sans garantie de disponibilité.
