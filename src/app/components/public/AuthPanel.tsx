import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { api, useLive } from '../../lib/live-service';

export function AuthPanel() {
  const { refresh, recoveryCode: recovery, setRecoveryCode: setRecovery } = useLive();
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(`/auth/${mode}`, fields);
      if (result.recoveryCode) setRecovery(result.recoveryCode); else await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  if (recovery) return <section className="el-auth el-card"><KeyRound size={30} /><h2>Save your recovery code</h2><p>This is the only way to reset your password. Store it somewhere private. Your previous recovery code, if any, no longer works.</p><code className="el-recovery">{recovery}</code><button className="el-primary" onClick={async () => { setRecovery(''); await refresh(); }}>I saved my code <ArrowRight size={17} /></button></section>;
  return <section className="el-auth el-card"><span className="el-eyebrow">PERSONNEL ACCESS</span><h2>{mode === 'login' ? 'Welcome to GSAM' : mode === 'register' ? 'Create your account' : 'Recover your account'}</h2><p>{mode === 'register' ? 'Receive alerts for your area and reach your command center when you need help.' : mode === 'recover' ? 'Enter the recovery code saved when you registered.' : 'Sign in to see your alerts, share your location, and check your assistance requests.'}</p>
    <form onSubmit={submit}>
      {mode === 'register' && <label>Preferred name<input name="name" autoComplete="nickname" minLength={2} maxLength={80} required placeholder="Preferred name or call sign" /></label>}
      <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} required placeholder="Your username" /></label>
      {mode === 'recover' && <label>Recovery code<input name="code" autoComplete="off" minLength={43} maxLength={43} required /></label>}
      <label>{mode === 'recover' ? 'New password' : 'Password'}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 12} maxLength={128} required placeholder={mode === 'login' ? 'Your password' : 'At least 12 characters'} /></label>
      {mode === 'register' && <p className="el-caption">Your account starts with personnel access. Start duty to share location with approved operators. High and critical alerts use full alarm volume in the Android app, subject to device permissions.</p>}
      {error && <p className="el-error" role="alert">{error}</p>}
      <button className="el-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Reset password'}<ArrowRight size={17} /></button>
    </form><div className="el-auth-links"><button onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Already registered? Sign in' : 'Create an account'}</button><button onClick={() => { setMode(mode === 'recover' ? 'login' : 'recover'); setError(''); }}>{mode === 'recover' ? 'Back to sign in' : 'Forgot password?'}</button></div>
  </section>;
}
