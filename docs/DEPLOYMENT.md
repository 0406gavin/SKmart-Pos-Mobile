# Deployment & Distribution Guide – SKmart POS (Android & Web)

This guide covers deploying **SKmart POS** to Android mobile hardware (sideloading APK, Android POS tablets/terminals), Google Play Store, or web hosting.

---

## 📱 Option 1: Android Hardware & Mobile POS Sideloading (Offline Commercial Mode)

For grocery store cashiers, Android smartphones, tablets, or handheld mobile POS devices requiring 100% offline uptime:

1. Compile the Debug APK directly from the CLI:
   ```bash
   npm run build:apk
   ```
2. Locate the generated `.apk` file:
   `android/app/build/outputs/apk/debug/app-debug.apk`
3. Transfer the `.apk` to the Android device via USB, direct transfer, or local download.
4. On the Android device, allow **Install unknown apps** for your file manager.
5. Tap the `.apk` file to install and launch **SKmart POS**.

---

## 🏬 Option 2: Google Play Store Release (AAB)

1. Build a production signed Android App Bundle (`.aab`):
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
2. Open the [Google Play Console](https://play.google.com/console).
3. Create an application listing for **SKmart POS** (package: `com.skmart.pos`).
4. Upload `android/app/build/outputs/bundle/release/app-release.aab`.
5. Complete privacy declaration (camera for barcode scanning, no background data collection) and roll out to release track.

---

## 🌐 Option 3: Web Application Hosting (Cloud / Local Server)

For web-based testing or cloud dashboard access:

1. Build the production web bundle:
   ```bash
   npm run build
   ```
2. Deploy the `dist/` directory to any static hosting provider (Cloud Run, Vercel, Netlify, or Nginx).
3. Set environment variables if needed (`GEMINI_API_KEY`, `APP_URL`).
