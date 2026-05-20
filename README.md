# 🎬 CinéTracker

Application web minimaliste et premium pour suivre vos films et séries.

## 📁 Structure du projet

```
cinetracker/
├── index.html          # Page principale
├── manifest.json       # Configuration PWA
├── css/
│   └── style.css      # Tous les styles
├── js/
│   ├── config.js      # Configuration & constantes API
│   └── app.js         # Logique complète
├── assets/            # Images et icônes
└── README.md          # Ce fichier
```

## 🚀 Installation

### 1. Prérequis

- Un navigateur moderne (Chrome, Firefox, Safari, Edge)
- Un éditeur de code (VS Code recommandé)
- [Optionnel] Live Server pour le développement

### 2. Configuration VS Code

Extensions recommandées :

1. **Live Server** (Ritwick Dey) - Preview en temps réel
2. **Prettier** - Formatage automatique du code
3. **ESLint** - Détection d'erreurs JavaScript

### 3. Configuration de l'API TMDB

1. Créez un compte sur [themoviedb.org](https://www.themoviedb.org/signup)
2. Demandez une clé API sur https://www.themoviedb.org/settings/api
3. Copiez `js/config.local.example.js` vers `js/config.local.js`, puis ajoutez-y votre clé TMDB. `js/config.local.js` est ignoré par Git.

```js
if (typeof CONFIG !== "undefined") {
  CONFIG.TMDB_API_KEY = "votre_vraie_cle_ici";

  // Optionnel: source plus fraîche pour les disponibilités plateformes.
  // "tmdb" (défaut) | "hybrid" (TMDB + fallback externe) | "fresh" (externe prioritaire)
  // CONFIG.AVAILABILITY_SOURCE = "hybrid";
  // CONFIG.FRESH_AVAILABILITY_URL_TEMPLATE = "https://votre-proxy.example.com/availability/{mediaType}/{tmdbId}?country={country}";
  // CONFIG.FRESH_AVAILABILITY_API_KEY = "votre_cle_api";
  // CONFIG.FRESH_AVAILABILITY_API_KEY_HEADER = "x-api-key";
}
```

`FRESH_AVAILABILITY_URL_TEMPLATE` accepte les placeholders `{mediaType}`, `{tmdbId}` et `{country}`.

## 🎯 Lancer l'application

**Live Server (recommandé)** : clic droit sur `index.html` → "Open with Live Server"

**Fichier local** : double-cliquez sur `index.html`

## 📦 Fonctionnalités

### Collection

- ✅ Ajout, modification, suppression de films et séries
- ✅ Recherche TMDB avec auto-remplissage (titre, affiche, genres, note)
- ✅ Notation par étoiles cliquables (1 à 5)
- ✅ Filtres par type (films/séries) et statut (vu/en cours/à voir)
- ✅ Tri par date, titre, note ou année
- ✅ Recherche plein texte (titre, genre, tags)
- ✅ Badges de statut enrichis (vu, en cours, à voir, en pause, attente saison, abandonné)
- ✅ Logo de la plateforme principale directement sur les cartes quand disponible

### Fiches détaillées enrichies (TMDB)

- ✅ Backdrop grand format avec dégradé
- ✅ Synopsis en français
- ✅ Durée réelle (films) ou nombre de saisons/épisodes (séries)
- ✅ Réalisateur (films) ou créateur(s) (séries)
- ✅ Casting (6 acteurs avec photo et personnage)
- ✅ Plateformes de streaming / achat / location par région (FR)
- ✅ Disponible depuis la collection **et** depuis le Trending

### Séries

- ✅ Suivi des épisodes par saison (S01E01)
- ✅ Bandeau des séries en cours en haut de la collection
- ✅ Progression affichée directement sur les cartes de séries
- ✅ Bouton rapide `+1 épisode` sur les séries en cours
- ✅ Fiche série dédiée avec onglets `Progrès`, `Détails`, `Vidéos`
- ✅ Vue par saison avec progression détaillée
- ✅ Ouverture d'une saison au clic pour afficher la liste des épisodes
- ✅ Bouton `Vu / Pas vu` sur les épisodes déjà diffusés
- ✅ Les épisodes non sortis affichent leur date de diffusion au lieu d'un bouton d'action
- ✅ Les saisons non encore sorties sont détectées correctement et affichent leur date de sortie

### Organisation & Listes

- ✅ Tags personnalisés avec tags rapides prédéfinis
- ✅ Listes par tags avec grille de posters (sans surcharge texte)
- ✅ Suggestion aléatoire (priorise "à voir" puis "en cours")
- ✅ Historique de visionnage récent (30 derniers films/séries vus, 10 non notés)

### Statistiques

- ✅ Temps total de visionnage estimé
- ✅ Note moyenne
- ✅ Taux de complétion de la collection
- ✅ Temps restant estimé
- ✅ Nombre de séries en cours
- ✅ Ajouts du mois / de l'année
- ✅ Graphique des genres favoris
- ✅ Graphique mensuel des ajouts
- ✅ Distribution des notes
- ✅ Heatmap annuelle d'activité

### Découvrir

- ✅ Trois modes de découverte :
  - **Aléatoire** : sélection surprise de films/séries populaires
  - **Tendances** : top 6 films + 6 séries en tendance cette semaine
  - **Les plus attendus** : films et séries à venir les plus populaires (6 mois)
- ✅ Affichage des dates de sortie pour les contenus futurs
- ✅ Ajout direct à la collection depuis Découvrir

### Trending

- ✅ Mélange des films et séries populaires : tendances TMDB mondiale + top français
- ✅ Filtres Films / Séries
- ✅ Fiche enrichie avec casting et synopsis au clic
- ✅ Ajout direct à la collection depuis le trending

### Interface & Accessibilité

- ✅ Mode sombre / clair avec thème navy-blue complet
- ✅ Icônes SVG dans la barre supérieure et le menu mobile (plus d'emojis)
- ✅ Barre de recherche de section redessinée (icône SVG, bouton effacement, focus ring)
- ✅ Navigation mobile glassmorphism avec pill flottant

### Divers

- ✅ Import/Export JSON (sauvegarde complète)
- ✅ Import Letterboxd CSV (diary, watchlist, ratings avec déduplication)
- ✅ PWA — installable comme application native
- ✅ Build Android natif via Capacitor
- ✅ Stockage local (localStorage, aucun compte nécessaire)

## Mobile & Android

- **Android natif** : build Capacitor disponible dans `android/`. Après chaque modification, synchronisez avec `npm run mobile:prepare && npx cap sync`.
- **PWA (Android / Chrome / Edge)** : ouvrez l'application puis utilisez le bouton `Installer` ou le menu du navigateur pour l'ajouter à l'écran d'accueil.
- **iOS (iPhone / iPad)** : ouvrez l'application dans Safari puis utilisez `Partager` → `Sur l'écran d'accueil`.
- Le shell de l'application est mis en cache (Service Worker), ce qui permet d'ouvrir l'interface même sans connexion. Les données TMDB distantes restent dépendantes du réseau.

## 🔧 Architecture

### `config.js`

- URLs et constantes publiques de l'API TMDB
- Clé personnelle à placer dans `js/config.local.js` uniquement
- Mapping des genres (films & séries)
- Constantes (clé localStorage, durées moyennes)

### `app.js`

Contient toute la logique applicative :

- État global et persistance localStorage
- Intégration TMDB (recherche, trending, upcoming, détails enrichis avec crédits, vidéos et watch providers)
- Rendu des cards, fiches détail, statistiques, listes et suivi avancé des séries
- Gestion des modals, filtres, tri, tags
- Import/Export et PWA

## 🎨 Personnalisation

### Couleurs

Éditez la section `:root` dans `css/style.css` :

```css
:root {
  --bg-primary: #fafafa;
  --bg-secondary: #ffffff;
  --text-primary: #0a0a0a;
  --accent: #0a0a0a;
}
```

### Tags rapides

Éditez la section `.quick-tags` dans `index.html` :

```html
<span class="quick-tag" onclick="app.addQuickTag('Votre Tag')"
  >🏷️ Votre Tag</span
>
```

## 🐛 Problèmes courants

**Recherche TMDB ne fonctionne pas**
→ Vérifiez votre clé dans `js/config.local.js` et la console développeur (F12)

**Les données ne se sauvent pas**
→ localStorage est désactivé en navigation privée. Console > Application > Local Storage pour vérifier.

**Fiche enrichie ne s'affiche pas**
→ L'enrichissement nécessite un `tmdbId` (items ajoutés via la recherche TMDB ou depuis le Trending). Les items ajoutés manuellement affichent uniquement les données saisies.

**Le logo de plateforme ne s'affiche pas sur une carte**
→ Le provider principal est récupéré depuis TMDB. Ouvrez la fiche du contenu ou ré-ajoutez-le via TMDB / Trending pour enrichir les métadonnées si nécessaire.

**Les épisodes / saisons à venir semblent incohérents**
→ Les dates viennent de TMDB. Si une saison n'est pas encore sortie, elle s'affiche comme non disponible et les épisodes futurs ne peuvent pas être marqués vus.

## 🚀 Prochaines fonctionnalités envisagées

- [x] Mode sombre / clair
- [x] Recommandations personnalisées basées sur vos genres
- [x] Statistiques avancées (activité par mois, heatmap)
- [ ] Synchronisation cloud entre appareils
- [ ] Notifications de nouvelles saisons pour les séries en cours

## 📚 Ressources

- [TMDB API Docs](https://developers.themoviedb.org/3)
- [Inter Font](https://fonts.google.com/specimen/Inter)

## ✨ Crédits

- Data : [The Movie Database (TMDB)](https://www.themoviedb.org/)
- Police : [Inter](https://rsms.me/inter/) par Rasmus Andersson

---

**Bon développement ! 🎬**
