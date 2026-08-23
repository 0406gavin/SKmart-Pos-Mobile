# Installation Guide – SKmart POS (Android Mobile & Web)

Follow these step-by-step instructions to set up, build, and run the **SKmart POS** mobile application on your development machine or Android POS terminal.

---

## 📋 Prerequisites

Ensure your development environment meets the following requirements:

* **Node.js**: `v20.0.0` or higher ([Download Node.js](https://nodejs.org/))
* **npm**: `v9.0.0` or higher (comes bundled with Node.js)
* **Android Studio**: Android Studio (Ladybug, Koala, Jellyfish, or newer)
  * Includes Java JDK 17/21 automatically in its bundled `jbr/` directory.
  * Standard Android SDK Platforms (Android 14/15, API 34/35/36) & Build-Tools.
* **Git**: Installed on your system

> 💡 **No Global Gradle Required**: You do NOT need to install Gradle manually or add it to your system PATH. The build pipeline bootstraps Gradle 8.14.3 automatically.

---

## 🚀 Step 1: Clone or Extract Repository

```bash
git clone https://github.com/PplCallMeSk-15/SKmart-Pos-Mobile.git
cd SKmart-Pos-Mobile
```

---

## 📦 Step 2: Install Node Dependencies

Run the following command in the project root folder:

```bash
npm install
```

---

## 🩺 Step 3: Run Environment Diagnostics

```bash
npm run doctor
```

This verifies that Node.js, Java, Android SDK, and Gradle toolchains are ready.

---

## 📱 Step 4: Compile Android APK

```bash
npm run build:apk
```

The debug APK will be generated at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 💻 Step 5: Web Development Preview (Optional)

To run the application in live browser development mode:

```bash
npm run dev
```

Navigate to `http://localhost:3000` in Google Chrome or any modern mobile browser.
