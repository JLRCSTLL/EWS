import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BellRing, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import { BrowserAlarm, createAlertTracker, presentAlert } from '../../lib/alert-alarm';
import { android, isAndroidApp, type AndroidStatus } from '../../lib/android';
import { api } from '../../lib/live-service';
import type { LiveAlert } from '../../lib/live-model';

export function AlertAlarm({ userId, alerts, onOpen, settings }: { userId: string; alerts: LiveAlert[]; onOpen: (alert: LiveAlert) => void; settings: boolean }) {
  const native = isAndroidApp();
  const tracker = useRef(createAlertTracker()), audio = useRef<BrowserAlarm | null>(null);
  const [enabled, setEnabled] = useState(false), [status, setStatus] = useState<AndroidStatus | null>(null);
  const [active, setActive] = useState<LiveAlert | null>(null), [testing, setTesting] = useState(false);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [push, setPush] = useState('Checking background notifications…');
  const [sounding, setSounding] = useState(false);
  const activeId = active?.id;
  function stop() {
    audio.current?.stop(); if (native) void android('stop').catch(() => {});
    setSounding(false); setTesting(false);
  }
  function dismiss() { stop(); setActive(null); }
  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        await android('bind', { userId });
        const state = await android('status');
        if (cancelled) return;
        setStatus(state); setEnabled(state.enabled);
        if (!state.pushConfigured) { setPush('Background push needs Firebase configuration. Alerts still update while the app is open.'); return; }
        if (!state.notifications) { setPush('Allow Android notifications to receive background alerts.'); return; }
        const { token } = await android<{token: string}>('token');
        if (cancelled) return;
        await api('/push/android', { token });
        if (!cancelled) setPush('Background notifications connected');
      } catch (error) { if (!cancelled) setPush(error instanceof Error ? error.message : 'Background push is unavailable.'); }
    };
    if (native) { void update(); window.addEventListener('focus', update); document.addEventListener('visibilitychange', update); window.addEventListener('eligtas-native-alert', update); }
    return () => { cancelled = true; window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('eligtas-native-alert', update); audio.current?.dispose(); };
  }, [native,userId]);
  useEffect(() => {
    const arrivals = tracker.current(alerts);
    if (arrivals.length) { setActive(current => presentAlert(current,arrivals[0])); setTesting(false); }
  }, [alerts]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const duration = active.priority === 'normal' ? 8000 : 30000;
    if (native) {
      void android<{playing: boolean}>('alert', { alert: { id: active.id, userId, body: active.content, priority: active.priority, createdAt: active.created_at } })
        .then(result => { if (!cancelled) setSounding(result.playing); }).catch(() => { if (!cancelled) setNote('Open Android alarm settings and check permissions.'); });
    } else if (enabled) {
      const played = audio.current?.play(duration) || false;
      setSounding(played);
      if (!played) { setEnabled(false); setNote('Your browser paused audio. Tap Enable sound to resume.'); }
    }
    const timeout = setTimeout(() => setSounding(false), duration);
    return () => { cancelled = true; clearTimeout(timeout); audio.current?.stop(); };
  }, [activeId]);
  useEffect(() => {
    const hidden = () => { if (document.hidden && !native) { audio.current?.stop(); setSounding(false); } };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [native]);
  async function run(task: () => Promise<void>) {
    setBusy(true); setNote('');
    try { await task(); } catch (error) { setNote(error instanceof Error ? error.message : 'Unable to update alarm settings.'); }
    finally { setBusy(false); }
  }
  async function toggle() {
    if (native) { const next = await android('configure', { enabled: !enabled }); setStatus(next); setEnabled(next.enabled); }
    else if (!enabled) { audio.current ??= new BrowserAlarm(); await audio.current.enable(); setEnabled(true); setNote('Sound enabled for this visit. Keep the app open and your device volume audible.'); }
    else { stop(); setEnabled(false); }
  }
  async function test() {
    setTesting(true);
    if (native) { const result = await android<{playing:boolean}>('test'); setSounding(result.playing); }
    else { audio.current ??= new BrowserAlarm(); await audio.current.enable(); setEnabled(true); setSounding(audio.current.play(4000)); }
  }
  useEffect(() => { if (!testing) return; const timer = setTimeout(() => { setSounding(false); }, 4000); return () => clearTimeout(timer); }, [testing]);
  return <>
    <section className={`el-alarm-settings ${settings ? 'el-card' : 'el-alarm-compact'}`} aria-label="Alert alarm settings">
      <div className="el-alarm-heading"><span className="el-icon-soft"><BellRing size={21} /></span><div><h2>{native ? 'Emergency alarm' : 'Alert sound'}</h2><p>{enabled ? native ? 'Alarm enabled on this phone' : 'Sound enabled for this visit' : 'Turn on sound for new alerts'}</p></div><button className="el-secondary" disabled={busy} onClick={() => void run(toggle)}>{enabled ? 'Turn off sound' : 'Enable sound'}</button></div>
      {(settings || !enabled) && <p className="el-caption">{native ? 'High and critical alerts use the phone’s alarm audio. You control volume and Do Not Disturb access below.' : 'Plays while this app is open after you enable sound. Browsers cannot override silent mode or force full volume.'}</p>}
      {settings && <><div className="el-alarm-actions"><button className="el-secondary" disabled={busy || (native && !enabled)} onClick={() => void run(test)}><Volume2 size={16} />Test alarm · 4 sec</button>{native && <button className="el-secondary" onClick={() => void run(async () => { await android('notifications'); })}>Android notifications</button>}</div>
        {native && status && <div className="el-native-settings"><label className="el-check"><input type="checkbox" checked={status.maxVolume} disabled={busy} onChange={e => { const maxVolume = e.target.checked; void run(async () => setStatus(await android('configure', { maxVolume }))); }} />Use full alarm volume for high and critical alerts</label><p className="el-caption">Rises to full alarm volume, then restores your previous volume when stopped. This also affects Test alarm. Silent ringing and alarm volume are separate Android settings.</p><p className="el-caption">Alarm volume: {status.alarmVolume} / {status.alarmMax} · DND exception: {status.dndBypass ? 'Allowed for this channel' : 'Not enabled'}</p><button className="el-secondary" onClick={() => void run(async () => { await android(status.dndAccess ? 'channel' : 'dnd'); })}>{status.dndAccess ? 'Review emergency channel' : 'Allow Do Not Disturb access'}</button><p className="el-caption">In Android settings, allow alarms and this emergency channel during Do Not Disturb. Total silence, blocked notifications, force-stop, power-off, and some battery restrictions can prevent an alarm.</p><p className="el-notice" role="status"><ShieldCheck size={16} />{push}</p></div>}
      </>}
      {note && <p className="el-notice" role="status">{note}</p>}
    </section>
    <Dialog.Root open={!!active || testing} onOpenChange={open => { if (!open) dismiss(); }}>
      <Dialog.Portal><Dialog.Overlay className="el-alarm-overlay" /><Dialog.Content className="el-alarm-dialog" aria-describedby="alarm-description">
        <Dialog.Close className="el-alarm-close" aria-label="Close and silence alarm"><X size={22} /></Dialog.Close><span className="el-alarm-symbol"><BellRing size={30} /></span>
        <span className="el-eyebrow">{testing ? 'SOUND CHECK · NO MESSAGE SENT' : `${active?.priority} PRIORITY · COMMAND CENTER`}</span>
        <Dialog.Title>{testing ? 'Test your alert alarm' : 'New alert for your area'}</Dialog.Title>
        <Dialog.Description id="alarm-description">{testing ? 'This is a local sound check. No emergency alert was sent.' : active?.content}</Dialog.Description>
        <p className="el-caption" role="status">{sounding ? 'Alarm playing · stops automatically' : enabled ? 'Alarm stopped or limited by device settings' : 'Sound is off. You can enable it in Account.'}</p>
        <div className="el-alarm-actions"><button className="el-secondary" onClick={stop}><VolumeX size={18} />Silence alarm</button><button className="el-primary" onClick={() => { if (active) onOpen(active); dismiss(); }}>{testing ? 'Done' : 'Read alert'}</button></div>
        {!testing && <p className="el-caption">Silencing does not acknowledge the alert. Read it and confirm in your inbox.</p>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
