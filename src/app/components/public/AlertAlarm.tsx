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
  const [testId, setTestId] = useState('');
  const activeId = active?.id;
  function stop() {
    audio.current?.stop(); if (native) void android('stop').catch(() => {});
    setSounding(false); setTesting(false);
  }
  function dismiss() { stop(); setActive(null); }
  useEffect(() => {
    let cancelled = false, updating = false, registeredToken = '';
    const update = async () => {
      if (cancelled || document.hidden || updating) return;
      updating = true;
      try {
        await android('bind', { userId });
        const state = await android('configure',{enabled:true,maxVolume:true});
        if (cancelled) return;
        setStatus(state); setEnabled(state.enabled);
        if (!state.pushConfigured) { setPush('Background push needs Firebase configuration. Alerts still update while the app is open.'); return; }
        if (!state.notifications) { setPush('Allow Android notifications to receive background alerts.'); return; }
        const { token } = await android<{token: string}>('token');
        if (cancelled) return;
        if (registeredToken !== token) { await api('/push/android', { token }); registeredToken = token; }
        if (!cancelled) setPush('Background notifications connected');
      } catch (error) { if (!cancelled) setPush(error instanceof Error ? error.message : 'Background push is unavailable.'); }
      finally { updating = false; }
    };
    if (native) { void update(); window.addEventListener('focus', update); document.addEventListener('visibilitychange', update); window.addEventListener('eligtas-native-alert', update); }
    return () => { cancelled = true; window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('eligtas-native-alert', update); audio.current?.dispose(); };
  }, [native,userId]);
  useEffect(() => {
    if (!native) return;
    let cancelled = false, pending = false;
    const readStatus = async () => {
      if (cancelled || pending || document.hidden) return;
      pending = true;
      try { const value = await android('status'); if (!cancelled) { setStatus(value); setEnabled(value.enabled); } }
      catch { /* Keep the last known status until the bridge reconnects. */ }
      finally { pending = false; }
    };
    void readStatus();
    window.addEventListener('eligtas-native-alarm-state',readStatus);
    const timer = activeId || testing ? setInterval(readStatus,500) : undefined;
    return () => { cancelled = true; if (timer) clearInterval(timer); window.removeEventListener('eligtas-native-alarm-state',readStatus); };
  }, [native,activeId,testing]);
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
    if (!native) { audio.current ??= new BrowserAlarm(); await audio.current.enable(); setEnabled(true); setNote('Sound enabled for this visit. Keep the app open and your device volume audible.'); }
  }
  async function test() {
    setTestId(''); setTesting(true);
    try {
      if (native) { const result = await android<{playing:boolean;alarmId?:string}>('test'); setTestId(result.alarmId || ''); setSounding(result.playing); }
      else { audio.current ??= new BrowserAlarm(); await audio.current.enable(); setEnabled(true); setSounding(audio.current.play(4000)); }
    } catch (error) { setTesting(false); throw error; }
  }
  useEffect(() => { if (!testing) return; const timer = setTimeout(() => { setSounding(false); }, 4000); return () => clearTimeout(timer); }, [testing]);
  const matchingStatus = status?.alarmId === (testing ? testId : activeId);
  const playbackMessage = native && status?.enhancedAlarms
    ? matchingStatus && status.alarmMessage ? status.alarmMessage : enabled ? 'Waiting for Android alarm status…' : 'Android permissions are required for alarm playback.'
    : sounding ? 'Alarm requested · check that you can hear it' : enabled ? 'Alarm stopped or limited by device settings' : 'Enable browser audio or check Android permissions.';
  return <>
    <section className={`el-alarm-settings ${settings ? 'el-card' : 'el-alarm-compact'}`} aria-label="Alert alarm settings">
      <div className="el-alarm-heading"><span className="el-icon-soft"><BellRing size={21} /></span><div><h2>{native ? 'Emergency alarm' : 'Alert sound'}</h2><p>{enabled ? native ? 'Alarm enabled on this phone' : 'Sound enabled for this visit' : 'Turn on sound for new alerts'}</p></div>{native?<span className="el-caption">Always enabled</span>:!enabled&&<button className="el-secondary" disabled={busy} onClick={() => void run(toggle)}>Enable browser audio</button>}</div>
      {(settings || !enabled) && <p className="el-caption">{native ? 'High and critical alerts automatically use full alarm volume, including silent ringer mode. Normal announcements follow notification settings. DND must allow alarm audio.' : 'Plays while this app is open after you enable sound. Browsers cannot override silent mode or force full volume.'}</p>}
      {settings && <><div className="el-alarm-actions"><button className="el-secondary" disabled={busy || (native && !enabled)} onClick={() => void run(test)}><Volume2 size={16} />Test alarm · 4 sec</button>{native && <button className="el-secondary" onClick={() => void run(async () => { await android('notifications'); })}>Android notifications</button>}</div>
        {native && status && <div className="el-native-settings">
          {!status.managedAlarms && <p className="el-notice">Install TANOVIQ Android pilot 0.4.1 for duty permissions and always-enabled emergency alarms.</p>}
          {status.appVersion && <p className="el-caption">Android app {status.appVersion}</p>}
          <p className="el-caption"><strong>Emergency alarm policy: always enabled, full alarm volume.</strong></p>
          <p className="el-caption">Rises to full alarm volume, then restores your previous volume when stopped. This also affects Test alarm.</p>
          <ul className="el-alarm-checks" aria-label="Alarm readiness">
            <li><strong>Notifications</strong><span>{status.notifications ? 'Allowed' : 'Blocked in Android'}</span></li>
            <li><strong>Alarm volume</strong><span>{status.maxVolume && !status.volumeFixed ? 'Full volume during emergencies' : `${status.alarmVolume} / ${status.alarmMax}`}</span></li>
            <li><strong>Do Not Disturb</strong><span>{status.dndMode === 'off' ? 'Off now · check exceptions before enabling' : status.dndAlarmsAllowed === true ? 'Current mode allows alarm audio' : status.dndAlarmsAllowed === false ? 'Current mode blocks alarm audio' : 'Check alarm exceptions in Android'}</span></li>
            <li><strong>Background location</strong><span>{status.backgroundLocation ? 'Allowed while on duty' : 'Review “Allow all the time”'}</span></li><li><strong>Emergency channel</strong><span>{status.dndBypass ? 'Allowed to interrupt priority DND' : 'Review DND exception'}</span></li>
          </ul>
          <div className="el-alarm-actions">
            {!status.dndAccess && <button className="el-secondary" disabled={busy} onClick={() => void run(async () => { await android('dnd'); })}>Allow Do Not Disturb access</button>}
            <button className="el-secondary" disabled={busy} onClick={() => void run(async () => { await android('channel'); })}>Emergency notification settings</button>
            {status.managedAlarms&&<button className="el-secondary" disabled={busy} onClick={()=>void run(async()=>{await android('permissionSetup');})}>Location & alert permissions</button>}{status.enhancedAlarms && <><button className="el-secondary" disabled={busy} onClick={() => void run(async () => { await android('soundSettings'); })}>Sound & DND settings</button><button className="el-secondary" disabled={busy} onClick={() => void run(async () => { await android('appSettings'); })}>Background app settings</button></>}
          </div>
          <p className="el-caption">Allow alarms in every DND or bedtime mode you use. If alerts arrive only after reopening the app, allow background activity in Android app settings. Device restrictions can still delay or silence alerts.</p>
          <p className="el-notice" role="status"><ShieldCheck size={16} />{push}</p>
          {status.alarmMessage && <p className="el-notice" role="status"><strong>Last alert on this phone</strong>{status.alarmMessage}</p>}
        </div>}
      </>}
      {note && <p className="el-notice" role="status">{note}</p>}
    </section>
    <Dialog.Root open={!!active || testing} onOpenChange={open => { if (!open) dismiss(); }}>
      <Dialog.Portal><Dialog.Overlay className="el-alarm-overlay" /><Dialog.Content className="el-alarm-dialog" aria-describedby="alarm-description">
        <Dialog.Close className="el-alarm-close" aria-label="Close and silence alarm"><X size={22} /></Dialog.Close><span className="el-alarm-symbol"><BellRing size={30} /></span>
        <span className="el-eyebrow">{testing ? 'SOUND CHECK · NO MESSAGE SENT' : `${active?.priority} PRIORITY · COMMAND CENTER`}</span>
        <Dialog.Title>{testing ? 'Test your alert alarm' : 'New command-center alert'}</Dialog.Title>
        <Dialog.Description id="alarm-description">{testing ? 'This is a local sound check. No emergency alert was sent.' : active?.content}</Dialog.Description>
        <p className="el-caption" role="status">{playbackMessage}</p>
        <div className="el-alarm-actions"><button className="el-secondary" onClick={stop}><VolumeX size={18} />Silence alarm</button><button className="el-primary" onClick={() => { if (active) onOpen(active); dismiss(); }}>{testing ? 'Done' : 'Read alert'}</button></div>
        {!testing && <p className="el-caption">Silencing does not acknowledge the alert. Read it and confirm in your inbox.</p>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
