'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useApp } from '@/contexts/useApp';
import { attendanceAPI } from '@/lib/api-service';
import { AttendanceRecord, TeamAttendanceEntry } from '@/lib/types';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Pencil,
  X,
  Loader2,
  User,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Helpers ────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

function isWeekendDate(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

// ─── Live Timer Hook ────────────────────────────

function useLiveTimer(checkInTime: string | null) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!checkInTime) {
      setElapsed(0);
      return;
    }

    const update = () => {
      const diffMs = Date.now() - new Date(checkInTime).getTime();
      setElapsed(Math.max(0, diffMs / 1000));
    };

    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkInTime]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = Math.floor(elapsed % 60);

  return {
    elapsed,
    display: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    hoursDecimal: elapsed / 3600,
  };
}

// ─── SHIFT TARGET ───────────────────────────────

const SHIFT_HOURS = 9;

// ─── Employee Check-In/Out Card ─────────────────

function CheckInOutCard({
  todayRecord,
  unclosedEntry,
  onCheckIn,
  onCheckOut,
  loading,
}: {
  todayRecord: AttendanceRecord | null;
  unclosedEntry: AttendanceRecord | null;
  onCheckIn: () => void;
  onCheckOut: () => void;
  loading: boolean;
}) {
  const isCheckedIn = todayRecord && !todayRecord.checkOut;
  const isCheckedOut = todayRecord && todayRecord.checkOut;
  const hasUnclosed = !!unclosedEntry;

  const timer = useLiveTimer(isCheckedIn ? todayRecord.checkIn : null);

  const hoursWorked = isCheckedOut && todayRecord.hoursWorked
    ? parseFloat(todayRecord.hoursWorked)
    : isCheckedIn
      ? timer.hoursDecimal
      : 0;

  const deficit = SHIFT_HOURS - hoursWorked;

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-6">
      {/* Unclosed entry warning */}
      {hasUnclosed && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-status-amber-soft px-3 py-2 text-[13px] text-status-amber">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            You have an unclosed check-in from{' '}
            <strong>{formatDate(unclosedEntry.date)}</strong>.
            Check out to close it first.
          </span>
        </div>
      )}

      <div className="flex flex-col items-center text-center space-y-4">
        {/* Status text */}
        <div>
          {!todayRecord && !hasUnclosed && (
            <p className="text-[13px] text-fg-3">You haven&apos;t checked in yet today</p>
          )}
          {isCheckedIn && (
            <p className="text-[13px] text-fg-3">
              Checked in at <span className="font-medium text-foreground">{formatTime(todayRecord.checkIn)}</span>
            </p>
          )}
          {isCheckedOut && (
            <p className="text-[13px] text-fg-3">
              Checked out at <span className="font-medium text-foreground">{formatTime(todayRecord.checkOut!)}</span>
            </p>
          )}
        </div>

        {/* Live timer */}
        {isCheckedIn && (
          <div className="text-kpi font-mono font-medium text-foreground tabular-nums tracking-tight">
            {timer.display}
          </div>
        )}

        {/* Completed hours */}
        {isCheckedOut && (
          <div className="text-kpi font-mono font-medium text-foreground">
            {formatHours(hoursWorked)}
          </div>
        )}

        {/* Shift target indicator */}
        {(isCheckedIn || isCheckedOut) && (
          <div className="text-[13px]">
            {deficit > 0 ? (
              <span className="text-status-amber">
                Remaining: {formatHours(deficit)}
              </span>
            ) : (
              <span className="text-status-green">
                Overtime: +{formatHours(Math.abs(deficit))}
              </span>
            )}
            <span className="text-fg-4 ml-2">/ {SHIFT_HOURS}h target</span>
          </div>
        )}

        {/* Action button */}
        {hasUnclosed ? (
          <button
            onClick={onCheckOut}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-[7px] px-5 py-2.5 text-[12.5px] font-medium bg-accent text-accent-fg hover:brightness-105 transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Close Previous Check-in
          </button>
        ) : !todayRecord ? (
          <button
            onClick={onCheckIn}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-[7px] px-5 py-2.5 text-[12.5px] font-medium bg-accent text-accent-fg hover:brightness-105 transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Check In
          </button>
        ) : isCheckedIn ? (
          <button
            onClick={onCheckOut}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-[7px] px-5 py-2.5 text-[12.5px] font-medium bg-accent text-accent-fg hover:brightness-105 transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Check Out
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12.5px] font-medium bg-status-green-soft text-status-green">
            <Clock className="w-4 h-4" />
            Day complete
          </div>
        )}

        {/* Weekend badge */}
        {isWeekendDate(new Date()) && (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-accent-soft text-accent">
            Weekend
          </span>
        )}
      </div>
    </div>
  );
}

// ─── My History Table ───────────────────────────

function MyHistoryTable({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <Clock className="w-10 h-10 text-fg-4 mx-auto mb-3" />
        <p className="text-[13px] text-fg-3">No attendance records yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Check In</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Check Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Hours</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const hours = r.hoursWorked ? parseFloat(r.hoursWorked) : null;
              const isOpen = !r.checkOut;
              return (
                <tr
                  key={r.id}
                  className="border-b border-border hover:bg-accent-soft/40 transition-colors duration-150"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{formatDate(r.date)}</span>
                      {r.isWeekend && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-accent-soft text-accent">
                          Weekend
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-fg-2">{formatTime(r.checkIn)}</td>
                  <td className="px-4 py-3 text-fg-2">
                    {r.checkOut ? formatTime(r.checkOut) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {hours !== null ? (
                      <span className={cn(
                        'font-medium',
                        hours >= SHIFT_HOURS ? 'text-status-green' : 'text-status-amber'
                      )}>
                        {formatHours(hours)}
                      </span>
                    ) : (
                      <span className="text-fg-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isOpen ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-amber-soft text-status-amber">
                        Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-green-soft text-status-green">
                        Complete
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Team Attendance Table (Exec View) ──────────

function TeamAttendanceTable({
  entries,
  date,
  onEdit,
}: {
  entries: TeamAttendanceEntry[];
  date: Date;
  onEdit: (entry: TeamAttendanceEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <User className="w-10 h-10 text-fg-4 mx-auto mb-3" />
        <p className="text-[13px] text-fg-3">No employees found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {isWeekendDate(date) && (
        <div className="px-4 py-2 bg-accent-soft text-[13px] font-medium text-accent">
          Weekend Day
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Employee</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Check In</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Check Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Hours</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-fg-4">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-fg-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const a = entry.attendance;
              const hours = a?.hoursWorked ? parseFloat(a.hoursWorked) : null;
              const isCheckedIn = a && !a.checkOut;
              const isComplete = a && a.checkOut;
              const isAbsent = !a;

              return (
                <tr
                  key={entry.user.id}
                  className="border-b border-border hover:bg-accent-soft/40 transition-colors duration-150 group"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-semibold text-accent">
                          {entry.user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-foreground">{entry.user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-surface-3 text-fg-3">
                      {entry.user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-2">
                    {a ? formatTime(a.checkIn) : '—'}
                  </td>
                  <td className="px-4 py-3 text-fg-2">
                    {a?.checkOut ? formatTime(a.checkOut) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {hours !== null ? (
                      <span className={cn(
                        'font-medium',
                        hours >= SHIFT_HOURS ? 'text-status-green' : 'text-status-amber'
                      )}>
                        {formatHours(hours)}
                      </span>
                    ) : (
                      <span className="text-fg-4">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isCheckedIn && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-green-soft text-status-green">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-green animate-pulse" />
                        Checked In
                      </span>
                    )}
                    {isComplete && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-surface-3 text-fg-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-fg-4" />
                        Checked Out
                      </span>
                    )}
                    {isAbsent && (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-status-red-soft text-status-red">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-red" />
                        Absent
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a && (
                      <button
                        onClick={() => onEdit(entry)}
                        className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-7 h-7 rounded-lg text-fg-4 hover:text-accent hover:bg-accent-soft transition-all duration-[120ms]"
                        title="Edit attendance"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Edit Attendance Dialog ─────────────────────

function EditAttendanceDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: TeamAttendanceEntry;
  onClose: () => void;
  onSave: (id: string, checkIn: string, checkOut: string | null) => void;
}) {
  const a = entry.attendance!;
  const [checkIn, setCheckIn] = useState(a.checkIn.slice(0, 16));
  const [checkOut, setCheckOut] = useState(a.checkOut ? a.checkOut.slice(0, 16) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(a.id, new Date(checkIn).toISOString(), checkOut ? new Date(checkOut).toISOString() : null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg bg-surface border border-border shadow-[var(--shadow-3)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-semibold text-foreground">
            Edit Attendance — {entry.user.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-fg-4 hover:text-fg-2 hover:bg-surface-2 transition-colors duration-[120ms]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-2 mb-1.5">
              Check In
            </label>
            <input
              type="datetime-local"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line transition-all duration-200 ease-out"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-2 mb-1.5">
              Check Out
            </label>
            <input
              type="datetime-local"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line transition-all duration-200 ease-out"
            />
            <p className="mt-1 text-xs text-fg-4">Leave empty to keep the entry open</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="rounded-[7px] px-4 py-2 text-[12.5px] font-medium text-fg-3 hover:bg-surface-2 transition-colors duration-[120ms]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !checkIn}
            className="inline-flex items-center justify-center gap-2 rounded-[7px] px-4 py-2 text-[12.5px] font-medium bg-accent text-accent-fg hover:brightness-105 transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Date Navigation ────────────────────────────

function DateNav({
  date,
  onChange,
}: {
  date: Date;
  onChange: (d: Date) => void;
}) {
  const isToday = formatDateISO(date) === formatDateISO(new Date());

  const prev = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onChange(d);
  };

  const next = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onChange(d);
  };

  const goToToday = () => onChange(new Date());

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={prev}
        className="p-1.5 rounded-lg text-fg-4 hover:text-fg-2 hover:bg-surface-2 transition-colors duration-[120ms]"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-fg-4" />
        <input
          type="date"
          value={formatDateISO(date)}
          onChange={(e) => onChange(new Date(e.target.value + 'T00:00:00'))}
          className="rounded-lg px-2 py-1 text-sm border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line transition-all duration-200 ease-out"
        />
      </div>
      <button
        onClick={next}
        className="p-1.5 rounded-lg text-fg-4 hover:text-fg-2 hover:bg-surface-2 transition-colors duration-[120ms]"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {!isToday && (
        <button
          onClick={goToToday}
          className="rounded-[7px] px-3 py-1.5 text-[12px] font-medium bg-surface-2 text-fg-2 hover:bg-surface-3 transition-colors duration-[120ms]"
        >
          Today
        </button>
      )}
    </div>
  );
}

// ─── Export Month Picker ─────────────────────────

function ExportButton() {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  const monthLabel = (val: string) => {
    const [y, m] = val.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await attendanceAPI.exportMonthly(selectedMonth);
      if (!res.success) {
        toast.error(res.message || 'Export failed');
        return;
      }

      const { employees, month } = res.data as {
        month: string;
        employees: {
          user: { name: string; username: string; role: string };
          records: {
            date: string;
            checkIn: string;
            checkOut: string | null;
            hoursWorked: string | null;
            isWeekend: boolean;
          }[];
          totalLate: number;
          totalAbsent: number;
          totalWorkingDays: number;
        }[];
      };

      // Build CSV rows
      const rows: string[][] = [
        ['Employee', 'Username', 'Role', 'Date', 'Day', 'Check In', 'Check Out', 'Hours Worked', 'Weekend', 'Status', 'Total Late', 'Total Absent'],
      ];

      for (const emp of employees) {
        const lateStr = String(emp.totalLate);
        const absentStr = String(emp.totalAbsent);

        if (emp.records.length === 0) {
          rows.push([emp.user.name, emp.user.username, emp.user.role, '', '', '', '', '', '', 'No Records', lateStr, absentStr]);
        } else {
          emp.records.forEach((r, idx) => {
            const d = new Date(r.date);
            const dayName = d.toLocaleDateString([], { weekday: 'short' });
            const hours = r.hoursWorked ? parseFloat(r.hoursWorked) : null;
            rows.push([
              emp.user.name,
              emp.user.username,
              emp.user.role,
              formatDate(r.date),
              dayName,
              formatTime(r.checkIn),
              r.checkOut ? formatTime(r.checkOut) : '',
              hours !== null ? hours.toFixed(2) : '',
              r.isWeekend ? 'Yes' : 'No',
              r.checkOut ? 'Complete' : 'Open',
              idx === 0 ? lateStr : '',
              idx === 0 ? absentStr : '',
            ]);
          });
        }
      }

      // Generate CSV string
      const csv = rows
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Trigger download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported attendance for ${monthLabel(month)}`);
      setOpen(false);
    } catch {
      toast.error('Failed to export attendance');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium bg-surface-2 text-fg-2 hover:bg-surface-3 transition-colors duration-[120ms]"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border bg-surface shadow-[var(--shadow-3)] p-4 space-y-3">
            <p className="text-[13px] font-medium text-foreground">Export Monthly Report</p>
            <div>
              <label className="block text-xs font-medium text-fg-3 mb-1.5">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line transition-all duration-200 ease-out"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[7px] px-4 py-2 text-[12.5px] font-medium bg-accent text-accent-fg hover:brightness-105 transition-colors duration-[120ms] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exporting ? 'Exporting...' : `Download CSV`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────

export default function AttendancePage() {
  const { state } = useApp();
  const { canCheckIn, canViewTeamAttendance, canEditAttendance } = usePermissions();

  // Employee state
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [unclosedEntry, setUnclosedEntry] = useState<AttendanceRecord | null>(null);
  const [myHistory, setMyHistory] = useState<AttendanceRecord[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Exec state
  const [teamEntries, setTeamEntries] = useState<TeamAttendanceEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editEntry, setEditEntry] = useState<TeamAttendanceEntry | null>(null);

  const [pageLoading, setPageLoading] = useState(true);

  // ─── Employee data fetching ───────────────────

  const fetchEmployeeData = useCallback(async () => {
    if (!canCheckIn) return;
    try {
      const [todayRes, historyRes] = await Promise.all([
        attendanceAPI.getToday(),
        attendanceAPI.getMyHistory(),
      ]);
      if (todayRes.success) {
        setTodayRecord(todayRes.data.today);
        setUnclosedEntry(todayRes.data.unclosedEntry);
      }
      if (historyRes.success) {
        setMyHistory(historyRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
    }
  }, [canCheckIn]);

  // ─── Exec data fetching ───────────────────────

  const fetchTeamData = useCallback(async () => {
    if (!canViewTeamAttendance) return;
    try {
      const res = await attendanceAPI.getTeamAttendance(formatDateISO(selectedDate));
      if (res.success) {
        setTeamEntries(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch team attendance:', err);
    }
  }, [canViewTeamAttendance, selectedDate]);

  useEffect(() => {
    const load = async () => {
      setPageLoading(true);
      await Promise.all([fetchEmployeeData(), fetchTeamData()]);
      setPageLoading(false);
    };
    load();
  }, [fetchEmployeeData, fetchTeamData]);

  // ─── Actions ──────────────────────────────────

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const res = await attendanceAPI.checkIn();
      if (res.success) {
        toast.success('Checked in!');
        await fetchEmployeeData();
      } else {
        toast.error(res.message || 'Failed to check in');
      }
    } catch {
      toast.error('Failed to check in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      const res = await attendanceAPI.checkOut();
      if (res.success) {
        toast.success('Checked out!');
        await fetchEmployeeData();
      } else {
        toast.error(res.message || 'Failed to check out');
      }
    } catch {
      toast.error('Failed to check out');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSave = async (id: string, checkIn: string, checkOut: string | null) => {
    try {
      const res = await attendanceAPI.editRecord(id, { checkIn, checkOut });
      if (res.success) {
        toast.success('Attendance record updated');
        setEditEntry(null);
        await fetchTeamData();
      } else {
        toast.error(res.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update attendance');
    }
  };

  // ─── Loading state ────────────────────────────

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-[24px] font-semibold text-foreground tracking-[-0.02em]">Attendance</h1>
        <p className="text-[13px] text-fg-3 mt-0.5">
          {canCheckIn ? 'Track your daily check-in and check-out' : 'View employee attendance records'}
        </p>
      </div>

      {/* Employee view */}
      {canCheckIn && (
        <>
          <CheckInOutCard
            todayRecord={todayRecord}
            unclosedEntry={unclosedEntry}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            loading={actionLoading}
          />

          <div>
            <h2 className="text-[13px] font-semibold text-foreground mb-3">My History</h2>
            <MyHistoryTable records={myHistory} />
          </div>
        </>
      )}

      {/* Executive view */}
      {canViewTeamAttendance && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13px] font-semibold text-foreground">All Employees</h2>
            <div className="flex items-center gap-3">
              <DateNav date={selectedDate} onChange={setSelectedDate} />
              <ExportButton />
            </div>
          </div>

          <TeamAttendanceTable
            entries={teamEntries}
            date={selectedDate}
            onEdit={(entry) => canEditAttendance && setEditEntry(entry)}
          />
        </div>
      )}

      {/* Edit dialog */}
      {editEntry && (
        <EditAttendanceDialog
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
