import { useState } from 'react';
import { Sparkles } from 'lucide-react';

const SAMPLE_COMPLAINTS = [
  { label: 'Wrong part', text: 'Mera brake pad set order deliver ho gaya hai lekin part galat hai, mujhe refund chahiye' },
  { label: 'Delivery delay', text: 'Mera order 3 din se accepted dikh raha hai lekin abhi tak deliver nahi hua!' },
  { label: 'Fitment issue', text: 'Part mera vehicle model pe fit nahi ho raha, seller ne galat variant bheja hai' },
];

export default function ComplaintForm({ onSubmit, loading, user }) {
  const [complaintText, setComplaintText] = useState('');
  const canSubmit = complaintText.trim().length >= 5 && !loading;

  if (user && user.role !== 'buyer') {
    return (
      <div className="text-sm text-paper-dim dark:text-muted leading-relaxed">
        Complaints sirf <span className="font-bold text-paper">buyer</span> account se file hoti hain.
        Tum <span className="font-bold text-paper">{user.role}</span> ke roop mein login ho. Logout karke buyer account use karo.
      </div>
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(complaintText.trim());
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-2 h-7 bg-amber rounded-full shadow-xs" />
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-paper tracking-tight">Intake Case</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold text-paper-dim dark:text-muted uppercase tracking-wider">
              Your Complaint
            </label>
            <span className="text-[11px] font-semibold text-paper-dim dark:text-muted">Hindi / Hinglish supported</span>
          </div>
          <div className="relative">
            <textarea
              id="complaint-text"
              value={complaintText}
              onChange={(e) => setComplaintText(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Apni problem likho... e.g. 'Mera order deliver ho gaya lekin part galat hai'"
              className="w-full bg-ink-lighter border border-border-strong rounded-xl px-4 py-3.5 text-base text-paper
                         placeholder:text-paper-dim/60 dark:placeholder:text-muted/60 resize-none leading-relaxed
                         focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-amber transition-colors shadow-xs"
            />
            <span className="absolute bottom-3 right-3 text-xs tabular-nums font-mono text-paper-dim dark:text-muted">
              {complaintText.length} chars
            </span>
          </div>

          <div className="mt-3.5">
            <div className="flex items-center gap-1.5 text-xs text-paper-dim dark:text-muted mb-2 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber" />
              <span>Quick test cases:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_COMPLAINTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setComplaintText(item.text)}
                  className="text-xs font-medium bg-ink-lighter hover:bg-ink hover:border-amber/50 border border-border-strong
                             text-paper px-3 py-1.5 rounded-lg transition-all duration-150 shadow-2xs cursor-pointer active:scale-95"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          id="submit-complaint-btn"
          type="submit"
          disabled={!canSubmit}
          className="w-full font-bold text-base rounded-xl py-4 transition-all duration-200 active:scale-[0.98] cursor-pointer
                     disabled:cursor-not-allowed bg-amber text-ink hover:bg-amber-light shadow-md hover:shadow-lg
                     disabled:bg-ink-lighter disabled:text-muted disabled:shadow-none"
        >
          {loading ? 'Investigating...' : 'Run Investigation'}
        </button>
      </form>
    </div>
  );
}
