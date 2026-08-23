# Changelog

All notable changes to **SKmart POS (Android Mobile & Web)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-15

### Added
- **Android Capacitor Platform**: Built with Capacitor 8 for Android smartphones, tablets, and handheld mobile POS terminals.
- **Native Android Barcode & Camera Scanning**: Integrated `@capacitor-mlkit/barcode-scanning`, `@capacitor/camera`, and `@zxing/browser` with camera permissions, autofocus guard, and continuous batch scan mode.
- **Native Haptic Physical Feedback**: Added `@capacitor/haptics` vibration feedback on successful barcode scans, quantity adjustments, and error alerts.
- **Mobile Responsive Drawer & Navbar**: Touch-friendly navigation drawer sidebar, mobile quick-action bar, responsive data tables with touch scroll wrappers, and 44px+ touch targets for cashier handhelds.
- **Dynamic UPI QR Payment Generator**: Generates instant standard UPI QR codes (`upi://pay`) with custom merchant VPA and bill amount without third-party gateway commission fees.
- **Comprehensive Grocery Modules**: High-speed POS Billing, Inventory Batch Control, Expiration & Low Stock Alerts, Khata Customer Ledger, Supplier Procurement, Employee Attendance & Shifts, Cash Register Drawer, Thermal Receipt & Barcode Label Designer, SQLite Storage, and Recycle Bin Data Recovery.
- **Automated GitHub Actions CI/CD**: Workflow to automatically compile Android Debug APKs on git push.
