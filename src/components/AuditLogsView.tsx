import React, { useState } from 'react';
import { AuditLog, ShopSettings } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { TouchTableWrapper } from './TouchTableWrapper';
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  User, 
  FileSpreadsheet,
  Activity,
  Calendar,
  X,
  Lock,
  RefreshCw,
  Info
} from 'lucide-react';

interface AuditLogsViewProps {
  settings: ShopSettings;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ settings }) => {
  const [logs, setLogs] = useState<AuditLog[]>(() => sqliteDB.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const refreshLogs = () => {
    setLogs(sqliteDB.getAuditLogs());
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('UNLOCK')) {
      return 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40';
    }
    if (act.includes('SALE') || act.includes('BILL') || act.includes('CASH')) {
      return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40';
    }
    if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('CLEAR') || act.includes('VOID') || act.includes('FAIL')) {
      return 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40';
    }
    if (act.includes('STOCK') || act.includes('INVENTORY') || act.includes('PRICE') || act.includes('EDIT') || act.includes('UPDATE')) {
      return 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40';
    }
    return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
  };

  // Distinct action categories for filter tabs
  const distinctActions = ['ALL', ...Array.from(new Set(logs.map(l => l.action)))].slice(0, 8);

  const filteredLogs = logs.filter(l => {
    const matchesSearch = !searchTerm.trim() ||
      l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === 'ALL' || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Security Audit Trail & Activity Logs</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete activity log recording sales, register transactions, stock adjustments, and staff actions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold whitespace-nowrap">
            {logs.length} Total Logs
          </span>
          <button
            onClick={refreshLogs}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search audit logs by staff member, action, or details..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Action Filter Pills */}
        {distinctActions.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {distinctActions.map(action => (
              <button
                key={action}
                onClick={() => setActionFilter(action)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  actionFilter === action
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {action === 'ALL' ? 'All Activities' : action}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MOBILE VIEW: High-Density Touch Cards (< md breakpoint) */}
      <div className="block md:hidden space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-500" />
            No security audit records match your search.
          </div>
        ) : (
          filteredLogs.map(log => {
            const dateObj = new Date(log.timestamp);
            const dateFormatted = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div
                key={log.id}
                className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2"
              >
                {/* Header: Action Badge & Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                    {log.action}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{dateFormatted} • {timeFormatted}</span>
                  </span>
                </div>

                {/* Staff Member */}
                <div className="flex items-center gap-1.5 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{log.user}</span>
                </div>

                {/* Details Content */}
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-sans leading-relaxed break-words">
                  {log.details}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP/TABLET VIEW: Full Tabular View (>= md breakpoint) */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <TouchTableWrapper>
          <table className="w-full text-left border-collapse text-xs min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-44">Timestamp</th>
                <th className="py-3 px-4 w-48">Staff Member</th>
                <th className="py-3 px-4 w-36">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No security audit records logged yet.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{log.user}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-xs">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TouchTableWrapper>
      </div>
    </div>
  );
};
