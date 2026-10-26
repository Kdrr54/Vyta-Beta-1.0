# 📱 Comment installer la Vraie Application Vyta sur ton iPhone (depuis Windows)

Comme tu n'as pas de Mac sous la main et que tu es sur un PC Windows, voici **les deux méthodes simples et éprouvées** pour avoir la vraie application native iOS (avec son icône sur ton écran d'accueil, sans navigateur web, avec accès Bluetooth complet) :

---

## 🌟 Méthode 1 : Via Apple TestFlight (Automatisé dans le Cloud)

GitHub met gratuitement à disposition des serveurs Mac dans le Cloud pour compiler ton application sans que tu aies besoin d'acheter un Mac.

### Étapes :
1. **Créer un dépôt GitHub** :
   - Crée un dépôt privé gratuit sur [github.com](https://github.com) et pousse ton code dessus (`git push`).
2. **Générer ta clé App Store Connect** :
   - Rends-toi sur [appstoreconnect.apple.com](https://appstoreconnect.apple.com) > **Utilisateurs et accès** > **Clés** > **Clé API App Store Connect**.
   - Crée une clé avec le rôle *Développeur* et télécharge le fichier `.p8`.
3. **Ajouter les 3 secrets sur GitHub** :
   - Dans ton dépôt GitHub : va dans `Settings` > `Secrets and variables` > `Actions` > `New repository secret` :
     - `APP_STORE_CONNECT_KEY_ID` : L'ID de la clé (ex: `ABC123XYZ`)
     - `APP_STORE_CONNECT_ISSUER_ID` : L'ID de l'émetteur (UUID affiché en haut de la page)
     - `APP_STORE_CONNECT_API_KEY` : Le texte contenu dans le fichier `AuthKey_XXXXXX.p8`
4. **Lancer le build** :
   - Va dans l'onglet **Actions** sur GitHub > Sélectionne **Build & Deploy iOS App** > Clique sur **Run workflow**.
   - Le serveur Mac dans le Cloud compile l'app en 5 minutes et l'envoie sur **TestFlight**.
5. **Installer sur ton iPhone** :
   - Ouvre l'application officielle **TestFlight** sur ton iPhone : l'application **Vyta** apparaît avec le bouton **« Installer »** !

---

## ⚡ Méthode 2 : Installation directe par câble USB depuis ton PC (2 minutes chrono)

Si tu veux tester l'application tout de suite sans configurer les clés de l'App Store Connect :

1. **Télécharger Sideloadly** sur ton PC Windows :
   - Télécharge gratuitement le logiciel officiel sur [https://sideloadly.io](https://sideloadly.io).
2. **Brancher ton iPhone** à ton PC Windows avec ton câble USB (fais *« Faire confiance à cet ordinateur »* sur l'iPhone).
3. **Glisser le fichier `Vyta.ipa`** dans la fenêtre de Sideloadly.
4. **Entrer ton Apple ID** (n'importe quel compte Apple gratuit fonctionne).
5. **Cliquer sur `Start`** :
   - En 30 secondes, Sideloadly signe l'application et l'installe directement sur l'écran d'accueil de ton iPhone !
6. **Sur ton iPhone** :
   - Va dans `Réglages` > `Général` > `Gestion des appareils et VPN` > Clique sur ton compte Apple > **« Faire confiance »**.
   - Lance **Vyta** : c'est la vraie application native iOS, fluide à 120 FPS, avec le Bluetooth et sans aucun navigateur !
