# System Configuration Guide – SKmart POS (Android & Web)

Customize your store settings, invoice templates, UPI payment credentials, thermal receipt layouts, and hardware scanner options for **SKmart POS**.

---

## 🏪 Shop Profile & Invoice Settings

Navigate to **Shop Settings** in the left navigation drawer:

* **Shop Name**: Appears on bill headers, thermal receipts, and app title.
* **Owner Name**: Used for audit logs and store manager profile.
* **GSTIN / Tax ID**: Tax identification number displayed on tax invoices.
* **Shop Address & Phone Number**: Printed on thermal customer receipts.
* **Low Stock Limit Warning**: Minimum quantity trigger for stock alerts (default: `10` units).
* **Default Tax Rate (%)**: Default GST percentage applied to new items.
* **Security PIN**: 4-digit master PIN for terminal lock, price editing, and administrative overrides.

---

## 💳 Dynamic UPI Payment Configuration

To enable instant QR payment generation on cashier screens without third-party fees:

1. Go to **Shop Settings** -> **Dynamic UPI Payment Settings**.
2. Toggle on **Enable Dynamic UPI Payments**.
3. Enter your **Merchant UPI ID (VPA)** (e.g. `yourshop@okaxis` or `merchant@upi`).
4. Enter **Receipt Footer Note** (e.g. *Thank you for shopping at SKmart!*).
5. Click **Save UPI Settings**.

---

## 📷 Barcode Scanner & Camera Setup

1. **Android Live Camera Scanner**:
   - The app uses `@capacitor-mlkit/barcode-scanning`, `@capacitor/camera`, and `@zxing/browser` for real-time mobile camera scanning with autofocus, beep sounds, and physical vibration haptics.
   - Grant Camera permission when prompted on first use.
2. **Hardware USB / Bluetooth Scanner**:
   - Pair a Bluetooth or USB-C OTG Barcode Scanner with your Android device in HID Keyboard Wedge mode.
   - Any scanned barcode instantly finds and adds the product to the active POS Billing cart.

