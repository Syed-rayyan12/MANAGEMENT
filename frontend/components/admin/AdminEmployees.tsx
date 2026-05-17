'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, X, Eye, Trash2, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminAPI } from '@/lib/api-service';
import { Employee, EmployeePerformance, Specialization } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Constants ──────────────────────────────────────

type EmployeeTab = 'ALL' | 'SALES' | 'PRODUCTION';
const ROLES = ['PM', 'TL', 'PRODUCTION', 'EXECUTIVE'] as const;
const SPECIALIZATIONS: { value: Specialization; label: string }[] = [
  { value: 'LOGO_DESIGNER', label: 'Logo Designer' },
  { value: 'FIGMA_DESIGNER', label: 'Figma Designer' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'CONTENT_WRITER', label: 'Content Writer' },
  { value: 'QA', label: 'QA' },
];

const ROLE_PREFIXES: Record<string, string> = {
  PM: 'pm.',
  TL: 'tl.',
  PRODUCTION: 'prod.',
  EXECUTIVE: 'exec.',
};

// ─── Helpers ────────────────────────────────────────

function roleBadge(role: string) {
  const styles: Record<string, string> = {
    PM: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    TL: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    PRODUCTION: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    EXECUTIVE: 'bg-accent-soft text-accent',
  };
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', styles[role] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500')}>
      {role}
    </span>
  );
}

function specLabel(spec?: Specialization) {
  if (!spec) return '—';
  return SPECIALIZATIONS.find(s => s.value === spec)?.label || spec;
}

// ─── Main Component ──────────────────────────────────

export function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EmployeeTab>('ALL');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchEmployees = useCallback(async () => {
    try {
      const result = await adminAPI.getEmployees();
      if (result.success) {
        setEmployees(result.data.employees || []);
      } else {
        toast.error(result.message || 'Failed to load employees');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Filter
  const filtered = employees.filter((emp) => {
    const matchesTab =
      activeTab === 'ALL' ||
      (activeTab === 'SALES' && (emp.role === 'PM' || emp.role === 'TL')) ||
      (activeTab === 'PRODUCTION' && emp.role === 'PRODUCTION');
    const matchesSearch =
      !search ||
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.username.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  React.useEffect(() => { setCurrentPage(1); }, [search, activeTab]);

  const handleEmployeeCreated = (newEmp: Employee) => {
    setEmployees((prev) => [newEmp, ...prev]);
    setShowForm(false);
    toast.success('Employee created successfully');
  };

  const handleEmployeeDeleted = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    setDeleteEmployee(null);
    toast.success('Employee deleted');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(['ALL', 'SALES', 'PRODUCTION'] as EmployeeTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                activeTab === tab
                  ? 'bg-accent-soft text-accent'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              {tab === 'SALES' ? 'Sales (PM + TL)' : tab === 'ALL' ? 'All' : 'Production'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 pl-9 pr-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
              showForm
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                : 'bg-accent hover:bg-accent/90'
            )}
          >
            {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add Employee</>}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <CreateEmployeeForm
          onCreated={handleEmployeeCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Table */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide hidden md:table-cell">Specialization</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide hidden lg:table-cell">Team(s)</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-zinc-400 dark:text-zinc-500">No employees found</td>
                </tr>
              ) : (
                paginated.map((emp) => (
                  <tr key={emp.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{emp.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{emp.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{roleBadge(emp.role)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-zinc-500 dark:text-zinc-400 text-xs">{specLabel(emp.specialization)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-zinc-500 dark:text-zinc-400 text-xs">
                      {emp.teams.length > 0 ? emp.teams.map(t => t.name).join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedEmployee(emp)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-accent hover:bg-accent-soft transition-all"
                          title="View performance"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteEmployee(emp)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          title="Delete employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {Math.min((currentPage - 1) * pageSize + 1, filtered.length)}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-7 h-7 rounded text-xs font-medium transition-all',
                    currentPage === page
                      ? 'bg-accent text-accent-fg'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Performance Modal */}
      <PerformanceModal
        employee={selectedEmployee}
        open={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
      />

      {/* Delete Dialog */}
      <DeleteEmployeeDialog
        employee={deleteEmployee}
        open={!!deleteEmployee}
        onConfirm={handleEmployeeDeleted}
        onCancel={() => setDeleteEmployee(null)}
      />
    </div>
  );
}

// ─── Create Employee Form ────────────────────────────

function CreateEmployeeForm({
  onCreated,
  onCancel,
}: {
  onCreated: (emp: Employee) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<string>('PM');
  const [specialization, setSpecialization] = useState<Specialization | ''>('');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch teams for PM/TL assignment
  useEffect(() => {
    adminAPI.getTeams()
      .then(r => { if (r.success) setTeams(r.data.teams || []); })
      .catch(() => {});
  }, []);

  // Auto-apply prefix when role changes
  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setSpecialization('');
    const prefix = ROLE_PREFIXES[newRole] || '';
    // Remove any existing prefix, then apply the new one
    const bare = username.replace(/^(pm\.|tl\.|prod\.|exec\.)/, '');
    setUsername(prefix + bare);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Valid email required';
    if (!username.trim()) errs.username = 'Username is required';
    if (!role) errs.role = 'Role is required';
    if (role === 'PRODUCTION' && !specialization) errs.specialization = 'Specialization required for Production';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await adminAPI.createEmployee({
        name: name.trim(),
        email: email.trim(),
        username: username.trim(),
        role,
        specialization: specialization || undefined,
        teamId: teamId || undefined,
      });
      if (result.success) {
        onCreated(result.data.user);
      } else {
        toast.error(result.message || 'Failed to create employee');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">New Employee</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Smith"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="john@company.com"
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Role *</label>
          <select
            value={role}
            onChange={e => handleRoleChange(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
        </div>

        {/* Username */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username *</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={`${ROLE_PREFIXES[role] || ''}username`}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
          />
          {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
        </div>

        {/* Specialization — only for PRODUCTION */}
        {role === 'PRODUCTION' && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Specialization *</label>
            <select
              value={specialization}
              onChange={e => setSpecialization(e.target.value as Specialization)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
            >
              <option value="">Select specialization...</option>
              {SPECIALIZATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {errors.specialization && <p className="text-xs text-red-500 mt-1">{errors.specialization}</p>}
          </div>
        )}

        {/* Team — only for PM/TL */}
        {(role === 'PM' || role === 'TL') && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Team (optional)</label>
            <select
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line"
            >
              <option value="">No team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Actions — span full width */}
        <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-accent-fg bg-accent hover:bg-accent/90 disabled:opacity-60 transition-all"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Employee
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Performance Modal ───────────────────────────────

function PerformanceModal({ employee, open, onClose }: { employee: Employee | null; open: boolean; onClose: () => void }) {
  const [performance, setPerformance] = useState<EmployeePerformance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employee || !open) { setPerformance(null); return; }
    let cancelled = false;
    setLoading(true);
    adminAPI.getEmployeePerformance(employee.id)
      .then(r => { if (cancelled) return; if (r.success) setPerformance(r.data.performance); else toast.error(r.message || 'Failed to load performance'); })
      .catch((err: any) => { if (!cancelled) toast.error(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee?.name} — Performance
          </DialogTitle>
          <DialogDescription className="sr-only">Performance details for {employee?.name}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        )}

        {!loading && performance && employee && (
          <PerformanceContent employee={employee} performance={performance} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide pt-2">{title}</h4>
  );
}

function PerformanceContent({ employee, performance }: { employee: Employee; performance: EmployeePerformance }) {
  const isSales = performance.role === 'PM' || performance.role === 'TL';
  const isProd = performance.role === 'PRODUCTION';

  return (
    <div className="space-y-5">
      {/* Common: Assignment Stats */}
      <div className="grid grid-cols-2 gap-3">
        <PerfStat label="Active Projects" value={String(performance.activeProjects)} />
        <PerfStat label="Completed" value={String(performance.completedProjects)} />
        <PerfStat label="As Primary" value={String(performance.asPrimary)} />
        <PerfStat label="As Collaborator" value={String(performance.asCollaborator)} />
      </div>

      {/* Sales: Revenue & Invoices */}
      {isSales && (
        <>
          <SectionHeader title="Revenue" />
          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Total Revenue" value={`£${(performance.totalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="This Month" value={`£${(performance.revenueThisMonth || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Avg Invoice" value={`£${(performance.averageInvoiceValue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Total Invoices" value={String(performance.totalInvoicesSent || 0)} />
          </div>

          {performance.invoiceBreakdown && Object.keys(performance.invoiceBreakdown).length > 0 && (
            <>
              <SectionHeader title="Invoice Breakdown" />
              <div className="space-y-1">
                {Object.entries(performance.invoiceBreakdown).map(([status, data]) => (
                  <div key={status} className="flex justify-between text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <span className="text-zinc-600 dark:text-zinc-400 capitalize">{status.toLowerCase()}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {data.count} (£{data.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <SectionHeader title="Clients" />
          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Total Clients" value={String(performance.totalClients || 0)} />
            <PerfStat label="New This Month" value={String(performance.newClientsThisMonth || 0)} />
          </div>
        </>
      )}

      {/* TL: Team Section */}
      {performance.role === 'TL' && performance.team && (
        <>
          <SectionHeader title="Team Aggregate" />
          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Team Revenue" value={`£${performance.team.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Team This Month" value={`£${performance.team.revenueThisMonth.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`} />
            <PerfStat label="Team Active" value={String(performance.team.activeProjects)} />
            <PerfStat label="Team Completed" value={String(performance.team.completedProjects)} />
          </div>

          {performance.team.members.length > 0 && (
            <>
              <SectionHeader title="Team Members" />
              <div className="space-y-1">
                {performance.team.members.map((m) => (
                  <div key={m.id} className="flex justify-between items-center text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div>
                      <span className="text-zinc-600 dark:text-zinc-400">{m.name}</span>
                      <span className="text-xs text-zinc-400 ml-1.5">({m.role})</span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">£{m.revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                      <span className="text-zinc-400 ml-2">{m.activeProjects} active</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Production: Specialization-specific */}
      {isProd && (
        <>
          {employee.specialization && (
            <div className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {specLabel(employee.specialization)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <PerfStat label="Avg Turnaround" value={performance.avgTurnaround != null ? `${performance.avgTurnaround}d` : '—'} />
            <PerfStat label="On-Time Rate" value={performance.onTimeRate != null ? `${performance.onTimeRate}%` : '—'} />
            <PerfStat label="Regressions" value={String(performance.totalRegressions || 0)} />
            <PerfStat label="Regressions (mo.)" value={String(performance.regressionsThisMonth || 0)} />
          </div>
        </>
      )}

      {/* Common: Projects by Board */}
      {performance.projectsByBoard.length > 0 && (
        <>
          <SectionHeader title="Projects by Board" />
          <div className="space-y-1">
            {performance.projectsByBoard.map((b) => (
              <div key={b.boardId} className="flex justify-between text-sm py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <span className="text-zinc-600 dark:text-zinc-400">{b.boardName}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{b.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PerfStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{value}</p>
    </div>
  );
}

// ─── Delete Dialog ───────────────────────────────────

function DeleteEmployeeDialog({
  employee,
  open,
  onConfirm,
  onCancel,
}: {
  employee: Employee | null;
  open: boolean;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!employee) return;
    setDeleting(true);
    try {
      const result = await adminAPI.deleteEmployee(employee.id);
      if (result.success) {
        onConfirm(employee.id);
      } else {
        toast.error(result.message || 'Failed to delete employee');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete employee');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{employee?.name}</strong>? This action cannot be undone.
            {employee?.role === 'PM' && ' Note: PMs with active projects cannot be deleted.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting...</> : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
