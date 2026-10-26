# 🚀 Guide Déploiement Apple TestFlight — Vyta One

Ce guide te montre comment envoyer ton application **Vyta** sur ton vrai iPhone en utilisant ton compte **Apple Developer** (`Team ID: ZCU3WN2ZW4`).

---

## 📋 Prérequis
- Un Mac avec **Xcode** installé (gratuit sur le Mac App Store).
- Ton compte Apple Developer configuré dans Xcode (`Settings > Accounts > Add Apple ID`).

---

## 🛠️ Étape 1 : Préparation du projet iOS

Dans le terminal de ton projet :
```bash
# 1. Compiler les assets web
npm run build

# 2. Installer Capacitor iOS (le pont natif officiel)
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 3. Initialiser le conteneur iOS
npx cap add ios
npx cap sync ios
```

---

## 🍏 Étape 2 : Signature avec ton Team ID dans Xcode

Ouvre le projet dans Xcode :
```bash
npx cap open ios
```

1. Dans le navigateur de gauche dans Xcode, clique sur le projet tout en haut : **App**.
2. Va dans l'onglet **Signing & Capabilities**.
3. Coche **Automatically manage signing**.
4. Dans **Team**, sélectionne ton équipe : `Mazari Kader (ZCU3WN2ZW4)`.
5. Dans **Bundle Identifier**, vérifie : `com.vyta.app`.

---

## 📦 Étape 3 : Archivage & Envoi vers TestFlight

1. Dans la barre de menu en haut de Xcode, sélectionne la cible : **Any iOS Device (arm64)** (au lieu d'un simulateur).
2. Clique sur le menu **Product > Archive**.
3. Une fois l'archive terminée (environ 1 minute), la fenêtre **Organizer** s'ouvre.
4. Clique sur le bouton bleu **« Distribute App »**.
5. Choisis **« TestFlight & App Store »**, puis clique sur **Next > Next > Upload**.

---

## 📲 Étape 4 : Installer sur ton iPhone

1. Ouvre l'application **TestFlight** sur ton iPhone (téléchargeable sur l'App Store).
2. Connecte-toi avec ton compte Apple.
3. L'application **Vyta** apparaîtra avec un bouton **« Installer »** !
4. L'application est installée sur ton vrai iPhone avec :
   - Capteurs Bluetooth de la bague Vyta One
   - Apple HealthKit synchronisé avec Apple Santé
   - Vraie carte Apple Plans officielle
   - Dynamic Island et Live Activities en temps réel !
