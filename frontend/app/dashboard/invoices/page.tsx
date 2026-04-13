'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '@/contexts/useApp';
import { invoiceAPI, teamAPI } from '@/lib/api-service';
import { Invoice, InvoiceStatus } from '@/lib/types';
import { usePermissions } from '@/hooks/usePermissions';
import {
  FileText,
  Plus,
  Copy,
  Check,
  X,
  ExternalLink,
  Loader2,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Status badge styling ────────────────────────

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  PAID: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  REFUNDED: 'bg-[#e05c29]/15 text-[#e05c29]',
  FAILED: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

// ─── Copy button component ───────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Payment link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-out"
      title="Copy payment link"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ─── Main page ───────────────────────────────────

export default function InvoicesPage() {
  const { state } = useApp();
  const { canCreateInvoice, canAccessInvoices } = usePermissions();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [teams, setTeams] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({});

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      const result = await invoiceAPI.getAll();
      if (result.success) {
        setInvoices(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch teams for the dropdown
  useEffect(() => {
    if (!state.currentUser) return;
    const fetchTeams = async () => {
      try {
        const result = await teamAPI.getMyTeams();
        if (result.success) {
          const teamList = result.data.teams || result.data;
          setTeams(teamList);
          if (teamList.length === 1) {
            setSelectedTeamId(teamList[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch teams:', error);
      }
    };
    fetchTeams();
    fetchInvoices();
  }, [state.currentUser, fetchInvoices]);

  // Validate a single field
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'clientName':
        return !value.trim() ? 'Client name is required' : '';
      case 'clientEmail':
        if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address';
        return '';
      case 'amount': {
        if (!value) return 'Amount is required';
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) return 'Enter a valid amount greater than 0';
        return '';
      }
      case 'description':
        return !value.trim() ? 'Description is required' : '';
      case 'selectedTeamId':
        return !value ? 'Please select a team' : '';
      default:
        return '';
    }
  };

  // Validate all fields and return true if valid
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {
      clientName: validateField('clientName', clientName),
      clientEmail: validateField('clientEmail', clientEmail),
      amount: validateField('amount', amount),
      description: validateField('description', description),
      selectedTeamId: validateField('selectedTeamId', selectedTeamId),
    };
    setFormErrors(errors);
    setFormTouched({ clientName: true, clientEmail: true, amount: true, description: true, selectedTeamId: true });
    return !Object.values(errors).some(Boolean);
  };

  // Handle blur for inline validation
  const handleFieldBlur = (field: string, value: string) => {
    setFormTouched((prev) => ({ ...prev, [field]: true }));
    setFormErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const amountNum = parseFloat(amount);

    setCreating(true);
    try {
      const result = await invoiceAPI.create({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        description: description.trim(),
        amount: amountNum,
        teamId: selectedTeamId,
      });

      if (result.success) {
        toast.success('Invoice created successfully!');
        setInvoices((prev) => [result.data, ...prev]);
        setLastCreatedLink(result.data.paymentLink);
        // Reset form
        setClientName('');
        setClientEmail('');
        setDescription('');
        setAmount('');
        setFormErrors({});
        setFormTouched({});
        setShowForm(false);
      } else {
        toast.error(result.message || 'Failed to create invoice');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  // Handle cancel invoice
  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const result = await invoiceAPI.cancel(id);
      if (result.success) {
        toast.success('Invoice cancelled');
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? result.data : inv))
        );
      } else {
        toast.error(result.message || 'Failed to cancel invoice');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel invoice');
    } finally {
      setCancellingId(null);
    }
  };

  // Filter invoices
  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      inv.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.createdBy.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedInvoices = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Stats
  const totalPending = invoices.filter((i) => i.status === 'PENDING').length;
  const totalPaid = invoices.filter((i) => i.status === 'PAID').length;
  const totalRevenue = invoices
    .filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + parseFloat(i.amount), 0);

  if (!canAccessInvoices) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-zinc-500 dark:text-zinc-400">You don&apos;t have access to invoices.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Invoices</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Generate and track payment links
          </p>
        </div>
        {canCreateInvoice && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ease-out',
              showForm
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                : 'text-white bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 shadow-[0_4px_20px_rgba(224,92,41,0.35)]'
            )}
          >
            {showForm ? (
              <>
                <X className="w-4 h-4" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Generate Invoice
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-300" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Pending</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{totalPending}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-300" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Paid</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{totalPaid}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#e05c29] to-amber-400" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Revenue</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            £{totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Last created payment link banner */}
      {lastCreatedLink && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Payment link generated!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">{lastCreatedLink}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CopyButton text={lastCreatedLink} />
            <a
              href={lastCreatedLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all duration-200 ease-out"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
            <button
              onClick={() => setLastCreatedLink(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Invoice Form */}
      {showForm && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Generate Payment Link</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => { setClientName(e.target.value); if (formTouched.clientName) setFormErrors((prev) => ({ ...prev, clientName: validateField('clientName', e.target.value) })); }}
                  onBlur={() => handleFieldBlur('clientName', clientName)}
                  placeholder="Enter client name"
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-sm border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ease-out',
                    formTouched.clientName && formErrors.clientName
                      ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#e05c29]/30 focus:border-[#e05c29]'
                  )}
                />
                {formTouched.clientName && formErrors.clientName && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.clientName}</p>
                )}
              </div>

              {/* Client Email */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Client Email <span className="text-zinc-400 text-xs">(optional)</span>
                </label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => { setClientEmail(e.target.value); if (formTouched.clientEmail) setFormErrors((prev) => ({ ...prev, clientEmail: validateField('clientEmail', e.target.value) })); }}
                  onBlur={() => handleFieldBlur('clientEmail', clientEmail)}
                  placeholder="client@example.com"
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-sm border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ease-out',
                    formTouched.clientEmail && formErrors.clientEmail
                      ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#e05c29]/30 focus:border-[#e05c29]'
                  )}
                />
                {formTouched.clientEmail && formErrors.clientEmail && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.clientEmail}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Amount (GBP) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); if (formTouched.amount) setFormErrors((prev) => ({ ...prev, amount: validateField('amount', e.target.value) })); }}
                    onBlur={() => handleFieldBlur('amount', amount)}
                    placeholder="0.00"
                    className={cn(
                      'w-full rounded-lg pl-7 pr-3 py-2 text-sm border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ease-out',
                      formTouched.amount && formErrors.amount
                        ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400'
                        : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#e05c29]/30 focus:border-[#e05c29]'
                    )}
                  />
                </div>
                {formTouched.amount && formErrors.amount && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.amount}</p>
                )}
              </div>

              {/* Team */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Team <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => { setSelectedTeamId(e.target.value); setFormTouched((prev) => ({ ...prev, selectedTeamId: true })); setFormErrors((prev) => ({ ...prev, selectedTeamId: validateField('selectedTeamId', e.target.value) })); }}
                  onBlur={() => handleFieldBlur('selectedTeamId', selectedTeamId)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-sm border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 transition-all duration-200 ease-out',
                    formTouched.selectedTeamId && formErrors.selectedTeamId
                      ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400'
                      : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#e05c29]/30 focus:border-[#e05c29]'
                  )}
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                {formTouched.selectedTeamId && formErrors.selectedTeamId && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.selectedTeamId}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Invoice Reason / Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); if (formTouched.description) setFormErrors((prev) => ({ ...prev, description: validateField('description', e.target.value) })); }}
                onBlur={() => handleFieldBlur('description', description)}
                placeholder="Describe the service or reason for this invoice"
                rows={3}
                className={cn(
                  'w-full rounded-lg px-3 py-2 text-sm border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 transition-all duration-200 ease-out resize-none',
                  formTouched.description && formErrors.description
                    ? 'border-red-400 focus:ring-red-400/30 focus:border-red-400'
                    : 'border-zinc-200 dark:border-zinc-700 focus:ring-[#e05c29]/30 focus:border-[#e05c29]'
                )}
              />
              {formTouched.description && formErrors.description && (
                <p className="mt-1 text-xs text-red-500">{formErrors.description}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200 ease-out"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#e05c29] to-orange-400 hover:to-rose-500 shadow-[0_4px_20px_rgba(224,92,41,0.35)] transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate Payment Link
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search invoices..."
            className="w-full rounded-lg pl-9 pr-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#e05c29]/30 focus:border-[#e05c29] transition-all duration-200 ease-out"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-400" />
          {(['ALL', 'PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'FAILED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ease-out',
                statusFilter === s
                  ? 'bg-[#e05c29]/15 text-[#e05c29]'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              )}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Table */}
      <div className="rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#e05c29]" />
          </div>
        ) : paginatedInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {invoices.length === 0 ? 'No invoices yet. Generate your first payment link!' : 'No invoices match your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Payment Link
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Paid Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Generated By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 hover:bg-[#e05c29]/4 dark:hover:bg-[#e05c29]/6 transition-colors duration-150 group"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{invoice.clientName}</p>
                        {invoice.clientEmail && (
                          <p className="text-xs text-zinc-400">{invoice.clientEmail}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-zinc-700 dark:text-zinc-300 truncate" title={invoice.description}>
                        {invoice.description}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        £{parseFloat(invoice.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {invoice.paymentLink ? (
                        <div className="flex items-center gap-1.5">
                          <CopyButton text={invoice.paymentLink} />
                          <a
                            href={invoice.paymentLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-[#e05c29] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-200"
                            title="Open payment link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                          STATUS_STYLES[invoice.status]
                        )}
                      >
                        {invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {new Date(invoice.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {invoice.paidAt
                        ? new Date(invoice.paidAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-semibold text-orange-500">
                            {invoice.createdBy.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                          {invoice.createdBy.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {invoice.status === 'PENDING' && (
                        <button
                          onClick={() => handleCancel(invoice.id)}
                          disabled={cancellingId === invoice.id}
                          className="opacity-0 group-hover:opacity-100 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all duration-200 ease-out disabled:opacity-100 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {cancellingId === invoice.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Cancelling...
                            </>
                          ) : (
                            'Cancel'
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-8 h-8 text-xs font-medium rounded-lg transition-all duration-200',
                    currentPage === page
                      ? 'bg-[#e05c29] text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  )}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
