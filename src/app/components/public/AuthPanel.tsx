import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { api, useLive } from '../../lib/live-service';
import { RegistrationForm } from './RegistrationForm';

export function AuthPanel({ welcomeIcon = false, commandCenter = false }: { welcomeIcon?: boolean; commandCenter?: boolean }) {
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
  return <section className="el-auth el-card">{welcomeIcon && <span className="el-welcome-icon" aria-hidden="true"><ShieldCheck size={34} strokeWidth={1.5} /></span>}<span className="el-eyebrow">PERSONNEL ACCESS</span><h2>{mode === 'login' ? commandCenter ? 'Command Center Platform' : 'Welcome to TANOVIQ' : mode === 'register' ? 'Create your account' : 'Recover your account'}</h2>{mode === 'login' && <p className="el-brand-intro">{commandCenter ? 'Situational awareness & response' : 'See Risk Before It Strikes.'}{!commandCenter && <small>Tanaw + Vision + IQ</small>}</p>}<p>{mode === 'register' ? 'Receive alerts for your area and reach your command center when you need help.' : mode === 'recover' ? 'Enter the recovery code saved when you registered.' : 'Sign in to see your alerts, share your location, and check your assistance requests.'}</p>
    {mode === 'register' ? <RegistrationForm busy={busy} onCreate={async fields => { setBusy(true); try { if (!(await api('/config')).registrationProfileReady) throw new Error('Registration is being updated. Please try again shortly.'); const result=await api('/auth/register',fields); setRecovery(result.recoveryCode); } finally { setBusy(false); } }} /> : <form onSubmit={submit}>
      <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} required placeholder="Your username" /></label>
      {mode === 'recover' && <label>Recovery code<input name="code" autoComplete="off" minLength={43} maxLength={43} required /></label>}
      <label>{mode === 'recover' ? 'New password' : 'Password'}<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 12} maxLength={128} required placeholder={mode === 'login' ? 'Your password' : 'At least 12 characters'} /></label>
      {error && <p className="el-error" role="alert">{error}</p>}
      <button className="el-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Reset password'}<ArrowRight size={17} /></button>
    </form>}<div className="el-auth-links"><button disabled={busy} onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'Already registered? Sign in' : 'Create an account'}</button><button disabled={busy} onClick={() => { setMode(mode === 'recover' ? 'login' : 'recover'); setError(''); }}>{mode === 'recover' ? 'Back to sign in' : 'Forgot password?'}</button></div>
  </section>;
}
