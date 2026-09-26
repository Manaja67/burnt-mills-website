# API de la version locale 0.2.0

Base : `http://127.0.0.1:4310/api`. Monoentreprise. JSON. Les erreurs sont `{error:{code}}` ; l’interface traduit les codes FR/EN.

Toute écriture nécessite un en-tête `Origin` strictement égal à l’origine HTTP locale utilisée. Après connexion, envoyer le cookie `bm_session` et le jeton `X-CSRF-Token` retourné par la session. Le jeton ne doit pas être enregistré dans le stockage persistant du navigateur. Aucune ouverture CORS. Pas de bearer token, de mot de passe ou de secret dans une URL.

## Routes réellement implémentées

| Méthode | Route | Résultat / droits |
|---|---|---|
| GET | `/session` | Identité de l’app, utilisateur courant ou null, indicateur setup |
| POST | `/setup` | `{name,email,password}` ; premier compte admin uniquement, installation locale |
| POST | `/login` | `{email,password}` ; cookie HttpOnly, SameSite Strict, validité 8 heures |
| POST | `/logout` | Révocation de la session |
| GET | `/state` | Collections autorisées, métadonnées fichiers autorisées, paramètres et utilisateur |
| GET | `/records/:kind` | Collection autorisée |
| GET | `/records/:kind/:id` | Fiche du type demandé |
| POST | `/records/:kind` | Nouvelle fiche validée ; 201 |
| PATCH | `/records/:kind/:id` | Fiche complète avec `version` lue ; 409 en cas de conflit |
| POST | `/estimates/:id/duplicate` | Nouveau brouillon à partir du devis |
| POST | `/estimates/:id/convert` | `{projectId,contractId}`, devis accepté, conversion transactionnelle réutilisable |
| POST | `/time/start` | `{employeeId,projectId}`, taux figé, horodatage serveur |
| POST | `/time/:id/stop` | `{notes}`, coût calculé, refuse une seconde clôture |
| POST | `/payments` | `{invoiceId,amount,date,method,reference}` ; règlement manuel, amount en cents ; method bank/check/cash |
| POST | `/files` | `{projectId,name,category,description,base64,audience}` ; max 8 Mo, signature/extension, projet et audience vérifiés |
| POST | `/files/:id/audience` | `{audience,previousAudience}` ; responsable autorisé, contrôle de concurrence et audit |
| GET | `/files/:id` | Binaire, contrôle d’accès, cache interdit ; PDF envoyé en pièce jointe |
| POST | `/settings` | Admin ; `{address,email,phone,state,timezone}` |
| GET / POST | `/users` | Admin ; métadonnées des comptes ou création `{name,email,password,role,projectIds,clientId,employeeId,budgetAccess,active}` |
| PATCH | `/users/:id/access` | Admin ; `{version,role,projectIds,clientId,employeeId,budgetAccess,active}` ; sessions du compte révoquées |
| POST | `/share/:kind/:id` | `{shared,version}` ; publication/retrait d’un devis, facture, contrat ou rendez-vous |
| POST | `/estimates/:id/decision` | Client propriétaire, devis publié ; `{decision,confirmed:true,version}` ; decision accepted/rejected |
| GET | `/audit` | Admin ; 200 derniers événements |
| POST | `/demo` | Admin, sans clients/projets existants ; exemples fictifs sauvegardés |

Types CRUD : clients, projects, tasks, employees, subcontractors, suppliers, materials, expenses, estimates, invoices, events, messages. Contrats, paiements et temps sont lus dans `/state` ; seules les opérations métier spécifiques les créent. Aucune route DELETE.

Montants : cents entiers ≥0, limite 10^12 ; taxes en points de base de 0 à 10000 ; progression 0 à 100 ; quantités décimales. Une ligne de devis comprend `{name,quantity,unitPrice}`. Le serveur ignore les totaux fournis et recalcule subtotal, tax et total. Les champs acceptés et obligatoires sont déclarés dans `server/domain.mjs`. Les entrées inconnues ne sont pas recopiées dans les données enregistrées.

Exemple de devis :

```json
{
  "name": "Kitchen renovation",
  "clientId": "<existing-client-uuid>",
  "address": "<jobsite address>",
  "due": "2026-10-30",
  "status": "draft",
  "discount": 10000,
  "taxBps": 0,
  "items": [{"name":"Cabinets","quantity":2,"unitPrice":50000}],
  "notes": "Tax rate requires local validation"
}
```

`taxBps: 0` dans cet exemple n’est pas une affirmation d’exonération. Les identifiants sont générés côté serveur. Les dates de calendrier sont des instants ISO UTC ; les dates d’échéance sont YYYY-MM-DD. La version doit être reprise après chaque modification. Les statuts envoyés n’entraînent aucun envoi réseau externe.

## Permissions effectives

Admin : tous les types et administration. Direction : tous les types opérationnels, sans utilisateurs, paramètres modifiables ni audit. Comptable : clients/projets en lecture ; factures, paiements, dépenses, fournisseurs et matériaux en lecture/écriture. Aucun document, équipe, message ou contrat visible pour le comptable dans ce pilote.

Chef de projet, chef de chantier, employé et sous-traitant : collections filtrées selon les affectations. Employé et sous-traitant : tâches uniquement si `assigneeId` est leur identifiant de compte. Budget des chefs de projet activé séparément. Employés : temps et fiche personnelle sans taux/coût RH. Client : sa fiche CRM, ses chantiers, pièces publiées et audiences client. La matrice complète est dans `ACCES-ET-PORTAIL.md` et son implémentation dans `server/access.mjs`.

Le type de module interdit retourne 403. Un identifiant de dossier hors périmètre retourne 404, y compris au téléchargement. Les réponses sont projetées côté serveur : données budgétaires/RH, notes internes et références de paiement non autorisées ne sont jamais envoyées au navigateur. `/state` fournit aussi `user.permissions` et une liste minimale de comptes affectables réservée aux responsables. Les permissions sont recalculées depuis la base à chaque requête.

Messages : `audience` vaut internal/team/client, auteur et identifiant imposés par la session. Fichiers : même audience, privée par défaut pour les fichiers historiques. Devis et factures : publication autorisée après émission ; un contrat brouillon publié reste signalé non signé. Les décisions client enregistrent `decisionBy` et `decisionAt` sans prétendre fournir une signature électronique.

Ce contrat n’implémente pas encore pagination, invitations, changement du mot de passe initial, récupération/MFA, fournisseurs externes, webhooks, partage sans authentification, synchronisation ou isolation multi-tenant. Les routes correspondantes du dossier d’architecture restent la cible de développement.
