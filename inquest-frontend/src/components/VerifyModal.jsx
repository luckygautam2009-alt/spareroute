import { useState } from 'react';
import { X, ShieldCheck, FileDown, CheckCircle2 } from 'lucide-react';
import IDScanner from './IDScanner';

function buildReportText(caseData, verifyInfo) {
  const { customerId, complaintText, analysis, rootCause, decision, handoff } = caseData;
  const now = new Date().toLocaleString();

  return `INQUEST — CASE VERIFICATION REPORT
Generated: ${now}
================================================

CASE
Customer ID: ${customerId}
Complaint: ${complaintText}

ANALYSIS
Intent: ${analysis?.intent || 'N/A'}${analysis?.subIntent ? ' / ' + analysis.subIntent : ''}
Sentiment: ${analysis?.sentiment || 'N/A'}
Urgency: ${analysis?.urgency || 'N/A'}

ROOT CAUSE
${rootCause?.rootCause || 'N/A'}
Matched Policy: ${rootCause?.matchedPolicy || 'None'}
Confidence: ${rootCause?.confidence ?? 'N/A'}%

SYSTEM DECISION
${decision?.decision || 'N/A'}
Reasoning: ${decision?.reasoning || 'N/A'}

RECOMMENDED ACTION
${handoff?.agentSummary?.recommendedAction || handoff?.suggestedAction || handoff?.actionTaken || 'N/A'}

------------------------------------------------
MANUAL VERIFICATION
------------------------------------------------
Verified By: ${verifyInfo.employeeName}
Employee Email: ${verifyInfo.employeeEmail}
ID Check Result: ${verifyInfo.verified ? 'VERIFIED' : 'NOT VERIFIED'}
Verified At: ${now}

================================================
This report was generated automatically by INQUEST RootCause AI.
`;
}

function downloadReport(text, customerId) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `INQUEST-Report-${customerId}-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function VerifyModal({ data, onClose }) {
  const [step, setStep] = useState('form'); // 'form' | 'scanning' | 'report'
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [formError, setFormError] = useState(null);
  const [reportText, setReportText] = useState('');

  function handleStart(e) {
    e.preventDefault();
    setFormError(null);
    if (!employeeName.trim() || !employeeEmail.trim() || !adminPassword.trim()) {
      setFormError('Name, email, and admin password are all required.');
      return;
    }
    setStep('scanning');
  }

  function handleVerified(verifyResult) {
    const text = buildReportText(data, {
      employeeName: employeeName.trim(),
      employeeEmail: employeeEmail.trim(),
      verified: verifyResult.verified,
    });
    setReportText(text);
    setStep('report');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-ink-light border border-border-strong rounded-2xl w-full max-w-2xl p-6 sm:p-8 shadow-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-paper cursor-pointer">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <ShieldCheck className="w-5 h-5 text-amber" />
          <h3 className="font-display text-xl text-paper">Manual Verification</h3>
        </div>

        {step === 'form' && (
          <form onSubmit={handleStart} className="space-y-3.5">
            <input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Employee name"
              className="w-full bg-ink border border-border-strong rounded-lg px-3.5 py-2.5 text-sm text-paper placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-amber/50"
            />
            <input
              value={employeeEmail}
              onChange={(e) => setEmployeeEmail(e.target.value)}
              type="email"
              placeholder="Employee email"
              className="w-full bg-ink border border-border-strong rounded-lg px-3.5 py-2.5 text-sm text-paper placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-amber/50"
            />
            <input
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              type="password"
              placeholder="Admin password"
              className="w-full bg-ink border border-border-strong rounded-lg px-3.5 py-2.5 text-sm text-paper placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-amber/50"
            />
            {formError && (
              <p className="text-xs text-alert bg-alert-dim border border-alert/30 rounded-lg px-3 py-2">{formError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-amber text-ink font-bold px-4 py-2.5 rounded-lg text-sm hover:bg-amber-light transition-colors cursor-pointer"
            >
              Start ID Scan
            </button>
          </form>
        )}

        {step === 'scanning' && (
          <IDScanner
            name={employeeName.trim()}
            email={employeeEmail.trim()}
            adminPassword={adminPassword}
            onVerified={handleVerified}
            onCancel={() => setStep('form')}
          />
        )}

        {step === 'report' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-base font-bold text-verified">
              <CheckCircle2 className="w-5 h-5" />
              Case Report Ready
            </div>
            <pre className="text-sm text-paper bg-ink border border-border-strong rounded-lg p-5 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto font-sans">
              {reportText}
            </pre>
            <button
              onClick={() => downloadReport(reportText, data.customerId)}
              className="w-full flex items-center justify-center gap-2 bg-amber text-ink font-bold px-4 py-2.5 rounded-lg text-sm hover:bg-amber-light transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" /> Download Report
            </button>
            <button
              onClick={onClose}
              className="w-full bg-ink-lighter text-paper font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-ink transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
