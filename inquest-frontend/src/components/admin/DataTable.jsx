import { useMemo } from 'react';
import {
  Users,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  Ticket,
  ShieldAlert,
  BookOpen,
  Search,
  Crown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  X,
} from 'lucide-react';

const TABLE_META = {
  customers: { label: 'Customers', icon: Users, desc: 'Registered customer profiles and loyalty tiers' },
  orders: { label: 'Orders', icon: ShoppingBag, desc: 'Logged customer order history and fulfillment statuses' },
  payments: { label: 'Payments', icon: CreditCard, desc: 'Gateway and local ledger transaction records' },
  refunds: { label: 'Refunds', icon: RotateCcw, desc: 'Claim resolutions and processed gateway refunds' },
  tickets: { label: 'Tickets', icon: Ticket, desc: 'Prior support tickets and customer inquiry history' },
  securityEvents: { label: 'Security Events', icon: ShieldAlert, desc: 'Biometric and IP anomaly audit logs' },
  policies: { label: 'Policies', icon: BookOpen, desc: 'Institutional dispute and automated resolution rules' },
};

function renderStatusBadge(status) {
  if (status === null || status === undefined) return <span className="text-muted">—</span>;
  const s = String(status).toLowerCase();

  if (s === 'delivered' || s === 'success' || s === 'completed' || s === 'resolved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="capitalize">{String(status)}</span>
      </span>
    );
  }

  if (s === 'gold') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
        <Crown className="w-3 h-3 text-amber" />
        <span>Gold</span>
      </span>
    );
  }

  if (s === 'silver') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
        <span>Silver</span>
      </span>
    );
  }

  if (s === 'platinum') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25">
        <Crown className="w-3 h-3 text-indigo-500" />
        <span>Platinum</span>
      </span>
    );
  }

  if (s === 'failed' || s === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="capitalize">{String(status)}</span>
      </span>
    );
  }

  if (s === 'in_transit' || s === 'processing' || s === 'pending' || s === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber" />
        <span className="capitalize">{String(status).replace('_', ' ')}</span>
      </span>
    );
  }

  return <span className="text-paper/90">{String(status)}</span>;
}

export default function DataTable({ activeTable, data, searchQuery = '', setSearchQuery }) {
  const rows = data?.[activeTable] || [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const meta = TABLE_META[activeTable] || { label: activeTable, icon: HelpCircle, desc: '' };
  const Icon = meta.icon;

  // Client-side case-insensitive search across all columns
  const filteredRows = useMemo(() => {
    if (!searchQuery?.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((row) =>
      Object.values(row).some((val) =>
        String(val ?? '').toLowerCase().includes(q)
      )
    );
  }, [rows, searchQuery]);

  return (
    <div className="bg-ink-light rounded-xl border border-border shadow-xs flex flex-col flex-1 overflow-hidden transition-colors">
      {/* ── Table Header Controls ── */}
      <div className="p-3.5 sm:p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0 bg-ink-light">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-dim text-amber flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-paper capitalize tracking-tight">
                {meta.label}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-ink-inset text-muted border border-border">
                {filteredRows.length} {filteredRows.length === 1 ? 'record' : 'records'}
              </span>
            </div>
            <p className="text-[11px] text-muted leading-none mt-0.5">
              {meta.desc}
            </p>
          </div>
        </div>

        {/* In-table Filter Input */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              placeholder={`Filter in ${meta.label}…`}
              className="w-full bg-ink-inset border border-border rounded-lg pl-8 pr-7 py-1.5 text-xs text-paper placeholder:text-muted/60 focus:outline-none focus:ring-1 focus:ring-amber/50 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery?.('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-paper cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Dense Table Viewport ── */}
      <div className="overflow-auto flex-1 min-h-[300px]">
        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-ink-inset border border-border flex items-center justify-center text-muted mb-2.5">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-paper">No matching records found</p>
            <p className="text-[11px] text-muted max-w-sm mt-0.5">
              {searchQuery.trim()
                ? `No records matching "${searchQuery}" in ${meta.label}. Try adjusting your filter.`
                : `There are currently no rows recorded in the ${meta.label} table.`}
            </p>
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery?.('')}
                className="mt-2 text-xs font-semibold text-amber hover:text-amber-light cursor-pointer"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-ink-inset/80 sticky top-0 z-10 backdrop-blur-xs">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="text-left py-2.5 px-3.5 text-muted font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap"
                  >
                    {col.replace(/([A-Z])/g, ' $1').trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors"
                >
                  {columns.map((col) => {
                    const val = row[col];

                    // Amount styling
                    if (col.toLowerCase().includes('amount')) {
                      return (
                        <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-mono font-medium text-paper">
                          ₹{Number(val || 0).toLocaleString('en-IN')}
                        </td>
                      );
                    }

                    // Status / Tier badges
                    if (
                      col.toLowerCase().includes('status') ||
                      col.toLowerCase() === 'tier'
                    ) {
                      return (
                        <td key={col} className="py-2.5 px-3.5 whitespace-nowrap">
                          {renderStatusBadge(val)}
                        </td>
                      );
                    }

                    // ID styling
                    if (col === 'id' || col.toLowerCase().includes('id')) {
                      return (
                        <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-mono text-amber font-medium">
                          {String(val ?? '—')}
                        </td>
                      );
                    }

                    return (
                      <td key={col} className="py-2.5 px-3.5 whitespace-nowrap text-paper-dim">
                        {String(val ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Table Footer: Counts ── */}
      <div className="p-2.5 px-4 border-t border-border flex items-center justify-between text-[11px] text-muted shrink-0 bg-ink-light">
        <div>
          Showing <span className="font-semibold text-paper">{filteredRows.length}</span> of{' '}
          <span className="font-semibold text-paper">{rows.length}</span> records in{' '}
          <span className="font-semibold text-paper capitalize">{meta.label}</span>
        </div>
        {searchQuery.trim() && (
          <span className="text-[10px] text-amber font-mono">
            Filter active: &quot;{searchQuery}&quot;
          </span>
        )}
      </div>
    </div>
  );
}
