# Installation sur burnt.gmccgabon.com

Ce dossier contient le site français/anglais et l'espace de gestion existant. Il ne contient ni compte, ni mot de passe, ni données locales. Il s'agit d'une nouvelle installation ; une migration des données locales doit être organisée séparément si souhaitée.

## Vérification indispensable auprès de l'hébergeur

Demander : « Mon sous-domaine burnt.gmccgabon.com peut-il exécuter une application Node.js 24 ou supérieur, avec node:sqlite, un processus permanent, un disque persistant et un proxy HTTPS vers un port local ? Puis-je lancer une commande dans un terminal pour initialiser le compte administrateur ? »

FTP transfère les fichiers ; il ne démarre pas Node.js. Un hébergement limité à PHP/MySQL ne convient pas. Il n'existe pas d'index.php à installer. Les exemples ci-dessous visent un serveur Linux avec Nginx et systemd ; sur un panneau mutualisé, faire adapter la configuration par l'hébergeur. Ne pas supposer qu'un bouton « Node.js » garantit la compatibilité avec node:sqlite.

## Contenu à transférer

- Transférer le contenu de `application/` en mode binaire avec le client FTP (de préférence FTPS ou SFTP) dans un répertoire **privé** de l'hébergement, par exemple `/srv/burnt/app`.
- Ne pas déposer `server/`, `.env`, les guides ou la base dans `public_html`, `www` ou le répertoire public du sous-domaine.
- Le sous-domaine doit pointer vers le serveur puis être relié au processus Node par le proxy. Toutes les URL, y compris `/api/`, `/connexion`, `/fr/accueil` et `/en/home`, doivent être transmises à Node. Ne pas appliquer une redirection générale vers index.html.
- `configuration/` contient des modèles à adapter, et non des fichiers à rendre publics.

## Première installation

1. Installer Node.js 24 ou supérieur et vérifier `node --version`. Aucun paquet npm d'exécution n'est requis.
2. Créer un utilisateur système dédié `burnt`, le répertoire applicatif `/srv/burnt/app`, le dossier de données `/srv/burnt/private` et un répertoire web vide `/var/www/burnt-empty`. Le compte du service doit pouvoir écrire dans `private` ; les fichiers applicatifs peuvent rester en lecture seule après configuration. Le dossier de données doit être privé, sur disque local persistant et hors de la racine de l'application. Ne pas utiliser un lien symbolique vers un répertoire public.
3. Copier `configuration/env.example` vers `/srv/burnt/app/.env`. Adapter les chemins si nécessaire. Restreindre sa lecture au compte de service. Node lit ce fichier uniquement grâce à l'option `--env-file=.env`.
4. Depuis `/srv/burnt/app`, exécuter **sous le compte du service**, en remplaçant l'email et le nom :

```sh
node --env-file=.env server/init-admin.mjs votre-email@example.com "Votre nom"
```

La commande crée le premier administrateur et affiche une seule fois un mot de passe aléatoire. Le conserver immédiatement dans un gestionnaire de mots de passe. Ne pas rediriger cette sortie dans un journal partagé. Aucun compte prédéfini n'est fourni. Si des comptes existent déjà, la commande refuse de les remplacer.

5. Démarrer pour vérifier :

```sh
node --env-file=.env server/index.mjs
```

Le serveur écoute seulement `127.0.0.1:4310`. Une requête directe sans en-têtes HTTPS sera refusée en mode production : le proxy doit conserver le nom d'hôte et remplacer `X-Forwarded-Proto` par `https`.
6. Configurer le certificat TLS du sous-domaine puis le proxy HTTPS. Le modèle Nginx suppose un certificat déjà installé aux chemins indiqués ; adapter à votre fournisseur. Garder le port 4310 inaccessible depuis Internet. Arrêter le processus manuel avant d'activer le service permanent.
7. Adapter et installer le modèle systemd (chemin du binaire Node à vérifier avec `command -v node`), puis activer le service avec l'administrateur du serveur. Un panneau d'hébergement peut gérer le processus à la place de systemd.
8. Ouvrir `https://burnt.gmccgabon.com/fr/accueil`, puis `/en/home` et `/connexion?lang=fr`. Se connecter avec l'administrateur créé. Créer ensuite les comptes clients avec leurs affectations depuis la gestion des utilisateurs.

## Vérification avant ouverture aux clients

- Certificat HTTPS valide, redirection HTTP vers HTTPS, pages FR et EN accessibles et photos chargées.
- Connexion/déconnexion fonctionnelles ; cookies de session marqués Secure et HttpOnly.
- Sans connexion, `/api/state` retourne 401 ; `/.env`, `/server/db.mjs` et `/burnt-mills.sqlite` ne livrent aucun fichier privé.
- Une demande de devis de test depuis le site apparaît dans le CRM ; aucun email automatique n'est actuellement envoyé.
- Un compte client ne voit que ses projets et documents autorisés.
- Un redémarrage conserve les données. Vérifier une sauvegarde et sa restauration sur une copie avant exploitation.

## Sauvegarde et mise à jour

Depuis le répertoire applicatif, sous le compte de service :

```sh
node --env-file=.env server/backup.mjs
```

Cette commande produit une copie cohérente dans `/srv/burnt/private/backups`. Les fichiers téléversés sont inclus dans SQLite. Programmer une sauvegarde quotidienne et une copie privée hors serveur avec une politique de conservation adaptée. Pour restaurer, arrêter le service et restaurer une sauvegarde validée dans un dossier de données vide ; ne jamais mélanger un ancien SQLite avec des fichiers WAL/SHM d'une autre version.

Avant une mise à jour : sauvegarder, arrêter le service, transférer les nouveaux fichiers applicatifs, conserver `.env` et le dossier privé, puis redémarrer et contrôler. Ne jamais écraser la base par un fichier de démonstration.

## Périmètre livré

Application web responsive utilisable sur mobile ; aucun fichier APK/IPA ou publication en magasin mobile. Le package conserve les fonctionnalités existantes du pilote. Paiements en ligne, signature électronique certifiée, email/SMS et récupération de mot de passe par email ne sont pas connectés. Le mode HTTPS permanent remplace la limite de 48 heures de la démonstration temporaire ; il n'active pas ces intégrations. Une validation fonctionnelle et opérationnelle avec l'hébergeur reste nécessaire avant utilisation métier.
