/**
 * Main Application Shell for Offline Grocery Shop Management Software (Desktop POS)
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  TabType, 
  ShopSettings, 
  Product, 
  Sale, 
  IncomingStockLog, 
  CartItem,
  DashboardMetrics 
} from './types';
import { sqliteDB } from './db/sqliteStorage';

// Components
import { NavbarHeader } from './components/NavbarHeader';
import { Sidebar } from './components/Sidebar';
import { FirstTimeSetupModal } from './components/FirstTimeSetupModal';
import { DashboardView } from './components/DashboardView';
import { POSBillingView } from './components/POSBillingView';
import { ProductManagementView } from './components/ProductManagementView';
import { IncomingStockView } from './components/IncomingStockView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { ReportsView } from './components/ReportsView';
import { BarcodeGeneratorView } from './components/BarcodeGeneratorView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { InvoiceModal } from './components/InvoiceModal';
import { CameraScannerModal } from './components/CameraScannerModal';
import { LoadingScreen } from './components/LoadingScreen';
import { cameraPrewarmer } from './utils/cameraPrewarmer';

// Enterprise Commercial Modules
import { CustomerManagementView } from './components/CustomerManagementView';
import { SupplierManagementView } from './components/SupplierManagementView';
import { PurchaseOrderView } from './components/PurchaseOrderView';
import { ExpenseManagementView } from './components/ExpenseManagementView';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { AttendanceView } from './components/AttendanceView';
import { InventoryIntelligenceView } from './components/InventoryIntelligenceView';
import { ReturnsExchangesView } from './components/ReturnsExchangesView';
import { AuditLogsView } from './components/AuditLogsView';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { PinLockModal } from './components/PinLockModal';
import { LabelDesignerModal } from './components/LabelDesignerModal';

// Modules 28-50 Advanced Enterprise Views
import { CashRegisterView } from './components/CashRegisterView';
import { SmartReorderView } from './components/SmartReorderView';
import { BranchManagementView } from './components/BranchManagementView';
import { RecycleBinView } from './components/RecycleBinView';
import { HealthMonitorView } from './components/HealthMonitorView';
import { PriceHistoryView } from './components/PriceHistoryView';
import { UpiSettingsSection } from './components/UpiSettingsSection';

import { Store, Phone, MapPin, FileText, CheckCircle, Receipt } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { backNavigationManager } from './utils/backNavigationManager';

export default function App() {
  const [settings, setSettings] = useState<ShopSettings>(() => sqliteDB.getSettings());
  const [products, setProducts] = useState<Product[]>(() => sqliteDB.getProducts());
  const [sales, setSales] = useState<Sale[]>(() => sqliteDB.getSales());
  const [stockLogs, setStockLogs] = useState<IncomingStockLog[]>(() => sqliteDB.getStockLogs());
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [navigationHistory, setNavigationHistory] = useState<TabType[]>(['dashboard']);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [targetItemId, setTargetItemId] = useState<string | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);

  // Cold start animated launch screen state
  // Initialized to true on every fresh app mount/launch (cold start).
  // Remains false throughout the active session during in-app navigation and tab switches.
  const [showLaunchScreen, setShowLaunchScreen] = useState<boolean>(true);

  // Clear any legacy flags from previous builds to ensure smooth lifecycle
  useEffect(() => {
    try {
      sessionStorage.removeItem('skmart_pos_cold_launched');
      localStorage.removeItem('skmart_pos_cold_launched');
    } catch {
      // ignore
    }
  }, []);

  const handleLaunchAnimationComplete = () => {
    setShowLaunchScreen(false);
  };

  // Navigation handler that maintains history stack
  const navigateToTab = (tab: TabType, replace: boolean = false) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    setNavigationHistory(prev => {
      if (replace) {
        return [...prev.slice(0, -1), tab];
      }
      if (prev.length > 0 && prev[prev.length - 1] === tab) {
        return prev;
      }
      return [...prev, tab];
    });
  };

  // Scroll to top when changing active tabs (only if not navigating to a specific target item)
  useEffect(() => {
    if (targetItemId) return;

    const scrollToTop = () => {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        mainContentRef.current.scrollTop = 0;
      }
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    scrollToTop();
    const rafId = requestAnimationFrame(scrollToTop);
    const timeoutId = setTimeout(scrollToTop, 50);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
    };
  }, [activeTab, targetItemId]);

  // Modals
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Sale | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [scannerConfig, setScannerConfig] = useState<{ mode: 'single' | 'continuous'; title?: string; subtitle?: string }>({
    mode: 'continuous',
  });
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [productForBarcodeLabel, setProductForBarcodeLabel] = useState<Product | null>(null);

  const handleOpenScanner = (options?: { mode?: 'single' | 'continuous'; title?: string; subtitle?: string }) => {
    const isSingleTab = activeTab === 'products' || activeTab === 'stock_in';
    setScannerConfig({
      mode: options?.mode || (isSingleTab ? 'single' : 'continuous'),
      title: options?.title || (activeTab === 'products' ? 'Scan Product Barcode' : activeTab === 'stock_in' ? 'Scan Stock Item' : 'Camera Barcode Scanner'),
      subtitle: options?.subtitle,
    });
    setIsCameraScannerOpen(true);
  };

  // Enterprise Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [isLabelDesignerOpen, setIsLabelDesignerOpen] = useState(false);
  const [settingsResetModal, setSettingsResetModal] = useState<'clear' | 'sample' | null>(null);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  const showGlobalToast = (msg: string) => {
    setGlobalToast(msg);
    setTimeout(() => setGlobalToast(null), 3500);
  };

  // Pre-warm camera session when entering Billing, Products, or Stock-In screens (after launch screen is complete)
  useEffect(() => {
    if (!showLaunchScreen && (activeTab === 'pos' || activeTab === 'products' || activeTab === 'stock_in')) {
      cameraPrewarmer.preload();
    }
  }, [activeTab, showLaunchScreen]);

  // Keyboard Shortcuts (Ctrl+K for Search, F2 for POS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('pos');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Physical Android Hardware Back Button Master Listener
  useEffect(() => {
    let appBackListenerHandle: any = null;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', () => {
        const wasHandled = backNavigationManager.dispatchBack();
        if (!wasHandled) {
          // Genuinely at root screen with no active modal, drawer, or sub-navigation -> Exit App cleanly
          CapacitorApp.exitApp();
        }
      }).then(handle => {
        appBackListenerHandle = handle;
      }).catch(err => {
        console.warn('Error setting up App backButton listener:', err);
      });
    }

    return () => {
      if (appBackListenerHandle && typeof appBackListenerHandle.remove === 'function') {
        appBackListenerHandle.remove();
      }
    };
  }, []);

  // Register App-level modals & overlays in backNavigationManager (Priority 90)
  useEffect(() => {
    if (!isInvoiceModalOpen && !isSearchOpen && !isLabelDesignerOpen && !settingsResetModal && !isMobileMenuOpen) return;

    return backNavigationManager.register('app-overlays-and-modals', () => {
      if (isInvoiceModalOpen) {
        setIsInvoiceModalOpen(false);
        return true;
      }
      if (isSearchOpen) {
        setIsSearchOpen(false);
        return true;
      }
      if (isLabelDesignerOpen) {
        setIsLabelDesignerOpen(false);
        return true;
      }
      if (settingsResetModal) {
        setSettingsResetModal(null);
        return true;
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return true;
      }
      return false;
    }, 90);
  }, [isInvoiceModalOpen, isSearchOpen, isLabelDesignerOpen, settingsResetModal, isMobileMenuOpen]);

  // Register Tab Navigation History in backNavigationManager (Priority 10)
  useEffect(() => {
    // If we have history entries to go back to (i.e. more than 1 item, or not currently at dashboard/root)
    if (navigationHistory.length <= 1 && activeTab === 'dashboard') return;

    return backNavigationManager.register('screen-tab-navigation', () => {
      if (navigationHistory.length > 1) {
        const newHistory = [...navigationHistory];
        newHistory.pop(); // Remove current tab
        const prevTab = newHistory[newHistory.length - 1];
        setNavigationHistory(newHistory);
        setActiveTab(prevTab);
        return true;
      } else if (activeTab !== 'dashboard') {
        // If somehow history was 1 but we're on a non-dashboard screen, return to dashboard
        setActiveTab('dashboard');
        setNavigationHistory(['dashboard']);
        return true;
      }
      return false;
    }, 10);
  }, [navigationHistory, activeTab]);

  // Enforce light theme always, independent of OS settings
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Refresh local memory state from SQLite storage
  const refreshAllState = () => {
    setSettings(sqliteDB.getSettings());
    setProducts(sqliteDB.getProducts());
    setSales(sqliteDB.getSales());
    setStockLogs(sqliteDB.getStockLogs());
  };

  // --- Handlers ---
  const handleUpdateSettings = (newSettings: Partial<ShopSettings>) => {
    const updated = sqliteDB.saveSettings(newSettings);
    setSettings(updated);
  };

  const handleSaveProduct = (productData: Partial<Product> & { name: string; barcode: string; purchasePrice: number; sellingPrice: number; mrp?: number; quantity: number }) => {
    sqliteDB.saveProduct(productData);
    refreshAllState();
  };

  const handleDeleteProduct = (id: string) => {
    sqliteDB.deleteProduct(id);
    refreshAllState();
  };

  const handleAddExistingStock = (
    productId: string, 
    qtyToAdd: number, 
    newPurchasePrice?: number, 
    newSellingPrice?: number, 
    newMrp?: number,
    supplierName?: string
  ) => {
    sqliteDB.addStock(productId, qtyToAdd, newPurchasePrice, newSellingPrice, newMrp, supplierName);
    refreshAllState();
  };

  const handleRecordSale = (
    cartItems: CartItem[],
    customerName: string,
    customerPhone: string,
    paymentMode: 'Cash' | 'UPI' | 'Card' | 'Credit',
    receivedAmount: number,
    discountAmount: number,
    taxPercent: number
  ): Sale => {
    const sale = sqliteDB.recordSale(
      cartItems,
      customerName,
      customerPhone,
      paymentMode,
      receivedAmount,
      discountAmount,
      taxPercent
    );

    refreshAllState();

    // Automatically trigger Invoice Print Modal
    setSelectedInvoiceForModal(sale);
    setIsInvoiceModalOpen(true);

    return sale;
  };

  const handleCancelSale = (saleId: string) => {
    sqliteDB.cancelSale(saleId);
    refreshAllState();
  };

  const handleExportBackup = () => {
    try {
      const backupJsonStr = sqliteDB.exportBackupJSON();
      const blob = new Blob([backupJsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `grocery_pos_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      console.error('Backup export failed:', err);
    }
  };

  const handleImportBackup = (jsonContent: string): boolean => {
    const ok = sqliteDB.importBackupJSON(jsonContent);
    if (ok) {
      refreshAllState();
    }
    return ok;
  };

  const handleResetToSampleData = () => {
    sqliteDB.resetToSampleData();
    refreshAllState();
  };

  const handleClearAllDataForFreshStart = (customSettings?: Partial<ShopSettings>) => {
    sqliteDB.clearAllDataForFreshStart(customSettings);
    refreshAllState();
  };

  const handleViewInvoice = (sale: Sale) => {
    setSelectedInvoiceForModal(sale);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenBarcodeGeneratorForProduct = (product: Product) => {
    setProductForBarcodeLabel(product);
    navigateToTab('barcodes');
  };

  const metrics: DashboardMetrics = sqliteDB.getMetrics();
  const lowStockProducts = products.filter(p => p.quantity <= (p.minStockLevel || settings.lowStockThreshold));

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 flex flex-col font-sans select-none antialiased">
      
      {/* Top Application Navbar Titlebar */}
      <NavbarHeader
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onNavigate={(tab) => {
          navigateToTab(tab);
        }}
        activeTab={activeTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        onLockTerminal={() => setIsTerminalLocked(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onNavigate={(tab) => {
            navigateToTab(tab);
          }}
          lowStockCount={metrics.lowStockCount}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Workspace View */}
        <main ref={mainContentRef} className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              recentSales={sales}
              lowStockProducts={lowStockProducts}
              settings={settings}
              onNavigate={(tab) => navigateToTab(tab)}
              onViewInvoice={handleViewInvoice}
              onQuickAddProduct={() => navigateToTab('products')}
            />
          )}

          {activeTab === 'pos' && (
            <POSBillingView
              products={products}
              settings={settings}
              onRecordSale={handleRecordSale}
              onOpenCameraScanner={() => handleOpenScanner({ mode: 'continuous', title: 'Scan Items to Cart', subtitle: 'Continuous cashier barcode scanner' })}
              scannedBarcode={scannedBarcode}
              onClearScannedBarcode={() => setScannedBarcode(null)}
              onUpdateSettings={handleUpdateSettings}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerManagementView
              settings={settings}
              targetCustomerId={targetItemId}
              onClearTargetCustomer={() => setTargetItemId(null)}
              onSelectCustomerForPOS={(cust) => {
                navigateToTab('pos');
              }}
            />
          )}

          {activeTab === 'cash_register' && (
            <CashRegisterView />
          )}

          {activeTab === 'smart_reorder' && (
            <SmartReorderView />
          )}

          {activeTab === 'branches' && (
            <BranchManagementView />
          )}

          {activeTab === 'recycle_bin' && (
            <RecycleBinView />
          )}

          {activeTab === 'health_monitor' && (
            <HealthMonitorView />
          )}

          {activeTab === 'price_history' && (
            <PriceHistoryView />
          )}

          {activeTab === 'suppliers' && (
            <SupplierManagementView
              settings={settings}
              targetSupplierId={targetItemId}
              onClearTargetSupplier={() => setTargetItemId(null)}
            />
          )}

          {activeTab === 'purchase_orders' && (
            <PurchaseOrderView
              settings={settings}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpenseManagementView
              settings={settings}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeeManagementView
              settings={settings}
              onShowToast={showGlobalToast}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceView
              settings={settings}
              onShowToast={showGlobalToast}
            />
          )}

          {activeTab === 'inventory_intel' && (
            <InventoryIntelligenceView
              settings={settings}
            />
          )}

          {activeTab === 'returns' && (
            <ReturnsExchangesView
              settings={settings}
              onViewInvoice={handleViewInvoice}
              onReturnProcessed={refreshAllState}
            />
          )}

          {activeTab === 'audit_logs' && (
            <AuditLogsView
              settings={settings}
            />
          )}

          {activeTab === 'products' && (
            <ProductManagementView
              products={products}
              settings={settings}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onOpenBarcodeGenerator={handleOpenBarcodeGeneratorForProduct}
              onOpenCameraScanner={(opts) => handleOpenScanner({ mode: 'single', title: 'Scan Product Barcode', subtitle: 'Single scan for product registration', ...opts })}
              scannedBarcode={scannedBarcode}
              onClearScannedBarcode={() => setScannedBarcode(null)}
              targetProductId={targetItemId}
              onClearTargetProduct={() => setTargetItemId(null)}
            />
          )}

          {activeTab === 'stock_in' && (
            <IncomingStockView
              products={products}
              settings={settings}
              onAddExistingStock={handleAddExistingStock}
              onSaveNewProduct={handleSaveProduct}
              stockLogs={stockLogs}
              onOpenCameraScanner={() => handleOpenScanner({ mode: 'single', title: 'Scan Stock Item Barcode', subtitle: 'Single scan for inventory update' })}
              scannedBarcode={scannedBarcode}
              onClearScannedBarcode={() => setScannedBarcode(null)}
            />
          )}

          {activeTab === 'sales_history' && (
            <SalesHistoryView
              sales={sales}
              settings={settings}
              onViewInvoice={handleViewInvoice}
              onCancelSale={handleCancelSale}
              targetSaleId={targetItemId}
              onClearTargetSale={() => setTargetItemId(null)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              sales={sales}
              products={products}
              settings={settings}
            />
          )}

          {activeTab === 'barcodes' && (
            <BarcodeGeneratorView
              products={products}
              selectedProductForLabel={productForBarcodeLabel}
              settings={settings}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreView
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onResetToSampleData={handleResetToSampleData}
              onClearAllData={handleClearAllDataForFreshStart}
            />
          )}

          {activeTab === 'settings' && (
            <div className="p-6 max-w-3xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-3">
                  Shop Profile & Invoice Settings
                </h2>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold mb-1">Shop Name</label>
                    <input
                      type="text"
                      value={settings.shopName}
                      onChange={e => handleUpdateSettings({ shopName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Owner Name</label>
                    <input
                      type="text"
                      value={settings.ownerName}
                      onChange={e => handleUpdateSettings({ ownerName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={settings.phone}
                      onChange={e => handleUpdateSettings({ phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">GSTIN Number</label>
                    <input
                      type="text"
                      value={settings.gstNumber || ''}
                      onChange={e => handleUpdateSettings({ gstNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">Shop Address</label>
                    <input
                      type="text"
                      value={settings.address}
                      onChange={e => handleUpdateSettings({ address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">Low Stock Limit Warning</label>
                    <input
                      type="number"
                      value={settings.lowStockThreshold}
                      onChange={e => handleUpdateSettings({ lowStockThreshold: parseInt(e.target.value) || 10 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>General profile settings saved in local database.</span>
                </div>
              </div>

              {/* Tax & Billing Dedicated Settings Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  Tax & Billing Settings
                </h3>

                {/* Default GST Calculation Mode */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Default GST Mode for Future Invoices
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ gstMode: 'inclusive' })}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        (settings.gstMode || 'inclusive') === 'inclusive'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-slate-900 dark:text-slate-100">
                        <span>• Price Includes GST (Recommended)</span>
                        {(settings.gstMode || 'inclusive') === 'inclusive' && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        "GST is already included in the selling price."<br />
                        <span className="font-medium text-slate-700 dark:text-slate-300">Example: Price ₹100 → Customer Pays ₹100</span>
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateSettings({ gstMode: 'exclusive' })}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        settings.gstMode === 'exclusive'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs text-slate-900 dark:text-slate-100">
                        <span>• Add GST to Bill</span>
                        {settings.gstMode === 'exclusive' && (
                          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                        "GST is added on top of the selling price."<br />
                        <span className="font-medium text-slate-700 dark:text-slate-300">Example: Price ₹100 + 18% GST → Customer Pays ₹118</span>
                      </p>
                    </button>
                  </div>
                </div>

                {/* Round Off and Default GST % */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Automatic Round Off
                    </label>
                    <select
                      value={settings.roundOffMode || 'nearest_1'}
                      onChange={e => handleUpdateSettings({ roundOffMode: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-medium text-xs"
                    >
                      <option value="nearest_1">Enabled (Round bill to nearest ₹1)</option>
                      <option value="none">Disabled (Exact decimals)</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">Automatically rounds final invoice total (+₹0.25 / -₹0.40).</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Default Store Tax / GST (%)
                    </label>
                    <input
                      type="number"
                      value={settings.defaultTaxPercent}
                      onChange={e => handleUpdateSettings({ defaultTaxPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl font-mono text-xs font-bold"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Fallback tax percentage for uncategorized items.</p>
                  </div>
                </div>
              </div>

              {/* Dynamic UPI Payment Settings Card */}
              <UpiSettingsSection
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />

              {/* Fresh Start Store Deployment Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  Store Data Reset & Fresh Start
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If you are deploying this software for a brand new shop owner, click below to wipe all demo sample data (products, sales history, demo customers) so they can start entering real inventory from scratch.
                </p>

                {settingsToast && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 dark:text-emerald-200 animate-fadeIn">
                    {settingsToast}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSettingsResetModal('clear')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Wipe Demo Data & Start Fresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsResetModal('sample')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Load Demo Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Reset Confirmation Modal */}
          {settingsResetModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl animate-fadeIn">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {settingsResetModal === 'clear' ? 'Wipe All Demo Data & Start Fresh?' : 'Reload Sample Grocery Dataset?'}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {settingsResetModal === 'clear'
                    ? 'Are you sure you want to wipe all demo sample data? All sample products, sales history, customers, and expenses will be cleared so you can enter your real store data from scratch.'
                    : 'Are you sure you want to reload the initial sample grocery dataset (Atta, Sunflower Oil, Tata Salt, etc.)?'}
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettingsResetModal(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (settingsResetModal === 'clear') {
                        handleClearAllDataForFreshStart();
                        setSettingsToast('All demo data wiped! You now have a 100% clean slate to enter real store data.');
                      } else {
                        handleResetToSampleData();
                        setSettingsToast('Sample grocery dataset loaded into local database.');
                      }
                      setSettingsResetModal(null);
                      setTimeout(() => setSettingsToast(null), 4000);
                    }}
                    className={`px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer ${
                      settingsResetModal === 'clear' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-900'
                    }`}
                  >
                    {settingsResetModal === 'clear' ? 'Yes, Wipe & Start Fresh' : 'Yes, Load Demo Data'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Global Search Modal */}
      {isSearchOpen && (
        <GlobalSearchModal
          settings={settings}
          onClose={() => setIsSearchOpen(false)}
          onNavigate={(tab, targetId) => {
            if (targetId) {
              setTargetItemId(targetId);
            }
            navigateToTab(tab);
          }}
        />
      )}

      {/* Global Toast Notification */}
      {globalToast && (
        <div className="fixed top-16 right-6 z-50 bg-slate-900 text-emerald-400 border border-emerald-500/40 px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce select-none">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{globalToast}</span>
        </div>
      )}

      {/* Terminal PIN Lock Screen */}
      {isTerminalLocked && (
        <PinLockModal
          onUnlock={(msg) => {
            setIsTerminalLocked(false);
            if (msg) showGlobalToast(msg);
          }}
        />
      )}

      {/* First Time Setup Wizard Modal */}
      <FirstTimeSetupModal
        isOpen={!settings.isSetupCompleted}
        onSave={handleUpdateSettings}
        onClearAllData={handleClearAllDataForFreshStart}
        initialSettings={settings}
      />

      {/* Invoice Modal for Thermal / A4 Print */}
      <InvoiceModal
        sale={selectedInvoiceForModal}
        settings={settings}
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
      />

      {/* Webcam Camera Barcode Reader Modal */}
      <CameraScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onScanSuccess={(barcode) => {
          setScannedBarcode(barcode);
        }}
        products={products}
        currencySymbol={settings.currencySymbol}
        mode={scannerConfig.mode}
        title={scannerConfig.title}
        subtitle={scannerConfig.subtitle}
      />

      {/* Cold Start Animated Launch Screen */}
      {showLaunchScreen && (
        <LoadingScreen onAnimationComplete={handleLaunchAnimationComplete} durationMs={4000} />
      )}

    </div>
  );
}
