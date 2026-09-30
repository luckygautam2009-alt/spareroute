import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { login } from '../api/auth';

const inputCls =
  'w-full bg-ink-lighter border border-border-strong rounded-xl px-4 py-3 text-base text-paper ' +
  'placeholder:text-paper-dim/60 dark:placeholder:text-muted/60 focus:outline-none ' +
  'focus:ring-2 focus:ring-amber/50 focus:border-amber transition-colors';

export default function LoginCard({ onLoggedIn }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(phone.trim(), password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-2 h-7 bg-amber rounded-full shadow-xs" />
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-paper tracking-tight">Sign in</h2>
      </div>
      <p className="text-sm text-paper-dim dark:text-muted">
        Apne SpareRoute account se login karo. Complaint sirf tumhari apni identity se file hoti hai.
      </p>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="10-digit mobile number"
        inputMode="numeric"
        autoComplete="username"
        className={inputCls}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        type="password"
        autoComplete="current-password"
        className={inputCls}
      />
      {error && (
        <p className="text-xs text-alert bg-alert-dim border border-alert/30 rounded-lg px-3 py-2 font-medium">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !phone.trim() || !password}
        className="w-full flex items-center justify-center gap-2 font-bold text-base rounded-xl py-3.5
                   bg-amber text-ink hover:bg-amber-light disabled:bg-ink-lighter disabled:text-muted
                   disabled:cursor-not-allowed cursor-pointer transition-all duration-150 active:scale-[0.98]"
      >
        <LogIn className="w-4 h-4" />
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
