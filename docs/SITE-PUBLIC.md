# Site public bilingue

Source éditoriale : Rubriques.docx. Le document fournit huit rubriques et des suggestions d'images, sans photos intégrées, biographie de l'équipe, historique ni liste précise de villes desservies. Les pages sont adaptées en français et anglais. Les dessins sont identifiés comme illustrations ; aucune réalisation, certification, ancienneté ou référence client n'est inventée.

## Architecture et parcours

L'accueil `/` redirige vers `/fr/accueil`. Chaque rubrique possède sa propre URL et un HTML rendu par le serveur. Le changement de langue conserve la rubrique. La navigation mobile utilise un menu déroulant accessible au clavier. Le bouton Se connecter ouvre `/connexion` et transmet la langue. `/app` donne un accès direct à l'application existante et reste le point de départ de l'application installable.

| Rubrique | Français | English |
| --- | --- | --- |
| Accueil | /fr/accueil | /en/home |
| Entreprise | /fr/entreprise | /en/about-us |
| Services | /fr/services | /en/services |
| Cuisines et salles de bains | /fr/cuisines-salles-de-bains | /en/kitchen-bathroom-remodeling |
| Réalisations | /fr/realisations | /en/projects |
| Méthode | /fr/methode | /en/our-process |
| Zones | /fr/zones-intervention | /en/service-areas |
| Contact | /fr/contact | /en/contact |

Parcours visiteur : rubrique → demande de devis → formulaire → confirmation d'enregistrement. L'API POST `/api/public/estimate` crée un prospect au statut Nouveau, source Website / Site internet, avec description, localisation, service, langue et consentement horodaté. Les données restent dans la base de l'instance consultée : locale ou démonstration. Aucun email automatique n'est envoyé. Les demandes de la démonstration ne remontent pas dans la base locale.

## Direction visuelle

Bleu de marque #0d2e54, vert #07835f, encre #203b4b, blanc #ffffff, brume #edf3f4, bois #c6a681. Titres Bahnschrift avec repli Segoe UI, texte Segoe UI / Arial. L'illustration architecturale axonométrique constitue le visuel principal. La composition conserve une navigation explicite, des sections aérées et des illustrations de matériaux et d'agencement. Les illustrations ne représentent pas un chantier exécuté.

## Protection et limites

L'API de demande valide les champs côté serveur, exige un consentement, vérifie l'origine exacte, limite le corps à 16 Ko, utilise un champ piège et limite globalement les demandes à 20 tentatives par 15 minutes par processus. Les requêtes utilisent l'accès paramétré SQLite et la transaction existante. Aucune API privée n'est rendue publique. Avant une production à plus fort trafic : stockage partagé des quotas, protection anti-abus au proxy et politique de confidentialité à valider selon les traitements réels.

À compléter avec l'entreprise : photos réelles et autorisations de publication, fiches de réalisations, présentation du dirigeant et de l'équipe, histoire, prestations précises, villes desservies et adresse e-mail publique. Le téléphone et l'adresse reprennent les informations fournies. L'absence d'adresse e-mail ne bloque pas le formulaire ni l'appel téléphonique.

Vérification : tests des 16 pages, navigation FR/EN, accès à la connexion, données privées, validation du formulaire, persistance des prospects et limitation des requêtes dans une base temporaire. Les comptes existants restent inchangés.
