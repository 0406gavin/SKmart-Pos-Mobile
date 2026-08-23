import React, { useState, useEffect, useRef } from 'react';
import { Product, ShopSettings } from '../types';
import { 
  Barcode as BarcodeIcon, 
  Printer, 
  Search, 
  Check, 
  ChevronDown, 
  X, 
  Edit3, 
  Package, 
  Sparkles,
  Sliders,
  Tag
} from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorViewProps {
  products: Product[];
  selectedProductForLabel: Product | null;
  settings: ShopSettings;
}

const StickerItem: React.FC<{
  shopName: string;
  name: string;
  barcode: string;
  price: number | string;
  currency: string;
}> = ({ shopName, name, barcode, price, currency }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && barcode) {
      try {
        JsBarcode(svgRef.current, barcode, {
          format: 'CODE128',
          width: 1.2,
          height: 32,
          displayValue: true,
          fontSize: 9,
          margin: 2,
        });
      } catch (err) {
        console.error('Barcode error', err);
      }
    }
  }, [barcode]);

  return (
    <div className="p-2.5 bg-white text-black rounded-lg border border-slate-300 shadow-2xs text-center font-sans text-xs flex flex-col justify-between break-inside-avoid">
      <div>
        <p className="font-bold text-[10px] text-slate-700 tracking-tight uppercase truncate">{shopName}</p>
        <p className="font-semibold text-[11px] truncate leading-tight mt-0.5">{name}</p>
      </div>

      <div className="my-1 flex justify-center">
        <svg ref={svgRef} className="max-w-full h-auto" />
      </div>

      <p className="font-black text-xs font-mono text-slate-900">
        PRICE: {currency}{price}
      </p>
    </div>
  );
};

export const BarcodeGeneratorView: React.FC<BarcodeGeneratorViewProps> = ({
  products,
  selectedProductForLabel,
  settings,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    selectedProductForLabel ? selectedProductForLabel.id : (products[0]?.id || '')
  );
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [customBarcode, setCustomBarcode] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [copies, setCopies] = useState<number>(12);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const currency = settings.currencySymbol || '₹';

  const activeProduct = products.find(p => p.id === selectedProductId);

  const displayBarcode = activeProduct ? activeProduct.barcode : (customBarcode || '8901234567890');
  const displayName = activeProduct ? activeProduct.name : (customName || 'Sample Grocery Product');
  const displayPrice = activeProduct ? activeProduct.sellingPrice : (parseFloat(customPrice) || 100);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedProductForLabel) {
      setSelectedProductId(selectedProductForLabel.id);
    }
  }, [selectedProductForLabel]);

  useEffect(() => {
    if (barcodeSvgRef.current && displayBarcode) {
      try {
        JsBarcode(barcodeSvgRef.current, displayBarcode, {
          format: 'CODE128',
          width: 1.8,
          height: 45,
          displayValue: true,
          fontSize: 12,
          margin: 5,
        });
      } catch (err) {
        console.error('Barcode rendering error', err);
      }
    }
  }, [displayBarcode, selectedProductId]);

  const filteredProducts = products.filter(p => 
    !productSearch.trim() || 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode.includes(productSearch) ||
    (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const handlePrintLabels = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('Standard window.print failed, attempting popup print:', err);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const stickersHtml = Array.from({ length: copies }).map(() => `
          <div style="
            width: 58mm;
            height: 38mm;
            padding: 3mm;
            border: 1px solid #000;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            font-family: Arial, sans-serif;
            background: #fff;
            color: #000;
            page-break-inside: avoid;
          ">
            <div style="font-size: 10px; font-weight: bold; text-transform: uppercase;">${settings.shopName || 'MY STORE'}</div>
            <div style="font-size: 11px; font-weight: 600; margin: 2px 0;">${displayName}</div>
            <svg class="barcode-svg" data-code="${displayBarcode}"></svg>
            <div style="font-size: 11px; font-weight: bold; font-family: monospace;">OUR PRICE: ${currency}${displayPrice}</div>
          </div>
        `).join('');

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Barcode Sticker Sheet Print</title>
              <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
              <style>
                body { margin: 10mm; padding: 0; background: #fff; }
                .grid {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 5mm;
                }
                @media print {
                  body { margin: 0; }
                  .grid { gap: 3mm; }
                }
              </style>
            </head>
            <body>
              <div class="grid">${stickersHtml}</div>
              <script>
                window.onload = function() {
                  document.querySelectorAll('.barcode-svg').forEach(function(el) {
                    try {
                      JsBarcode(el, el.getAttribute('data-code'), {
                        format: "CODE128",
                        width: 1.4,
                        height: 35,
                        displayValue: true,
                        fontSize: 10,
                        margin: 2
                      });
                    } catch(e){}
                  });
                  setTimeout(function() {
                    window.print();
                    window.close();
                  }, 300);
                };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarcodeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Barcode Sticker Label Generator</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Generate and print customized barcode stickers for items without pre-printed barcodes.
          </p>
        </div>

        <button
          onClick={handlePrintLabels}
          className="w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>Print Sheet ({copies} Labels)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        
        {/* Left Controls (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>Label Configuration</span>
          </h3>

          {/* Custom Styled Mobile Searchable Picker */}
          <div className="space-y-1.5" ref={dropdownRef}>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Product from Inventory
            </label>

            <div className="relative">
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-left flex items-center justify-between gap-2 shadow-2xs hover:border-emerald-500 transition cursor-pointer"
              >
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                  {activeProduct ? (
                    <div className="min-w-0 truncate">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{activeProduct.name}</span>
                      <span className="text-slate-500 ml-1.5 font-mono">({currency}{activeProduct.sellingPrice})</span>
                    </div>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Custom Manual Entry</span>
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Dropdown with Search & Scroll */}
              {isDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  {/* Search Field */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        placeholder="Search product by name, barcode, category..."
                        className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      />
                      {productSearch && (
                        <button
                          onClick={() => setProductSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                    {/* Custom Entry Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProductId('');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 text-left flex items-center justify-between gap-2 hover:bg-emerald-50 dark:hover:bg-slate-700 transition cursor-pointer ${
                        !selectedProductId ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Edit3 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">-- Custom Barcode Entry --</p>
                          <p className="text-[10px] text-slate-400">Enter custom product name, price & barcode</p>
                        </div>
                      </div>
                      {!selectedProductId && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>

                    {/* Products List */}
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        No matching products found.
                      </div>
                    ) : (
                      filteredProducts.map(p => {
                        const isSelected = p.id === selectedProductId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProductId(p.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full p-2.5 text-left flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer ${
                              isSelected ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate leading-tight">{p.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{currency}{p.sellingPrice}</span>
                                <span>•</span>
                                <span>Code: {p.barcode}</span>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom Entry Fields if not selected from inventory */}
          {!selectedProductId && (
            <div className="space-y-3 pt-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Label Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fresh Sugar 1kg"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Barcode Number
                  </label>
                  <input
                    type="text"
                    placeholder="8901234567890"
                    value={customBarcode}
                    onChange={e => setCustomBarcode(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Price ({currency})
                  </label>
                  <input
                    type="number"
                    placeholder="50"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Copies Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Number of Label Copies to Print
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[6, 12, 24, 40].map(qty => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setCopies(qty)}
                  className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                    copies === qty
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>

          {/* Single Live Preview */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Live Single Sticker Preview</span>
            <div className="p-3 bg-white text-black rounded-lg border border-slate-300 max-w-[210px] mx-auto shadow-2xs text-center font-sans">
              <p className="font-bold text-[11px] truncate uppercase">{settings.shopName || 'MY STORE'}</p>
              <p className="text-[11px] font-semibold truncate leading-tight mt-0.5">{displayName}</p>
              <div className="my-1 flex justify-center">
                <svg ref={barcodeSvgRef} className="max-w-full h-auto" />
              </div>
              <p className="font-black text-xs font-mono">OUR PRICE: {currency}{displayPrice}</p>
            </div>
          </div>
        </div>

        {/* Right Preview Sheet (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Printable Sticker Sheet ({copies} Stickers)
            </h3>
            <span className="text-xs text-slate-400 font-mono">A4 Page Grid</span>
          </div>

          <div className="printable-area p-3 sm:p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-700 min-h-[350px]">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {Array.from({ length: copies }).map((_, idx) => (
                <StickerItem
                  key={idx}
                  shopName={settings.shopName || 'Store'}
                  name={displayName}
                  barcode={displayBarcode}
                  price={displayPrice}
                  currency={currency}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
