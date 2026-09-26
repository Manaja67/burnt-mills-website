# Recette de la version locale

## Mise à jour 0.2.0 du 13 septembre 2026

**25 tests automatisés passants** : 11 scénarios de la première version, 10 scénarios de permissions/portail, 1 migration depuis l’ancien schéma, 3 tests hors ligne de génération des écrans FR/EN. Les tests de génération exécutent les fonctions dans Node avec des données synthétiques ; ils ne remplacent pas une inspection visuelle des nouveaux écrans dans un navigateur. Le contrôle navigateur intégré avait été refusé automatiquement lors de la reprise précédente ; aucune autre surface de navigateur n’a été utilisée pour contourner ce refus.

Nouveaux contrôles : isolement entre deux clients ; documents non publiés masqués ; notes/coûts/références bancaires retirés des réponses ; accès direct à un fichier hors périmètre refusé ; audiences direction/équipe/client séparées ; tâches affectées par identifiant de compte ; modification de champs sensibles refusée ; pointage personnel sans usurpation ; budget de chef de projet sur autorisation explicite ; décisions client horodatées, confirmées et idempotentes ; retrait d’affectation et désactivation avec révocation de sessions.

La migration a été testée avec un ancien compte, sa session, un projet versionné et une pièce jointe. Elle conserve ces éléments, crée une sauvegarde et laisse les fichiers privés. `PRAGMA foreign_key_check` et `integrity_check` passent. Un second démarrage ne relance pas la migration.

La version 0.2.0 est activée sur le serveur local du dossier de travail. Son identité et son numéro de version ont été vérifiés via l’API locale. Une sauvegarde cohérente a été créée avant le redémarrage et une sauvegarde pré-migration a été conservée automatiquement. Aucun compte de travail ni fournisseur externe n’a été créé par les tests.

Les sections suivantes conservent la recette de la version 0.1.0 ; leurs captures navigateur précèdent les nouveaux écrans d’accès.

Environnement de vérification : Windows, Node.js 24.18.0, Chrome headless, interface française et anglaise, fuseau de navigateur America/New_York. Les bases de test sont temporaires et distinctes de la base de travail. Aucun compte administrateur, client ou règlement réel n’a été créé dans l’espace de l’entreprise par les tests.

## Tests automatiques métier et sécurité

Commande : `npm test`. Onze scénarios intégrés, tous passants après correction d’un décompte de paramètres SQL dans le stockage des fichiers.

1. Installation initiale, session, coordonnées Maryland, en-têtes de sécurité et accès anonyme refusé.
2. Rejet des écritures avec CSRF invalide, origine étrangère et Host non autorisé.
3. Validation CRM, sauvegarde et conflit de version lors de modifications concurrentes.
4. Devis recalculé côté serveur, verrouillage après envoi, refus de conversion prématurée et conversion sans doublon.
5. Rendez-vous chevauchants refusés pour le même responsable ; rendez-vous adjacents acceptés.
6. Facture brouillon non payable, règlements partiels, rejet des références répétées et des dépassements du solde, facture émise figée.
7. Un seul pointage actif par employé, taux historique conservé et double arrêt refusé.
8. Téléversement/déchargement authentifiés, mauvais types/extensions et projets inexistants refusés.
9. Rôle Comptable sans accès aux équipes, documents et administration ; accès financier permis.
10. Dates incorrectes rejetées, champs inconnus ignorés et texte ressemblant à du SQL traité comme donnée.
11. Données présentes après redémarrage et session effectivement révoquée à la déconnexion.

Audit npm : zéro vulnérabilité signalée ; aucune dépendance npm d’exécution tierce. Cet audit ne constitue pas une analyse exhaustive de sécurité ni une validation de la totalité du runtime Node.

## Parcours navigateur

Script : `tests/ui-check.mjs`, avec Playwright fourni par l’environnement de développement. Création du compte de test, chargement explicite des données fictives, changement FR/EN, création de client contenant un texte hostile affiché littéralement, devis à lignes avec taxe/remise, envoi/acceptation/conversion, téléversement et affichage d’une image.

Les vingt rubriques de bureau ont été ouvertes à 1440 × 1024. Navigation et absence de débordement du document vérifiées à 390 × 844 pour les rubriques principales. Aucun événement `pageerror` JavaScript. Les résultats détaillés se trouvent dans `previews/ui-results.json`.

Inspection visuelle effectuée sur connexion, tableau de bord bureau/mobile, chantiers, factures, pointage et planning mobile. La revue a conduit à remplacer les tableaux de fiches par des cartes sur petits écrans et à afficher l’agenda par défaut sur téléphone. Les tableaux de rapports et certaines listes spécialisées conservent un défilement horizontal interne.

Ces essais ne remplacent pas une recette sur de vrais appareils iOS/Android, un audit d’accessibilité, un test de charge ou une revue de sécurité indépendante. Impression PDF utilise le dialogue du navigateur ; aucun moteur de PDF certifié ni signature électronique n’est livré.

## Conditions avant production

Vérification finale du lancement : serveur de travail disponible sur http://127.0.0.1:4310, identité de l’application confirmée, installation initiale ouverte et zéro utilisateur précréé. Sauvegarde créée par `npm run backup` ; `PRAGMA integrity_check` renvoie `ok` sur la copie, qui contient les coordonnées Maryland attendues. Ceci vérifie la cohérence de la copie locale ; un exercice complet de reprise après incident de production reste à réaliser.

Restent à vérifier après leur implémentation : invitations, MFA/récupération, fournisseurs de paiement et signature, webhook dupliqué/retardé, avoirs/remboursements, envoi de relances, migrations PostgreSQL, antivirus documentaire, reprise sur sauvegarde externalisée, HTTPS, fonctionnement sur appareils réels et obligations locales validées. Les profils terrain/client disposent désormais des tests d’isolation décrits en tête de ce document.

La version livrée doit rester locale jusqu’à ces évolutions. La recette ne certifie aucune conformité fiscale, juridique ou PCI DSS.
