# CineTracker Mobile

Ce projet est configure avec Capacitor pour generer une application Android a partir de l'app web statique.

## Commandes utiles

```bash
npm install
npm run cap:sync
npm run cap:open:android
```

## Build Android debug

```bash
npm run android:build:debug
```

Le build demande un JDK installe et `JAVA_HOME` configure. Android Studio installe generalement les outils Android necessaires.

## iOS

iOS demande obligatoirement macOS avec Xcode.

Sur un Mac :

```bash
npm install
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

Ensuite, dans Xcode :

- choisis une equipe Apple Developer dans `Signing & Capabilities`
- selectionne un simulateur ou un iPhone branche
- lance l'app avec le bouton Run

Pour publier sur l'App Store, il faudra aussi un compte Apple Developer payant.

## Fonctionnement

- `scripts/prepare-mobile.js` copie les fichiers web dans `www/`.
- Capacitor copie ensuite `www/` dans `android/app/src/main/assets/public`.
- `www/` est genere et ignore par Git.

Quand tu modifies `index.html`, `css/`, `js/`, `assets/`, `manifest.json` ou `service-worker.js`, relance :

```bash
npm run cap:sync
```
