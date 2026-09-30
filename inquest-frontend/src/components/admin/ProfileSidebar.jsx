import { useState, useMemo, useRef, useEffect } from 'react';
import {
  User,
  Pencil,
  Check,
  X,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Camera,
  Copy,
  Upload,
  CreditCard,
  Ticket,
  ShieldAlert,
  Users,
  FileCheck,
} from 'lucide-react';

export default function ProfileSidebar({
  verifiedName,
  verifiedEmail,
  adminProfile,
  onUpdatePhoto,
  onUpdateName,
  data,
  refFile,
  setRefFile,
  handleUploadReference,
  refMsg,
}) {
  const fileInputRef = useRef(null);

  // Editable display name state synchronized with prop
  const [displayName, setDisplayName] = useState(verifiedName || 'Authorized Staff');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(displayName);

  // Sync display name when verifiedName prop changes
  useEffect(() => {
    if (verifiedName) {
      setDisplayName(verifiedName);
      setTempName(verifiedName);
    }
  }, [verifiedName]);

  // Copy code feedback state
  const [copiedCode, setCopiedCode] = useState(false);

  // Read-only server assigned employee code
  const employeeCode = adminProfile?.employee_code || 'INQ-ADM-...';
  const avatarUrl = adminProfile?.profile_photo || null;

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !onUpdatePhoto) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      try {
        await onUpdatePhoto(base64Data);
      } catch (err) {
        console.error('[ProfileSidebar] Could not save avatar to server:', err);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveName() {
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== displayName && onUpdateName) {
      try {
        await onUpdateName(trimmed);
        setDisplayName(trimmed);
      } catch (err) {
        console.error('[ProfileSidebar] Could not update name:', err);
        setTempName(displayName);
      }
    } else {
      setTempName(displayName);
    }
    setIsEditingName(false);
  }

  function handleCopyCode() {
    if (employeeCode) {
      navigator.clipboard?.writeText(employeeCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  // Derive REAL system activity from the already-fetched data
  const realActivity = useMemo(() => {
    const list = [];

    // Most recent customer
    if (data?.customers?.length) {
      const c = data.customers[data.customers.length - 1];
      list.push({
        icon: Users,
        title: 'Customer Record',
        desc: `${c.name} (${c.id}) · ${c.tier?.toUpperCase() || 'STANDARD'}`,
        color: 'text-amber',
        bg: 'bg-amber-dim border border-amber/20',
      });
    }

    // Most recent payment
    if (data?.payments?.length) {
      const p = data.payments[data.payments.length - 1];
      list.push({
        icon: CreditCard,
        title: 'Payment Transaction',
        desc: `Order ${p.orderId} · ₹${Number(p.amount || 0).toLocaleString('en-IN')} (${p.gatewayStatus})`,
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10 border border-emerald-500/20',
      });
    }

    // Most recent ticket
    if (data?.tickets?.length) {
      const t = data.tickets[data.tickets.length - 1];
      list.push({
        icon: Ticket,
        title: 'Support Ticket',
        desc: `${t.id}: ${t.subject} (${t.status})`,
        color: 'text-info',
        bg: 'bg-info-dim border border-info/20',
      });
    }

    // Most recent security event
    if (data?.securityEvents?.length) {
      const s = data.securityEvents[data.securityEvents.length - 1];
      list.push({
        icon: ShieldAlert,
        title: 'Security Event',
        desc: `${s.eventType}${s.alert ? ` - ${s.alert}` : ''}`,
        color: 'text-alert',
        bg: 'bg-alert-dim border border-alert/20',
      });
    }

    return list;
  }, [data]);

  return (
    <aside className="w-full lg:w-80 xl:w-88 border-t lg:border-t-0 lg:border-l border-border bg-ink-light flex flex-col overflow-y-auto shrink-0 p-3.5 sm:p-4 space-y-4 transition-colors">
      {/* ── 1. Profile Avatar & Identity Card ── */}
      <div className="bg-ink-light rounded-xl p-4 border border-border shadow-xs text-center relative">
        {/* Verified Status Pill */}
        <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-3">
          <CheckCircle2 className="w-3 h-3" />
          <span>Biometric Verified</span>
        </div>

        {/* Avatar with server-persisted photo upload */}
        <div className="relative w-16 h-16 mx-auto mb-3 shrink-0">
          <div className="w-16 h-16 rounded-full border-2 border-amber/40 overflow-hidden bg-ink-inset shadow-2xs flex items-center justify-center shrink-0 aspect-square">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="w-full h-full object-cover object-center shrink-0 aspect-square block"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-amber-dim text-amber font-sans font-bold text-lg">
                {(displayName || 'AS').slice(0, 2).toUpperCase() || <User className="w-6 h-6" />}
              </div>
            )}
          </div>

          {/* Change Photo Trigger */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-amber text-ink border-2 border-ink flex items-center justify-center hover:bg-amber-light transition-colors cursor-pointer shadow-xs z-10"
            title="Upload profile photo"
          >
            <Camera className="w-3 h-3 text-ink" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Editable Name & Email */}
        <div className="space-y-0.5 mb-2">
          {isEditingName ? (
            <div className="flex items-center justify-center gap-1.5 max-w-[200px] mx-auto">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                autoFocus
                className="w-full bg-ink-inset border border-amber/50 rounded-md px-2 py-0.5 text-xs font-bold text-paper text-center focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="p-1 rounded bg-verified-dim text-verified hover:bg-verified-dim/80 cursor-pointer"
                title="Save name"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTempName(displayName);
                  setIsEditingName(false);
                }}
                className="p-1 rounded bg-ink text-muted hover:text-paper cursor-pointer"
                title="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 group">
              <h3 className="font-sans font-bold text-sm text-paper">
                {displayName}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setTempName(displayName);
                  setIsEditingName(true);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-amber transition-all cursor-pointer"
                title="Edit name"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Verified Email */}
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted">
            <Mail className="w-3 h-3 text-muted" />
            <span className="truncate max-w-[170px]">{verifiedEmail}</span>
            <CheckCircle2 className="w-3 h-3 text-verified shrink-0" title="Verified email" />
          </div>
        </div>

        {/* Read-Only Employee Code Badge */}
        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-xs bg-ink-inset p-2 rounded-lg border border-border">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-muted" />
            <span className="text-muted text-[10px] font-semibold">Employee Code:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-amber text-[11px] tracking-wider">
              {employeeCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-0.5 rounded text-muted hover:text-paper cursor-pointer transition-colors"
              title="Copy employee code"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>
        {copiedCode && (
          <div className="text-[10px] text-emerald-500 font-semibold mt-1">
            Copied code to clipboard!
          </div>
        )}
      </div>

      {/* ── 2. ID Verification Reference Section ── */}
      {handleUploadReference && (
        <div className="bg-ink-light rounded-xl p-4 border border-border shadow-xs space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-dim text-amber flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-paper leading-tight">
                ID Verification Reference
              </h4>
              <p className="text-[10px] text-muted mt-0.5">
                Official Institutional Template
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted leading-relaxed bg-ink-inset p-2.5 rounded-lg border border-border">
            Upload the master reference NIET ID card image. Verification scans compare formatting, branding, and layout against this standard.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-amber/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-ink-inset/50 group">
            <div className="w-9 h-9 rounded-full bg-ink-lighter flex items-center justify-center text-amber group-hover:scale-105 transition-transform">
              <Upload className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-paper block truncate max-w-[200px]">
                {refFile ? refFile.name : 'Choose reference ID card image'}
              </span>
              <span className="text-[10px] text-muted block">
                JPG, PNG, or WebP (max 5MB)
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setRefFile?.(e.target.files?.[0] || null)}
            />
          </label>

          <button
            type="button"
            onClick={handleUploadReference}
            disabled={!refFile}
            className="w-full bg-amber text-ink font-bold px-3 py-2 rounded-lg text-xs hover:bg-amber-light disabled:opacity-40 transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Save Reference Card</span>
          </button>

          {refMsg && (
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{refMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* ── 3. Real System Records Activity Feed ── */}
      <div className="bg-ink-light rounded-xl p-4 border border-border shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-verified" />
            <span>Live Database Records</span>
          </div>
          <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        </div>

        {realActivity.length === 0 ? (
          <p className="text-[11px] text-muted py-2 text-center">No activity records found</p>
        ) : (
          <div className="space-y-2 text-xs">
            {realActivity.map((act, i) => {
              const Icon = act.icon;
              return (
                <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-ink-inset border border-border">
                  <div className={`w-7 h-7 rounded-md ${act.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`w-3.5 h-3.5 ${act.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-paper font-semibold text-[11px] leading-tight">{act.title}</div>
                    <div className="text-[10px] text-muted truncate mt-0.5">{act.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
