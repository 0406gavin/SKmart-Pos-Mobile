# API & Data Layer Documentation – SKmart POS

The **SKmart POS** application operates on an offline-first architecture powered by an embedded client-side SQLite storage engine layer (`src/db/sqliteStorage.ts`). Below is the internal API specification for interacting with local data models.

---

## 💾 Storage Engine (`sqliteDB`)

### 1. Products API

#### `getProducts(): Product[]`
Returns all active inventory items.

#### `addProduct(product: Omit<Product, 'id'>): Product`
Creates a new product record with generated ID, barcode, price tiers, stock count, and timestamp.

#### `updateProduct(id: string, updates: Partial<Product>): void`
Updates existing product details (price, stock quantity, min stock level, batch).

#### `deleteProduct(id: string): void`
Moves product to the local Recycle Bin for safety and data recovery.

---

### 2. POS Sales & Billing API

#### `saveSaleTransaction(sale: SaleTransaction): void`
Persists a completed billing invoice, automatically deducts stock levels, updates customer ledger dues if credit/khata, and logs audit entries.

#### `getSalesHistory(): SaleTransaction[]`
Returns historical invoices sorted chronologically with refund and reprint capabilities.

---

### 3. Dynamic UPI Payment Service (`UPIPaymentService`)

#### `generateUPIString(request: { amount: number; transactionNote?: string }): string`
Generates standard NPCI-compliant UPI deep-link URI:
```
upi://pay?pa=YOUR_VPA&pn=SHOP_NAME&am=AMOUNT&cu=INR&tn=NOTE
```

#### `generateQRCodeDataURL(request: { amount: number; transactionNote?: string }): Promise<string>`
Returns a Base64 PNG QR Code data URL for immediate rendering on cashier mobile screens.
