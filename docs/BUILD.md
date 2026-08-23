# Android APK Build & Packaging Guide – SKmart POS

Learn how to compile web production builds, synchronize Capacitor assets, and generate standalone Android APKs (`.apk`) and Android App Bundles (`.aab`) for **SKmart POS**.

---

## ⚡ 1. The Standard 3-Step APK Build (Recommended)

You do **NOT** need to install Gradle globally or manually download Gradle wrapper files.

```bash
# 1. Install Node dependencies
npm install

# 2. Check environment diagnostics
npm run doctor

# 3. Compile the debug APK
npm run build:apk
```

### Output Debug APK Location:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔧 How the Automated Build Pipeline Works

When you run `npm run build:apk`:
1. **Vite Compilation**: Compiles the React 19 + TypeScript web application into optimized static assets in `dist/`.
2. **Capacitor Synchronization**: Copies assets and native Android plugin configurations into the `android/` project.
3. **Java 17 LTS Resolution**: Automatically detects compatible JDK 17 (Eclipse Adoptium Temurin, Microsoft OpenJDK, Oracle JDK, or compatible Android Studio JBR), enforcing Java 17 compatibility across all subprojects.
4. **Gradle 8.14.3 Resolution**: Verifies the Gradle Wrapper. If corrupted or missing (such as from a ZIP export), it safely fetches official Gradle 8.14.3 from `https://services.gradle.org` into a local `.gradle-tooling/` directory over HTTPS with integrity checks.
5. **APK Assembly**: Executes `assembleDebug` and verifies the output APK file.

---

## 📱 2. Manual Capacitor Android Synchronization

Syncs web assets and native Capacitor plugins with the native Android project in `android/`:

```bash
npm run cap:sync
```

*(This runs `vite build && cap sync android` under the hood).*

---

## 🖥️ 3. Opening in Android Studio

```bash
npm run cap:open
```

Android Studio will open the `android/` directory directly, allowing you to run on physical Android devices, use emulators, and inspect logcat.

---

## 🚀 4. Building Production Signed Release APK / AAB

To generate an optimized, signed APK for commercial deployment or Google Play Store:

### Step 1: Generate Release Keystore (if needed)
```bash
keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias skmart-key
```
*(Store `release-key.jks` in a secure location and NEVER commit it to git).*

### Step 2: Configure Gradle Signing Credentials
Create or edit `android/key.properties` (or set environment variables):
```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=skmart-key
storeFile=../release-key.jks
```

### Step 3: Compile Release APK / AAB
```bash
cd android
./gradlew assembleRelease
# Or on Windows:
gradlew.bat assembleRelease

# Or for Google Play App Bundle (.aab):
./gradlew bundleRelease
```

### Output Locations:
* **Release APK**: `android/app/build/outputs/apk/release/app-release.apk`
* **Release AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 📱 Supported Architectures & ABIs

SKmart POS builds into a **Universal APK** compatible with all Android processor architectures:
* `arm64-v8a` (Modern Android smartphones & POS tablets)
* `armeabi-v7a` (Legacy 32-bit Android devices)
* `x86_64` (Android Emulators & Chromebooks)
* `x86` (32-bit Android Emulators)
