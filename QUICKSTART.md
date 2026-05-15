# 🚀 DÉMARRAGE RAPIDE - CinéTracker

## ⏱️ 5 minutes pour tout installer !

### Étape 1 : Télécharger et décompresser

1. ✅ Téléchargez `cinetracker-project.zip`
2. ✅ Décompressez le fichier
3. ✅ Vous avez maintenant un dossier `cinetracker`

### Étape 2 : Ouvrir dans VS Code

1. Lancez **Visual Studio Code**
2. Cliquez sur **File > Open Folder**
3. Sélectionnez le dossier **cinetracker**
4. VS Code va s'ouvrir avec votre projet !

### Étape 3 : Installer les extensions (1 minute)

VS Code va vous proposer d'installer des extensions recommandées :

- **Live Server** ← LA PLUS IMPORTANTE !
- Prettier, ESLint, etc.

👉 Cliquez sur **"Install All"** ou **"Installer tout"**

### Étape 4 : Ajouter votre clé API TMDB (2 minutes)

**Vous avez déjà votre clé API ? Super !**

1. Dans VS Code, créez le fichier `js/config.local.js`
2. Ajoutez :
   ```javascript
   if (typeof CONFIG !== "undefined") {
     CONFIG.TMDB_API_KEY = "votre_vraie_clé_ici";

         // Optionnel: source plus fraiche pour les dispos plateformes
         // CONFIG.AVAILABILITY_SOURCE = "hybrid"; // "tmdb" | "hybrid" | "fresh"
         // CONFIG.FRESH_AVAILABILITY_URL_TEMPLATE = "https://votre-proxy.example.com/availability/{mediaType}/{tmdbId}?country={country}";
         // CONFIG.FRESH_AVAILABILITY_API_KEY = "votre_cle_api";
         // CONFIG.FRESH_AVAILABILITY_API_KEY_HEADER = "x-api-key";
   }
   ```
3. Sauvegardez (Ctrl+S ou Cmd+S). Ce fichier est ignoré par Git.

**Vous n'avez pas encore de clé ?**

1. Allez sur https://www.themoviedb.org/settings/api
2. Cliquez "Request an API Key"
3. Choisissez "Developer"
4. Remplissez le formulaire (nom : "CinéTracker", URL : "http://localhost")
5. Copiez votre clé (la "API Key v3", PAS le token)
6. Retour à l'étape ci-dessus !

### Étape 5 : Lancer l'application ! (10 secondes)

**Méthode 1 - Live Server (Recommandée) :**

1. Faites un **clic droit** sur `index.html`
2. Cliquez sur **"Open with Live Server"**
3. 🎉 L'app s'ouvre dans votre navigateur !

**Méthode 2 - Fichier local :**

1. Double-cliquez sur `index.html`
2. Ça fonctionne aussi, mais pas de rechargement auto

### Étape 6 : L'installer sur mobile

**Android (Chrome / Edge)**

1. Ouvrez l'application déployée via HTTPS ou sur votre réseau local
2. Touchez le bouton `📲`
3. Validez `Installer`

**iPhone / iPad (Safari)**

1. Ouvrez l'application dans Safari
2. Touchez `Partager`
3. Choisissez `Sur l'écran d'accueil`

**Important**

- Le mode application mobile complet nécessite un serveur HTTP(S). Les fonctionnalités PWA comme le cache offline et l'installation ne s'activent pas correctement en ouvrant directement le fichier HTML depuis le disque.

---

## ✅ Vérification rapide

**L'app fonctionne si :**

- ✅ Vous voyez "CinéTracker" en haut
- ✅ Le bouton "+ Ajouter" fonctionne
- ✅ La recherche TMDB trouve des films
- ✅ Les tendances s'affichent dans l'onglet "Trending"
- ✅ Les plateformes de streaming apparaissent sur certaines cartes / fiches
- ✅ L'onglet "À venir" affiche les prochains épisodes et saisons

**Problèmes ?**

❌ **"Clé API TMDB manquante"**
→ Vous avez oublié l'étape 4 !

❌ **Rien ne se passe**
→ Ouvrez la console (F12) et vérifiez les erreurs

❌ **Live Server ne marche pas**
→ Vérifiez que l'extension est bien installée

❌ **Les logos de plateformes n'apparaissent pas partout**
→ Ouvrez la fiche d'un contenu TMDB pour enrichir ses métadonnées

❌ **Les épisodes d'une saison ne se chargent pas**
→ Vérifiez que la série a bien été ajoutée via TMDB ou Trending et qu'elle possède un `tmdbId`

---

## 🎯 Prochaines étapes

Maintenant que tout fonctionne :

1. **Ajoutez votre premier film :**
   - Cliquez sur "+ Ajouter"
   - Cherchez "Inception"
   - Cliquez sur le résultat
   - Enregistrez !

2. **Explorez les fonctionnalités :**
   - 📊 Statistiques
   - 📅 À venir
   - 🏷️ Tags personnalisés
   - 🔥 Trending
   - 📺 Suivi des séries par saison et épisode
   - 🎲 Suggestion aléatoire
   - 💾 Import/Export

3. **Testez le suivi des séries :**
   - Ajoutez une série depuis TMDB
   - Ouvrez sa fiche
   - Allez dans l'onglet **Progrès**
   - Ouvrez une saison pour voir les épisodes
   - Marquez les épisodes diffusés comme vus

4. **Personnalisez :**
   - Modifiez les couleurs dans `css/style.css`
   - Ajoutez vos propres tags
   - Organisez votre collection !

---

## 💡 Astuces

**Raccourcis VS Code :**

- `Ctrl+S` : Sauvegarder
- `Ctrl+P` : Rechercher un fichier
- `Ctrl+Shift+F` : Rechercher dans tout le projet

**Live Server :**

- Modifications automatiquement visibles
- Pas besoin de recharger !

**Console navigateur (F12) :**

- Utile pour déboguer
- Affiche les erreurs

---

## 📚 Documentation complète

Pour aller plus loin, lisez le **README.md** complet !

---

**Bon développement ! 🎬✨**
