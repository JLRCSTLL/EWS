import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, Volume2, X } from 'lucide-react';
import { api } from '../../lib/live-service';
import { prepareAlertAudio } from '../../lib/alert-audio';
import type { AlertAudio } from '../../lib/live-model';
import '../../../styles/alert-audio.css';

export function AlertAudioComposer({ value, onChange, onBusy }: {
  value: AlertAudio | null; onChange: (audio: AlertAudio | null) => void; onBusy: (busy: boolean) => void;
}) {
  const [ready, setReady] = useState<boolean | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState(''), [kind, setKind] = useState<'alarm' | 'voice'>('alarm');
  const input = useRef<HTMLInputElement>(null), recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null), mounted = useRef(true), generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined), limit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const check = () => { setReady(null); void api('/config').then(result => { if (mounted.current) setReady(result.alertAudioReady === true); }).catch(() => { if (mounted.current) setReady(false); }); };
  const stopTracks = () => { clearInterval(timer.current); clearTimeout(limit.current); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  useEffect(() => {
    mounted.current = true; check();
    return () => { mounted.current = false; generation.current++; if (recorder.current?.state === 'recording') recorder.current.stop(); stopTracks(); };
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (!value) setPreview(''); }, [value]);
  function working(value: boolean) { setBusy(value); onBusy(value); }
  async function attach(blob: Blob, name: string, type: 'alarm' | 'voice', request = ++generation.current) {
    working(true); setError(''); onChange(null);
    try {
      const prepared = await prepareAlertAudio(blob);
      if (!mounted.current || request !== generation.current) return;
      const result: AlertAudio = await api('/alert-audio', { name: name.slice(0, 80), kind: type, data: prepared.data });
      if (!mounted.current || request !== generation.current) return;
      setPreview(URL.createObjectURL(prepared.blob)); onChange(result);
    } catch (error) { if (mounted.current && request === generation.current) setError(error instanceof Error ? error.message : 'Audio could not be attached.'); }
    finally { if (mounted.current && request === generation.current) working(false); }
  }
  async function record() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Recording is unavailable here. Upload an audio file instead.'); return; }
    working(true); setError(''); onChange(null);
    const request = ++generation.current;
    try {
      const capture = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!mounted.current || request !== generation.current) { capture.getTracks().forEach(track => track.stop()); return; }
      stream.current = capture;
      const recording = new MediaRecorder(capture), chunks: Blob[] = [];
      recorder.current = recording;
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onstop = () => {
        stopTracks();
        if (!mounted.current || request !== generation.current) return;
        setRecording(false);
        void attach(new Blob(chunks, { type: recording.mimeType }), 'Voice message', 'voice', request);
      };
      recording.onerror = () => { generation.current++; stopTracks(); setRecording(false); working(false); setError('Recording failed. Check microphone access or upload a file.'); };
      recording.start(); setRecording(true); setSeconds(0);
      const started = performance.now();
      timer.current = setInterval(() => setSeconds(Math.min(30, Math.floor((performance.now() - started) / 1000))), 250);
      limit.current = setTimeout(() => { if (recording.state === 'recording') recording.stop(); }, 29500);
    } catch { stopTracks(); if (mounted.current) { working(false); setError('Microphone access was not granted. Allow it in system settings, or upload an audio file.'); } }
  }
  return <section className="ops-alert-audio" aria-label="Alert audio">
    <div className="ops-audio-heading"><Volume2 size={17} /><strong>Alarm sound or voice</strong><span>Optional · 30 sec max</span></div>
    {ready !== true ? <p role="status">{ready === null ? 'Checking audio delivery…' : <>Audio needs the updated command-center service. <button type="button" onClick={check}>Check again</button></>}</p> : <>
      <p>Keep the instructions in the written message too. High and critical alerts play attached audio in the updated Android app. Announcements offer playback in the inbox.</p>
      <div className="ops-audio-actions">
        <label>File type<select aria-label="Audio file purpose" value={kind} disabled={busy} onChange={event => setKind(event.target.value as typeof kind)}><option value="alarm">Alarm sound · repeats</option><option value="voice">Voice message · plays once</option></select></label>
        <input ref={input} hidden type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void attach(file, file.name, kind); }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} />Upload audio</button>
        {recording ? <button type="button" className="is-recording" onClick={() => recorder.current?.stop()}><Square size={15} />Stop · {seconds}s</button> : <button type="button" disabled={busy} onClick={() => void record()}><Mic size={15} />Record voice</button>}
      </div>
      {busy && !recording && <p role="status">Preparing audio…</p>}
      {recording && <p role="status">Microphone is recording. Stops automatically after 30 seconds.</p>}
      {value && <div className="ops-audio-preview"><div><strong>{value.name}</strong><span>{value.kind === 'voice' ? 'Voice' : 'Alarm'} · {(value.durationMs / 1000).toFixed(1)} sec</span><button type="button" aria-label="Remove attached audio" onClick={() => { generation.current++; onChange(null); }}><X size={16} /></button></div><audio controls preload="metadata" src={preview || `/api/alert-audio/${value.id}`} aria-label="Preview attached audio" /><small>Listen before reviewing recipients. The standard alarm is used if this audio cannot load.</small></div>}
      {!value && !busy && <small>Standard alarm selected. No audio attached.</small>}
      <small>iPhone background notifications use the system alert sound; the recording can be played from the alert.</small>
    </>}
    {error && <p className="el-connected-error" role="alert">{error}</p>}
  </section>;
}
