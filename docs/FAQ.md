# Frequently Asked Questions (FAQ) – SKmart POS

### Q1: Do I need to install Gradle on my computer to build the APK?
**No.** You do not need to install Gradle globally or set environment variables for it. Running `npm run build:apk` automatically manages the Gradle 8.14.3 toolchain, verifying and obtaining it from official Gradle servers over HTTPS if needed.

---

### Q2: What if `gradle-wrapper.jar` was corrupted during a ZIP extraction?
Our build system in `scripts/build-apk.js` and `scripts/gradle-manager.js` is self-healing. When you run `npm run build:apk`, it automatically detects if the wrapper JAR is missing or corrupted, downloads official Gradle 8.14.3 to a local `.gradle-tooling/` folder, and builds the APK seamlessly without user intervention.

---

### Q3: Does SKmart POS require an active internet connection to operate?
**No.** The core POS billing, barcode scanning, inventory management, customer khata ledger, cash register, and dynamic UPI QR code generation work **100% offline**. Data is stored locally in the embedded SQLite storage engine. An internet connection is only needed if you choose to use the optional Google Gemini AI stock demand forecasting insights.

---

### Q4: Does dynamic UPI payment require a third-party payment gateway subscription or fees?
**No.** The dynamic UPI module constructs standard compliant UPI payment deep links (`upi://pay?pa=...`) rendered into high-resolution QR codes directly on the mobile screen. Customer payments transfer instantly and directly from their bank to your shop VPA without any transaction percentage cuts or gateway fees.

---

### Q5: How do I back up my shop inventory and sales data?
Navigate to **Backup & Restore** in the navigation drawer. Click **Export Complete Database (.json)** to generate a full, single-file backup copy of your products, sales history, customers, suppliers, expenses, and settings. You can import this JSON file anytime to restore or migrate data.

---

### Q6: Can I print bills using a Bluetooth or USB thermal receipt printer?
**Yes.** Standard 58mm and 80mm ESC/POS thermal printers are supported via standard Android print services or Bluetooth connection. Click **Print** on any invoice card to generate a formatted thermal bill.

---

### Q7: How do I secure the POS terminal when leaving the counter?
Click the **Lock** icon in the top navigation header. The screen locks instantly, requiring the 4-digit Master Security PIN to resume operations.
