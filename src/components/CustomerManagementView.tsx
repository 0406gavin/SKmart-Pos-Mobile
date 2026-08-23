import React, { useState, useEffect } from 'react';
import { Customer, ShopSettings, Sale } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { TouchTableWrapper } from './TouchTableWrapper';
import { DraggableScrollContainer } from './DraggableScrollContainer';
import { backNavigationManager } from '../utils/backNavigationManager';
import { 
  Users, 
  UserPlus, 
  Search, 
  Phone, 
  Mail, 
  Award, 
  CreditCard, 
  DollarSign, 
  Edit, 
  Trash2, 
  X, 
  FileText,
  ShoppingCart,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface CustomerManagementViewProps {
  settings: ShopSettings;
  onSelectCustomerForPOS?: (customer: Customer) => void;
  targetCustomerId?: string | null;
  onClearTargetCustomer?: () => void;
}

export const CustomerManagementView: React.FC<CustomerManagementViewProps> = ({
  settings,
  onSelectCustomerForPOS,
  targetCustomerId,
  onClearTargetCustomer,
}) => {
  const [customers, setCustomers] = useState<Customer[]>(() => sqliteDB.getCustomers());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [onlyDuesFilter, setOnlyDuesFilter] = useState<boolean>(false);
  const [highlightedCustomerId, setHighlightedCustomerId] = useState<string | null>(null);

  // Auto-scroll and highlight target customer when navigated from global search
  useEffect(() => {
    if (targetCustomerId) {
      setSelectedTag('ALL');
      setOnlyDuesFilter(false);
      setSearchQueryTarget(targetCustomerId);
    }
  }, [targetCustomerId]);

  const setSearchQueryTarget = (targetId: string) => {
    setSearchTerm('');
    setHighlightedCustomerId(targetId);

    const scrollTimer = setTimeout(() => {
      const mobileEl = document.getElementById(`customer-card-${targetId}`);
      const desktopEl = document.getElementById(`customer-row-${targetId}`);
      const targetEl = mobileEl || desktopEl;

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    const highlightTimer = setTimeout(() => {
      setHighlightedCustomerId(null);
      if (onClearTargetCustomer) {
        onClearTargetCustomer();
      }
    }, 4000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(highlightTimer);
    };
  };
  
  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
  const [showDuesModal, setShowDuesModal] = useState<Customer | null>(null);
  const [payDuesAmount, setPayDuesAmount] = useState<number>(0);
  const [showHistoryModal, setShowHistoryModal] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Register customer management modals in central Back Navigation Manager
  useEffect(() => {
    if (!showAddEditModal && !showDuesModal && !showHistoryModal && !customerToDelete) return;

    return backNavigationManager.register('customer-management-modal', () => {
      if (customerToDelete) {
        setCustomerToDelete(null);
        return true;
      }
      if (showDuesModal) {
        setShowDuesModal(null);
        return true;
      }
      if (showHistoryModal) {
        setShowHistoryModal(null);
        return true;
      }
      if (showAddEditModal) {
        setShowAddEditModal(false);
        setEditingCustomer(null);
        return true;
      }
      return false;
    }, 80);
  }, [showAddEditModal, showDuesModal, showHistoryModal, customerToDelete]);

  const refreshCustomers = () => {
    setCustomers(sqliteDB.getCustomers());
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesTag = selectedTag === 'ALL' || c.tag === selectedTag;
    const matchesDues = !onlyDuesFilter || (c.outstandingDues || 0) > 0;
    return matchesSearch && matchesTag && matchesDues;
  });

  const totalOutstandingDues = customers.reduce((acc, c) => acc + (c.outstandingDues || 0), 0);
  const totalWithDuesCount = customers.filter(c => (c.outstandingDues || 0) > 0).length;

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer?.name || !editingCustomer?.phone) return;

    sqliteDB.saveCustomer({
      ...editingCustomer,
      name: editingCustomer.name,
      phone: editingCustomer.phone,
    });

    setShowAddEditModal(false);
    setEditingCustomer(null);
    refreshCustomers();
  };

  const confirmDeleteCustomer = () => {
    if (!customerToDelete) return;
    sqliteDB.deleteCustomer(customerToDelete.id);
    setCustomerToDelete(null);
    refreshCustomers();
  };

  const handlePayDues = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDuesModal || payDuesAmount <= 0) return;

    sqliteDB.payCustomerDues(showDuesModal.id, payDuesAmount);
    setShowDuesModal(null);
    setPayDuesAmount(0);
    refreshCustomers();
  };

  const getCustomerSales = (phone: string): Sale[] => {
    return sqliteDB.getSales().filter(s => s.customerPhone === phone);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" />
            <span>Customer Management & Dues Ledger</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track customer purchase history, loyalty rewards, store credits, and outstanding dues.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCustomer({ tag: 'Regular', outstandingDues: 0 });
            setShowAddEditModal(true);
          }}
          className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm cursor-pointer touch-manipulation"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Summary Stat Cards - 2x2 on Mobile, 4 columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Customers */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate">
              Total Customers
            </p>
            <p className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
              {customers.length}
            </p>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Outstanding Dues */}
        <button
          type="button"
          onClick={() => setOnlyDuesFilter(prev => !prev)}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition cursor-pointer active:scale-95 flex items-center justify-between touch-manipulation ${
            onlyDuesFilter 
              ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 ring-2 ring-amber-400/40' 
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xs'
          }`}
          title="Click to filter customers with dues"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight truncate">
                Outstanding Dues
              </p>
              {totalWithDuesCount > 0 && (
                <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  {totalWithDuesCount}
                </span>
              )}
            </div>
            <p className="text-lg sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 truncate font-mono">
              {settings.currencySymbol}{totalOutstandingDues.toLocaleString()}
            </p>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </button>

        {/* VIP Customers */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate">
              VIP Members
            </p>
            <p className="text-lg sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {customers.filter(c => c.tag === 'VIP').length}
            </p>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Loyalty Points */}
        <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate">
              Loyalty Points
            </p>
            <p className="text-lg sm:text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5 truncate font-mono">
              {customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0)} <span className="text-[10px] sm:text-xs font-normal">pts</span>
            </p>
          </div>
          <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer name, phone number..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOnlyDuesFilter(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 ${
              onlyDuesFilter
                ? 'bg-rose-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Has Dues ({totalWithDuesCount})</span>
          </button>
        </div>

        {/* Tag Filters */}
        <DraggableScrollContainer className="pt-1">
          {['ALL', 'VIP', 'Regular', 'Wholesale'].map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition cursor-pointer active:scale-95 ${
                selectedTag === tag
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </DraggableScrollContainer>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs font-medium">No matching customer records found.</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const hasDues = (customer.outstandingDues || 0) > 0;
            const isHighlighted = highlightedCustomerId === customer.id;

            return (
              <div
                id={`customer-card-${customer.id}`}
                key={customer.id}
                className={`p-3.5 rounded-2xl border transition-all duration-500 ${
                  isHighlighted
                    ? 'bg-purple-50/90 dark:bg-purple-950/70 border-purple-500 ring-2 ring-purple-500/40 scale-[1.02] shadow-lg'
                    : hasDues
                    ? 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/60 shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Top Row: Name, Tag & Action Menu */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                        {customer.name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        customer.tag === 'VIP' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300' :
                        customer.tag === 'Wholesale' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {customer.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{customer.id}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomer(customer);
                        setShowAddEditModal(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer active:scale-95"
                      title="Edit Customer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerToDelete(customer)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer active:scale-95"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contact row */}
                <div className="mt-2 flex items-center justify-between text-xs border-y border-slate-100 dark:border-slate-700/60 py-2">
                  <a
                    href={`tel:${customer.phone}`}
                    className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{customer.phone}</span>
                  </a>
                  {customer.email && (
                    <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                      {customer.email}
                    </span>
                  )}
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-3 gap-2 mt-2.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl text-center">
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Total Spent</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {settings.currencySymbol}{customer.totalSpent.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Loyalty</span>
                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 font-mono">
                      {customer.loyaltyPoints} pts
                    </span>
                  </div>
                  <div>
                    <span className="block text-[9px] uppercase font-bold text-slate-400">Dues</span>
                    {hasDues ? (
                      <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                        {settings.currencySymbol}{customer.outstandingDues.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600 flex items-center justify-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Clear
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons for Mobile */}
                <div className="mt-3 flex items-center gap-2">
                  {onSelectCustomerForPOS && (
                    <button
                      type="button"
                      onClick={() => onSelectCustomerForPOS(customer)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Bill POS</span>
                    </button>
                  )}

                  {hasDues && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDuesModal(customer);
                        setPayDuesAmount(customer.outstandingDues);
                      }}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Pay Dues</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(customer)}
                    className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer"
                    title="View Purchase Ledger"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <TouchTableWrapper>
          <table className="w-full text-left border-collapse text-xs min-w-[650px] whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Customer Info</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Tag</th>
                <th className="py-3 px-4 text-right">Total Spent</th>
                <th className="py-3 px-4 text-right">Loyalty Points</th>
                <th className="py-3 px-4 text-right">Outstanding Dues</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    No matching customer records found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => {
                  const isHighlighted = highlightedCustomerId === customer.id;

                  return (
                    <tr 
                      id={`customer-row-${customer.id}`}
                      key={customer.id} 
                      className={`transition-all duration-500 ${
                        isHighlighted 
                          ? 'bg-purple-100/80 dark:bg-purple-950/60 font-semibold border-y-2 border-purple-500' 
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/40'
                      }`}
                    >
                      <td className="py-3 px-4 font-medium">
                        <div className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{customer.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{customer.id}</div>
                      </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{customer.phone}</span>
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Mail className="w-3 h-3" />
                          <span>{customer.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        customer.tag === 'VIP' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300' :
                        customer.tag === 'Wholesale' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {customer.tag}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800 dark:text-slate-100 font-mono">
                      {settings.currencySymbol}{customer.totalSpent.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-sky-600 dark:text-sky-400 font-mono">
                      {customer.loyaltyPoints} pts
                    </td>
                    <td className="py-3 px-4 text-right">
                      {customer.outstandingDues > 0 ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-lg font-mono">
                          {settings.currencySymbol}{customer.outstandingDues.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Cleared</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onSelectCustomerForPOS && (
                          <button
                            type="button"
                            onClick={() => onSelectCustomerForPOS(customer)}
                            className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 font-medium text-[11px] px-2 cursor-pointer active:scale-95"
                            title="Select for POS Billing"
                          >
                            Bill POS
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setShowHistoryModal(customer)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95"
                          title="View Purchase History"
                        >
                          <FileText className="w-4 h-4" />
                        </button>

                        {customer.outstandingDues > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowDuesModal(customer);
                              setPayDuesAmount(customer.outstandingDues);
                            }}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition cursor-pointer active:scale-95"
                            title="Clear Dues"
                          >
                            Pay Dues
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomer(customer);
                            setShowAddEditModal(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(customer)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 rounded-lg cursor-pointer active:scale-95"
                          title="Delete Customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </TouchTableWrapper>
      </div>

      {/* Delete Customer Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-100 dark:border-rose-900/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Delete Customer?</h3>
                <p className="text-xs text-slate-500">This will remove this customer record.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">{customerToDelete.name}</div>
              <div className="text-slate-500 font-mono">ID: {customerToDelete.id} • Phone: {customerToDelete.phone}</div>
              {(customerToDelete.outstandingDues || 0) > 0 && (
                <div className="mt-2 p-2 bg-rose-50 dark:bg-rose-950/80 rounded-lg text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Has {settings.currencySymbol}{customerToDelete.outstandingDues} outstanding dues!</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCustomer}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {editingCustomer?.id ? 'Edit Customer Profile' : 'Add New Customer'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddEditModal(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingCustomer?.name || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Mobile Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={editingCustomer?.phone || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Tag / Tier</label>
                  <select
                    value={editingCustomer?.tag || 'Regular'}
                    onChange={e => setEditingCustomer(prev => ({ ...prev, tag: e.target.value as any }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                  >
                    <option value="Regular">Regular</option>
                    <option value="VIP">VIP Customer</option>
                    <option value="Wholesale">Wholesale Buyer</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Credit Dues ({settings.currencySymbol})</label>
                  <input
                    type="number"
                    value={editingCustomer?.outstandingDues || 0}
                    onChange={e => setEditingCustomer(prev => ({ ...prev, outstandingDues: Number(e.target.value) }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingCustomer?.email || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  value={editingCustomer?.address || ''}
                  onChange={e => setEditingCustomer(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Street / Apartment address"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-sm cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Outstanding Dues Modal */}
      {showDuesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-4 sm:p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Clear Outstanding Dues</h3>
              <button 
                type="button"
                onClick={() => setShowDuesModal(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs">
              <div className="text-slate-700 dark:text-slate-300 font-medium">Customer: <strong className="text-slate-900 dark:text-white">{showDuesModal.name}</strong></div>
              <div className="text-slate-500 mt-0.5">Phone: {showDuesModal.phone}</div>
              <div className="mt-1.5 text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                <span>Current Total Dues:</span>
                <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                  {settings.currencySymbol}{showDuesModal.outstandingDues}
                </span>
              </div>
            </div>

            <form onSubmit={handlePayDues} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount Received ({settings.currencySymbol})
                </label>
                <input
                  type="number"
                  min={1}
                  max={showDuesModal.outstandingDues}
                  value={payDuesAmount}
                  onChange={e => setPayDuesAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none font-bold text-base font-mono"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDuesModal(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-sm cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Purchase History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Purchase Ledger: {showHistoryModal.name}</h3>
                <p className="text-xs text-slate-500">Phone: {showHistoryModal.phone}</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowHistoryModal(null)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 text-xs flex-1 pr-1">
              {getCustomerSales(showHistoryModal.phone).length === 0 ? (
                <p className="text-center py-8 text-slate-400">No previous purchase receipts found for this mobile number.</p>
              ) : (
                getCustomerSales(showHistoryModal.phone).map(sale => (
                  <div key={sale.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-600">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{sale.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">{new Date(sale.dateTime).toLocaleString()} • {sale.paymentMode}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">{settings.currencySymbol}{sale.totalAmount}</div>
                      <div className="text-[10px] text-slate-500">{sale.items.length} item(s)</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

