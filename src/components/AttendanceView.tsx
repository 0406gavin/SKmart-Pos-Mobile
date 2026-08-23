import React, { useState } from 'react';
import { AttendanceRecord, Employee, ShopSettings } from '../types';
import { sqliteDB } from '../db/sqliteStorage';
import { 
  Clock, 
  UserCheck, 
  LogIn, 
  LogOut, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  X,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { playPosErrorBeep, playPosSuccessBeep } from '../utils/sound';

interface AttendanceViewProps {
  settings: ShopSettings;
  onShowToast?: (msg: string) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ settings, onShowToast }) => {
  const allEmployees = sqliteDB.getEmployees();
  const currentUser = sqliteDB.getCurrentUser();
  const isOwner = currentUser?.role === 'Owner';

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => sqliteDB.getAttendance());
  const [localToast, setLocalToast] = useState<string | null>(null);

  // Modal State for PIN verification before check-in / check-out
  const [activePinPrompt, setActivePinPrompt] = useState<{
    emp: Employee;
    type: 'checkIn' | 'checkOut';
  } | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const showToastMsg = (msg: string) => {
    if (onShowToast) {
      onShowToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3000);
    }
  };

  const refreshAttendance = () => {
    setAttendance(sqliteDB.getAttendance());
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // RBAC: Owner sees all employees; Cashier/Staff sees only self
  const visibleEmployees = isOwner 
    ? allEmployees 
    : allEmployees.filter(e => e.id === currentUser?.id);

  const visibleAttendance = isOwner
    ? attendance
    : attendance.filter(a => a.employeeId === currentUser?.id);

  const handleOpenPinPrompt = (emp: Employee, type: 'checkIn' | 'checkOut') => {
    setActivePinPrompt({ emp, type });
    setEnteredPin('');
    setPinError('');
  };

  const handleVerifyAndSubmitAttendance = () => {
    if (!activePinPrompt) return;
    if (enteredPin.length !== 4) return;

    const { emp, type } = activePinPrompt;

    if (emp.pin === enteredPin) {
      playPosSuccessBeep();
      if (type === 'checkIn') {
        const rec = sqliteDB.checkInEmployee(emp.id);
        refreshAttendance();
        showToastMsg(`Checked in successfully: ${emp.name} at ${rec?.checkInTime}`);
      } else {
        const rec = sqliteDB.checkOutEmployee(emp.id);
        refreshAttendance();
        showToastMsg(`Checked out: ${emp.name} at ${rec?.checkOutTime} (${rec?.workingHours || 8} hrs)`);
      }
      setActivePinPrompt(null);
      setEnteredPin('');
      setPinError('');
    } else {
      playPosErrorBeep();
      if (navigator.vibrate) {
        try { navigator.vibrate([100, 50, 100]); } catch {}
      }
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setEnteredPin('');
      setPinError('Incorrect Security PIN! Verification failed.');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Toast Notification */}
      {localToast && (
        <div className="fixed top-16 right-6 z-50 bg-slate-900 text-emerald-400 border border-emerald-500/30 px-4 py-2.5 rounded-xl shadow-xl font-semibold text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{localToast}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Clock className="w-6 h-6 text-emerald-600" />
          Employee Daily Attendance & Duty Roster
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {isOwner 
            ? 'Track employee check-in, check-out times, working hours and shift status.' 
            : 'Your personal daily check-in, check-out & working hours log.'}{' '}
          Date: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{todayStr}</span>
        </p>
      </div>

      {/* Staff Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {visibleEmployees.map(emp => {
          const todayRecord = attendance.find(a => a.employeeId === emp.id && a.date === todayStr);

          return (
            <div key={emp.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{emp.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{emp.role}</p>
                </div>

                {todayRecord ? (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    todayRecord.checkOutTime 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                      : todayRecord.status === 'Late' 
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {todayRecord.checkOutTime ? 'Shift Completed' : todayRecord.status}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-full text-[10px] font-bold">
                    Not Checked In
                  </span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl text-xs space-y-1 font-mono text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Check In Time:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{todayRecord?.checkInTime || '--:--'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Check Out Time:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{todayRecord?.checkOutTime || '--:--'}</span>
                </div>
                {todayRecord?.workingHours !== undefined && (
                  <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-600/60 text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Working Hours:</span>
                    <span>{todayRecord.workingHours} hrs</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {!todayRecord ? (
                  <button
                    onClick={() => handleOpenPinPrompt(emp, 'checkIn')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Check In Staff</span>
                  </button>
                ) : !todayRecord.checkOutTime ? (
                  <button
                    onClick={() => handleOpenPinPrompt(emp, 'checkOut')}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Check Out Staff</span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 bg-slate-100 dark:bg-slate-700/60 text-slate-500 text-xs font-bold text-center rounded-xl flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Shift Completed Today ({todayRecord.workingHours || 8} hrs)</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Attendance History Log Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center justify-between">
          <span>{isOwner ? 'Recent Staff Attendance Records' : 'My Attendance History'}</span>
          <span className="text-xs text-slate-400 font-normal">{visibleAttendance.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4 text-center">Shift Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-300">
              {visibleAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No attendance logs recorded yet.
                  </td>
                </tr>
              ) : (
                visibleAttendance.map(att => (
                  <tr key={att.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition">
                    <td className="py-3 px-4 font-mono">{att.date}</td>
                    <td className="py-3 px-4 font-bold">{att.employeeName}</td>
                    <td className="py-3 px-4 font-mono text-emerald-600">{att.checkInTime}</td>
                    <td className="py-3 px-4 font-mono text-amber-600">{att.checkOutTime || 'Active Shift'}</td>
                    <td className="py-3 px-4 font-mono font-bold">
                      {att.workingHours ? `${att.workingHours} hrs` : '--'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        att.checkOutTime ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {att.checkOutTime ? 'Completed' : att.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PIN Verification Modal for Attendance */}
      {activePinPrompt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700 text-center relative">
            <button 
              onClick={() => setActivePinPrompt(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                {activePinPrompt.type === 'checkIn' ? 'Staff Check In' : 'Staff Check Out'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter {activePinPrompt.emp.name}'s 4-digit PIN to confirm
              </p>
            </div>

            {/* PIN Dots */}
            <div className={`flex justify-center gap-3 py-1 ${isShaking ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition ${
                    enteredPin.length > i
                      ? 'bg-emerald-600 border-emerald-600 scale-110'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                />
              ))}
            </div>

            {pinError && <p className="text-xs font-bold text-rose-600">{pinError}</p>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  onClick={() => {
                    if (enteredPin.length < 4) {
                      setEnteredPin(prev => prev + d);
                      setPinError('');
                    }
                  }}
                  className="py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-base transition"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={() => { setEnteredPin(''); setPinError(''); }}
                className="py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl font-bold text-slate-600 dark:text-slate-300 text-xs"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  if (enteredPin.length < 4) {
                    setEnteredPin(prev => prev + '0');
                    setPinError('');
                  }
                }}
                className="py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-xl font-bold text-slate-800 dark:text-slate-100 text-base"
              >
                0
              </button>
              <button
                onClick={handleVerifyAndSubmitAttendance}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
