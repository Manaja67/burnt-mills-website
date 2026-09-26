# Accès terrain et espace client

Version 0.2.0 — 13 septembre 2026. L’évolution ajoute des accès par dossier et des audiences de partage dans l’application locale existante. Elle n’ouvre pas le serveur sur Internet et ne connecte aucun prestataire externe.

## Créer et gérer les comptes

Ouvrez Paramètres avec votre compte administrateur, puis Créer un utilisateur. Choisissez son rôle et définissez ses accès. Les chantiers sont sélectionnés explicitement ; aucun chantier n’est accordé automatiquement aux comptes terrain. Un compte sans affectation n’a pas accès aux dossiers de chantier.

Pour un Employé, sélectionnez sa fiche Employé et ses chantiers. Une même fiche ne peut être liée qu’à un seul compte. Un Chef de chantier peut aussi être lié à sa fiche Employé pour disposer du pointage personnel. Un Sous-traitant ne reçoit pas d’accès à la paie ni au pointage salarié.

Pour un Client, sélectionnez sa propre fiche CRM. Ses chantiers sont ceux rattachés à cette fiche, sans droit de consulter les notes commerciales internes. Plusieurs comptes peuvent représenter le même client : ils partagent alors ce même périmètre. Utilisez des fiches CRM distinctes si leurs accès doivent être distincts.

Gérer les accès permet de modifier les affectations, le rôle, l’accès aux budgets et l’activation du compte. La sauvegarde de ces réglages révoque toutes les sessions de la personne concernée. Elle doit se reconnecter. Le compte administrateur initial ne peut pas être désactivé ni déclassé depuis ce formulaire.

Les comptes sont créés localement avec un mot de passe initial. Envoi d’invitation, changement du mot de passe initial, récupération email et MFA restent à livrer avant une diffusion publique.

## Permissions effectives

| Rôle | Périmètre | Lecture / actions |
|---|---|---|
| Super Admin | Entreprise entière | Toutes les fonctions locales, comptes, affectations, publication, audit |
| Direction | Entreprise entière | Opérations et finance ; pas de gestion des comptes ni d’audit |
| Comptable | Entreprise entière | Clients/projets en lecture ; factures, paiements, dépenses, fournisseurs et matériaux ; pas de fichiers ni données RH |
| Chef de projet | Chantiers affectés | Tâches, planning, fichiers, messages, contacts clients liés ; progression et suivi ; budget, dépenses et prix uniquement si autorisés |
| Chef de chantier | Chantiers affectés | Progression, statut et notes opérationnelles du projet ; tâches ; fichiers/messages de l’équipe ; pointage personnel si fiche Employé liée |
| Employé | Chantiers affectés et tâches affectées à son compte | Mise à jour du statut et des notes de ses tâches ; photos/messages équipe ; pointage personnel ; aucun taux/coût RH |
| Sous-traitant | Chantiers affectés et tâches affectées à son compte | Mise à jour de ses tâches ; photos/messages équipe ; aucune finance globale |
| Client | Sa fiche CRM et ses propres chantiers | Progression ; documents/planning publiés ; fichiers/messages destinés au client ; décision sur un devis publié |

Le chef de projet sans autorisation budgétaire voit les quantités et statuts des matériaux, mais ni les prix ni les dépenses. Il peut mettre à jour les lignes existantes sans modifier les prix ; la création de lignes chiffrées nécessite l’autorisation budgétaire. Les comptes terrain ne créent pas de projets et ne changent pas le client d’un projet.

Les comptes employés/sous-traitants ne sont pas affectés à une tâche par leur simple nom. Dans la tâche, sélectionnez le champ **Compte chargé de la tâche**. Le serveur vérifie que ce compte a accès au chantier. Le libellé libre Responsable / Équipe reste disponible pour le planning humain mais n’accorde aucun droit.

## Publier au client

Ouvrez un devis, une facture ou un contrat. Le contrôle Publier au client rend la pièce visible dans le portail de son client. Un devis ou une facture brouillon ne peut pas être publié. Le contrat local étant encore un brouillon non signé, il reste signalé comme tel au client. Retirer du portail coupe l’accès à cette pièce. Les notes internes de devis/facture/contrat ne sont pas transmises au client.

Les rendez-vous peuvent être publiés depuis Paramètres → Planning visible par les clients. Les horaires et le titre sont partagés, sans les notes internes ni les affectations de personnel.

Le client voit uniquement les paiements liés à ses factures publiées. Les références bancaires et l’identité interne de la personne qui a saisi le paiement sont retirées de cette projection.

## Fichiers et conversations

Chaque fichier et message appartient à une audience :

| Audience | Destinataires |
|---|---|
| Direction et chefs de projet | Admin/Direction et chefs de projet affectés ; exclut les employés, sous-traitants et clients |
| Équipe du chantier | Admin/Direction, chefs de projet, chefs de chantier, employés et sous-traitants affectés |
| Client | Admin/Direction, chefs de projet affectés et comptes liés au client propriétaire du chantier |

Les fichiers et messages existants sont privés par défaut après migration. Les membres terrain créent uniquement des fichiers/messages d’équipe. Les clients créent uniquement des messages destinés à leur échange avec la direction. Les responsables autorisés peuvent choisir l’audience et modifier celle d’un fichier, avec contrôle de concurrence et trace dans le journal.

Un fichier destiné au client n’est pas implicitement un fichier destiné aux ouvriers. Téléversez un exemplaire distinct si les deux publics doivent y accéder. Le contrôle d’accès s’applique aussi à l’URL directe du fichier et aux listes de métadonnées.

## Décision sur un devis

Le client ouvre un devis publié et envoyé, examine le total, puis choisit Accepter ou Refuser. Un écran confirme la pièce et le montant avant l’enregistrement. Le serveur conserve l’auteur et l’heure. Une double soumission de la même décision ne crée pas de doublon ; une décision opposée après clôture est refusée. Un devis expiré ne peut pas être accepté.

Cette fonction enregistre une décision authentifiée. Elle ne fournit pas de certificat de signature électronique et ne signe pas le contrat de travaux. Le chef de projet ou la direction poursuit le parcours de contractualisation. Paiements et signatures de contrat restent à connecter à des prestataires dédiés.

## Conservation et migration

Au premier démarrage de la version 0.2.0, une sauvegarde `before-access-v2-….sqlite` est créée dans `data/backups`, puis le schéma est migré dans une transaction. Identifiants, mots de passe hachés, sessions, données et pièces jointes sont conservés. Une vérification de clés étrangères est exécutée avant validation ; une erreur annule la migration.

Après retrait d’une affectation, un salarié peut consulter ses anciennes sessions de pointage et fermer un pointage personnel déjà ouvert. Il ne peut plus démarrer de pointage sur le chantier retiré, ni consulter ses documents ou tâches. Cet historique personnel est volontairement conservé.

Les permissions sont vérifiées dans `/state`, les lectures individuelles, les écritures, les téléchargements, le partage et les opérations métier. Les champs internes sont retirés côté serveur avant envoi au navigateur ; le menu ne sert qu’à adapter l’interface.

## English summary

Administrators can create field and customer accounts, assign individual projects, optionally grant project managers budget access, and disable accounts. Access changes revoke the affected user's sessions. Employee tasks require an explicit user-account assignment; a free-text assignee name does not grant access.

Customers see their own projects and only published commercial documents, schedule entries, customer-audience files and conversations. Internal financial/HR fields and notes are removed by the server. Estimate decisions require confirmation and record the authenticated customer and timestamp; they do not electronically sign a construction contract. Public hosting, invitations, password recovery/MFA, online payments and contract-signing providers remain future work.
