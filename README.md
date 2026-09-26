# Burnt mills investment LLC

Application de gestion de construction et rénovation en français et en anglais, adaptée à l’ordinateur, à la tablette et au téléphone. **Version locale 0.2.0 : rôles terrain et portail client avec contrôles d’accès.** La mise en service publique et certaines fonctions du cahier des charges restent à livrer.

Coordonnées intégrées : **10845 Childs St, MD 20901 · Maryland · +1 (443) 839-2238**. Logo horizontal fourni dans `Logo 3.png`. Email professionnel à renseigner dans Paramètres. Aucun taux fiscal n’a été déduit de l’adresse.

## Démarrer sur cet ordinateur

1. Double-cliquez sur **DEMARRER.cmd** dans ce dossier.
2. L’application s’ouvre sur **http://127.0.0.1:4310**.
3. Créez votre compte administrateur : nom, email et mot de passe d’au moins 12 caractères. Aucun mot de passe prédéfini.
4. Créez vos premières fiches ou choisissez volontairement **Charger les exemples** dans l’espace vide. Les exemples sont fictifs et marqués DEMO.
5. Le bouton **FR / EN** change la langue de l’interface. La devise reste USD.

Node.js 24 ou supérieur est nécessaire ; Node 24.18.0 était présent et a été utilisé pour les tests. Aucun compte externe ni installation npm n’est nécessaire pour lancer cette version. Le lanceur démarre le serveur dans un processus masqué et vérifie son identité. Pour voir les journaux dans un terminal, utilisez `npm start` à la place du lanceur.

Ne partagez pas le compte administrateur. Paramètres permet de créer des comptes Direction, Comptable, Chef de projet, Chef de chantier, Employé, Sous-traitant et Client. Le rôle Comptable ne peut pas accéder aux équipes, aux documents, au journal ou à l’administration des utilisateurs. Les comptes terrain sont limités aux chantiers sélectionnés ; un compte Client est lié à une fiche CRM. Voir [docs/ACCES-ET-PORTAIL.md](docs/ACCES-ET-PORTAIL.md) pour les parcours et permissions.

## Fonctions présentes

| Fonction | État de cette version |
|---|---|
| Connexion | Huit rôles dont administrateur initial, sessions expirantes, désactivation et révocation des sessions |
| Tableau de bord | Encaissé, reste à recevoir, chantiers actifs, devis en attente, graphique réel des saisies sur 6 mois, agenda |
| Clients et prospects | Création/modification, coordonnées US, pipeline, recherche, filtres, CSV |
| Devis | Lignes, quantité, prix, remise, taxe configurable, recalcul serveur, statuts, duplication, impression/PDF via navigateur |
| Conversion | Un devis accepté crée un chantier et un contrat brouillon ; répétition sans doublon |
| Contrats | Consultation du brouillon issu du devis ; signature et clauses finales non disponibles |
| Projets | Client, adresse, responsable, dates, budget, progression, statuts, détails, tâches et coûts liés |
| Tâches | Priorité, responsable textuel, dates, notes, modification et clôture |
| Planning | Vue mois et agenda ; conflit si le même libellé de personne/équipe chevauche un rendez-vous |
| Employés / sous-traitants | Fiches séparées, métier, contacts, taux, licence/assurance textuelles, expiration et alertes à 30 jours |
| Pointage | Responsable ou employé lui-même ; chantier autorisé, un pointage actif, taux figé, coût réservé à la direction ; pas de paie |
| Fournisseurs / matériaux | Fiches fournisseurs, références et lignes de commande par chantier, prix, quantités et statuts simples |
| Dépenses | Catégorie, montant, date, fournisseur et chantier, comparaison au budget |
| Factures | Montant, client, chantier, échéance, brouillon/émission, verrouillage après émission, solde calculé et impression |
| Paiements | Saisie des virements/chèques/espèces déjà reçus ; partiels, référence, anti-doublon et contrôle du solde |
| Photos / documents | Téléchargement local authentifié, fichiers jusqu’à 8 Mo, JPG/PNG/WebP/PDF, projet, description et phase |
| Messages | Conversations par chantier et audience : direction, équipe ou client ; auteur vérifié ; aucun email/SMS envoyé |
| Rapports | Montants facturés/encaissés, dépenses, temps valorisé, budget restant par chantier, CSV et impression |
| Paramètres | Coordonnées, fuseau, utilisateurs, affectations, budgets autorisés et journal d’activité |
| Espace client | Projets propres, devis/factures/contrats et planning publiés, fichiers partagés, paiements enregistrés, messages et décision horodatée sur devis |
| Mobile web | Mise en page responsive, barre basse, manifeste, shell de l’interface disponible hors connexion |

Les montants sont stockés en **cents**. Le CSV de données exporte les valeurs stockées ; les colonnes monétaires doivent être divisées par 100 pour une lecture en dollars. Les impressions utilisent les montants formatés. Le texte libre et les noms de dossiers ne sont pas traduits automatiquement quand la langue change.

Les devis « envoyés » enregistrent un statut : cette action n’envoie pas d’email. L’acceptation peut être saisie par un responsable après réception d’une décision extérieure ou par le client connecté sur un devis publié. La décision client conserve son auteur et sa date ; elle ne signe pas le contrat. Les factures pilotes ont un montant global ; le détail de facturation par étape, les avoirs, la retenue et la fiscalité par ligne sont à développer. Un reçu peut être téléversé comme document du chantier, sans lien direct à une dépense dans cette version.

## Parcours conseillé

**Client → devis → chantier** : ajoutez un client ; créez un devis avec ses lignes ; enregistrez-le ; modifiez le statut en Envoyé, puis Accepté lorsque la décision vous est parvenue ; ouvrez le devis ; choisissez Créer contrat et chantier. Le contrat reste un brouillon non signé.

**Chantier → opérations** : ouvrez le chantier pour modifier son avancement, créer des tâches, ajouter une photo ou écrire un message. Dans Planning, créez une visite ou inspection avec un responsable et des heures. Le calendrier utilise le fuseau du navigateur pour la saisie et l’affichage.

**Facture → règlement manuel** : créez une facture brouillon liée au client et à son chantier ; passez-la en Envoyée ; ouvrez-la ; enregistrez un règlement que vous avez réellement reçu, avec une référence. Une facture ayant reçu un paiement ne peut plus être annulée ici. Les erreurs sur les pièces figées requièrent une procédure d’avoir qui reste à livrer : n’utilisez pas ce pilote comme grand livre comptable définitif.

**Temps** : créez un employé avec son taux ; sélectionnez son chantier dans Pointage ; démarrez et arrêtez le pointage. Une modification ultérieure du taux ne change pas les anciennes sessions. Évitez de ressaisir ces coûts de temps comme dépenses, ce qui les compterait deux fois.

## Téléphone et publication

L’adresse `127.0.0.1` désigne **cet ordinateur** : elle ne permet pas à un téléphone de se connecter au serveur. La première version est liée à l’interface locale pour protéger l’installation. Pour une utilisation réelle depuis les chantiers, il faut livrer la configuration de production HTTPS, l’hébergement, les comptes et la recette de sécurité, puis utiliser l’URL publique sur le téléphone.

Le manifeste prépare l’ajout à l’écran d’accueil. Ce n’est pas une publication App Store ou Google Play. Le cache ne conserve que les ressources publiques de l’interface. Les données privées et fichiers ne sont pas mis en cache par le service worker ; une écriture hors connexion est refusée avec une erreur explicite. Synchronisation terrain hors ligne et notifications push restent à développer.

## Aperçu en ligne gratuit (GitHub Pages)

Chaque envoi sur la branche `main` publie automatiquement la version statique du site vitrine (FR/EN, sans formulaire ni espace de gestion) sur https://manaja67.github.io/burnt-mills-website/. Le workflow `.github/workflows/pages.yml` exécute `node scripts/build-pages.mjs`, qui reprend l'export statique et rend les chemins relatifs. L'aperçu est marqué `noindex` pour ne pas être référencé par les moteurs de recherche. Activation unique : GitHub → Settings → Pages → Source : **GitHub Actions**.

## Données et sauvegarde

Les données sont conservées dans `data/burnt-mills.sqlite`. Les fichiers téléversés y sont également stockés. Les documents Word et logos sources restent intacts. Les données et secrets sont exclus de Git par `.gitignore`.

Pour créer une sauvegarde cohérente pendant que le serveur fonctionne :

```powershell
npm run backup
```

Le fichier est créé dans `data/backups`. Cette copie locale n’est pas chiffrée ni externalisée automatiquement. Conservez-la dans un emplacement protégé et préparez une sauvegarde chiffrée hors de cet ordinateur avant l’exploitation professionnelle.

Pour restaurer **sans écraser vos données actuelles**, arrêtez le serveur concerné, créez un nouveau dossier, copiez-y une sauvegarde sous le nom `burnt-mills.sqlite`, puis lancez avec `BM_DATA_DIR` pointant sur ce dossier. Pour essayer un espace vierge séparé, choisissez simplement un nouveau dossier :

```powershell
$env:BM_DATA_DIR = Join-Path (Get-Location) 'data-production-locale'
$env:PORT = '4311'
npm start
```

Ouvrez alors http://127.0.0.1:4311. Cette procédure ne supprime pas les exemples ni l’ancienne base. Le lanceur DEMARRER utilise par défaut le port 4310 et le dossier data ; utilisez le terminal ci-dessus pour un espace distinct. Ne copiez pas uniquement le fichier SQLite d’une base active sans la commande de sauvegarde : des opérations peuvent être dans le journal WAL.

Pour arrêter le serveur démarré dans un terminal, utilisez Ctrl+C. Si le lanceur l’a démarré en arrière-plan, identifiez dans le Gestionnaire des tâches le processus Node dont la ligne de commande pointe vers **ce dossier et server/index.mjs**, puis terminez uniquement ce processus.

## Limites et étapes restantes

Le dossier complet de conception est dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), avec les maquettes préalables [docs/MAQUETTES.html](docs/MAQUETTES.html). Il décrit la cible complète et distingue la première livraison.

À développer ou connecter avant mise en service complète : invitations sécurisées et changement du mot de passe initial, récupération du mot de passe et MFA, contrats finalisés et prestataire de signature, Stripe/PayPal et webhooks vérifiés, email/SMS et relances automatiques, planning jour/semaine/équipe, stocks et commandes détaillées, facturation à l’avancement/avoirs, reçus liés aux dépenses, validations du temps et règles de paie, rapports comptables complets, réglementation juridictionnelle configurable, synchronisation hors ligne, stockage objet/antivirus, PostgreSQL, isolation SaaS, déploiement et sauvegardes de production. Les comptes locaux sont provisionnés par l’administrateur ; aucune invitation email n’est envoyée.

Maryland est une donnée de configuration, pas une validation légale. L’email, les licences, les juridictions précises et les modèles de contrats/taxes doivent être complétés. Aucun paiement, signature ou service externe n’est présenté comme connecté.

## Organisation du code

```text
public/             Interface bilingue, styles responsive, logos et manifeste
server/domain.mjs   Validation et calculs métier
server/access.mjs   Permissions, périmètres des dossiers et projection des champs
server/db.mjs       Schéma SQLite, accès paramétré, transactions et audit
server/index.mjs    Serveur local, sessions, permissions et API
server/backup.mjs   Sauvegarde SQLite cohérente
tests/              Tests de l’API et scénario navigateur
docs/               Architecture, API, schéma pilote, maquettes et recette
DEMARRER.cmd        Lanceur Windows
```

Le stockage pilote utilise une table de documents métier JSON avec types et versions, pas encore les tables relationnelles normalisées de l’architecture cible. Les liens sont validés par l’API ; les BLOB ont une clé étrangère. L’API ne propose pas de suppression physique. Toutes les données sont celles d’une seule entreprise. Il ne faut pas exposer ce serveur local tel quel sur Internet.

## Vérifications

```powershell
npm test
npm audit
```

Tests métier et sécurité : authentification, CSRF, contrôle du Host, droits comptables, devis, conversion idempotente, paiements partiels/doublons, planning, pointage, fichiers et persistance après redémarrage. Voir [docs/RECETTE.md](docs/RECETTE.md) pour les résultats.

Le scénario navigateur `tests/ui-check.mjs` utilise Playwright fourni par l’environnement de développement, non requis par l’application. Définir `BM_BROWSER_PACKAGES` vers le dossier de packages qui contient Playwright ; Chrome est utilisé en mode headless. Les tests utilisent des bases temporaires distinctes et ne créent pas le compte de travail de l’entreprise.

## English quick start

Double-click **DEMARRER.cmd**, then open http://127.0.0.1:4310 and create your administrator account. Node.js 24+ is required. Switch between French and English using the language button. Your data is stored in a local SQLite database. Optional sample records are explicitly marked DEMO. Use `npm run backup` for a consistent database backup.

This is a working local pilot, not the complete production platform or a native store release. Version 0.2.0 adds assignment-scoped field roles and a customer portal with explicit publishing, scoped conversations, private files and timestamped estimate decisions. Online payments, certified contract signatures, external messaging, invitations, MFA/recovery and production hosting still require implementation or integration. The app starts with the Maryland address and phone provided by the owner.
