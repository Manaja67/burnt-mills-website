# Burnt Mills Investment LLC — cible PHP/MySQL

Décision du 26 septembre 2026 : hébergement web mutualisé, site FR/EN et back-office avec comptes clients. Ce document décrit la migration à développer ; le code existant reste en Node.js/SQLite. Aucun ZIP PHP opérationnel n'est encore livré.

## Architecture retenue

- Conserver l'interface HTML/CSS/JavaScript et ses traductions. JavaScript reste utilisé dans le navigateur ; aucun processus Node.js ne sera nécessaire sur l'hébergement final.
- Remplacer les API Node par une application PHP modulaire : contrôleur HTTP, authentification, autorisations, validations métier, services et accès PDO à MySQL.
- Cible PHP 8.3 ou supérieur encore maintenu, extensions pdo_mysql, mbstring, fileinfo, openssl et session. Vérifier les versions effectivement proposées par l'hébergeur avant de figer la compatibilité.
- Base MySQL avec transactions InnoDB et encodage utf8mb4. Tester sur la version réellement fournie ; ne pas présumer une compatibilité MySQL/MariaDB sans validation.
- Racine publique : pages, styles, images et contrôleur index.php. Configuration, journaux, sauvegardes et documents clients placés hors de cette racine.
- Sessions PHP avec stockage serveur ; HTTPS, cookies Secure/HttpOnly/SameSite, renouvellement d'identifiant à la connexion et protection CSRF.
- Aucun démon permanent nécessaire. Tâches cron pour nettoyage et sauvegarde selon les possibilités du compte.

## Contrat avec l'interface existante

Préserver les chemins JSON `/api/session`, `/api/login`, `/api/logout`, `/api/state`, `/api/users`, `/api/records/:kind` et les opérations spécialisées documentées dans API.md. Conserver les noms de champs, les codes d'erreur et les montants en cents pour éviter de réécrire inutilement les écrans.

Conserver les pages publiques bilingues et le formulaire de devis relié au CRM. Le bouton de connexion ouvre le back-office. Chaque client ne voit que ses projets et les informations explicitement partagées.

## Données et relations cibles

| Ensemble | Tables / relations |
|---|---|
| Accès | users, sessions, user_projects ; utilisateur relié à son client ou employé |
| Commercial | clients, estimates, estimate_items, contracts ; documents reliés au client et au projet |
| Opérations | projects, tasks, events ; affectations utilisateurs-projets |
| Équipes | employees, subcontractors, time_entries |
| Achats et dépenses | suppliers, materials, expenses |
| Facturation | invoices, payments ; paiement relié à sa facture |
| Documents | files ; projet, auteur, audience et chemin privé |
| Échanges | messages ; projet, auteur et audience |
| Administration | settings, audit, schema_migrations |

Identifiants existants conservés lors d'un import ; clés étrangères et index sur client, projet, facture et dates. Les champs version permettent le contrôle des modifications concurrentes. Le SQL définitif accompagnera l'implémentation et les tests de migration.

## Règles à reporter sans régression

- Huit rôles actuels : administrateur, direction, comptable, chef de projet, chef de chantier, employé, sous-traitant, client. Réappliquer la matrice de ACCES-ET-PORTAIL.md côté serveur, et non seulement dans les menus.
- Recalcul des devis côté serveur, blocage des modifications d'un document émis selon les règles existantes.
- Conversion devis vers contrat/projet atomique et sans doublon ; transactions et verrouillage pour les paiements afin d'interdire un dépassement du solde lors de requêtes simultanées.
- Un seul pointage ouvert par employé ; taux horaire figé sur l'entrée de temps.
- Documents protégés à chaque téléchargement ; contrôles de signature de fichier, extension, taille et audience.
- Désactivation ou changement d'affectation : révocation des sessions concernées.
- Création initiale de l'administrateur protégée par un secret d'installation à usage unique, puis verrouillée ; pas de mot de passe universel dans l'archive.
- Requêtes SQL préparées, limitation persistante des tentatives de connexion, journaux sans secrets, erreurs techniques masquées au public.

## Migration des données locales

Ne pas inclure la base locale dans le ZIP public. Prévoir un export privé puis un import validé, avec sauvegarde, rapport de compteurs et vérification des relations. Extraire les fichiers SQLite vers un stockage privé en contrôlant leur intégrité. Les empreintes scrypt Node ne sont pas directement compatibles avec password_verify PHP : prévoir une procédure contrôlée de réinitialisation des mots de passe, sans les exposer ni créer de mot de passe partagé. Révoquer les anciennes sessions. Répéter l'import sur une copie avant une bascule réelle.

## Ordre de réalisation et réception

1. Préparer un environnement PHP/MySQL de test et le schéma ; cet environnement n'a pas encore été validé sur ce poste.
2. Porter les connexions, sessions, administrateur, création des comptes clients, rôles et paramètres. Tester deux clients distincts et tous les accès directs interdits.
3. Porter CRM, projets, tâches et planning, puis devis/contrats/factures/paiements et pointage. Reprendre les scénarios existants contre le nouveau serveur PHP.
4. Porter documents, photos, messages et formulaire public ; vérifier les permissions par audience et les traductions FR/EN.
5. Tester persistance, concurrence des paiements, redémarrage, sauvegarde/restauration, migration et affichage mobile.
6. Produire un ZIP PHP/MySQL distinct avec SQL, configuration exemple, contrôle des prérequis et guide cPanel. Ne déclarer le package prêt qu'après une recette réelle avec MySQL.

## Choix d'hébergement

Un hébergement Linux/cPanel PHP/MySQL peut convenir ; un VPS n'est pas imposé par cette architecture. Pour un site, comparer Economy aux autres offres sur les limites CPU/mémoire, taille de base, téléversements, sauvegardes et renouvellement HTTPS, et pas seulement sur le nombre de sites. Vérifier la version PHP et MySQL ainsi que la possibilité d'un répertoire privé. Les ressources nécessaires seront confirmées par les tests.

Références fournisseur consultées :
- https://www.godaddy.com/en/hosting/web-hosting
- https://www.godaddy.com/en-in/help/view-or-change-the-php-version-for-my-web-hosting-cpanel-16090
- https://no.godaddy.com/help/which-components-does-my-hosting-support-5614

Les paiements en ligne, l'email/SMS et la signature électronique ne deviennent pas actifs par le changement de langage : leurs intégrations restent un chantier distinct du portage des fonctions existantes.
