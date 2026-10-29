type Arrival = { id: string; created_at: string; read_at?: string | null; priority: string };
const rank: Record<string, number> = { critical: 3, high: 2, normal: 1 };
export function presentAlert<T extends Arrival>(active: T | null, incoming: T): T { return active && rank[active.priority] > rank[incoming.priority] ? active : incoming; }
export const ALARM_MAX_AGE_MS = 5 * 60 * 1000;

// The first inbox snapshot is a baseline, never a reason to replay old alarms.
export function createAlertTracker() {
  let initialized = false;
  const seen = new Set<string>();
  return <T extends Arrival>(alerts: T[], now = Date.now()): T[] => {
    const arrivals = initialized ? alerts.filter(alert => !seen.has(alert.id) && !alert.read_at &&
      Number.isFinite(Date.parse(alert.created_at)) && now - Date.parse(alert.created_at) <= ALARM_MAX_AGE_MS &&
      Date.parse(alert.created_at) <= now + 60000) : [];
    for (const alert of alerts) seen.add(alert.id);
    while (seen.size > 1000) seen.delete(seen.values().next().value!);
    initialized = true;
    return arrivals.sort((a,b) => (rank[b.priority] || 0) - (rank[a.priority] || 0) || Date.parse(b.created_at) - Date.parse(a.created_at));
  };
}

export class BrowserAlarm {
  private context: AudioContext | null = null;
  private interval: ReturnType<typeof setInterval> | undefined;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private voices = new Set<OscillatorNode>();
  private recording: AudioBufferSourceNode | null = null;
  private playback = 0;
  async enable() {
    const Audio = window.AudioContext || (window as any).webkitAudioContext;
    if (!Audio) throw new Error('This browser cannot play the alarm.');
    this.context ??= new Audio();
    await this.context!.resume();
    if (this.context!.state !== 'running') throw new Error('Tap Enable sound again to allow audio.');
  }
  play(duration = 30000) {
    this.stop();
    if (this.context?.state !== 'running') return false;
    const beep = () => {
      const context = this.context;
      if (!context || context.state !== 'running') return;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.setValueAtTime(880, context.currentTime + 0.3);
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.24, context.currentTime + 0.04);
      gain.gain.setValueAtTime(0.24, context.currentTime + 0.55);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.62);
      oscillator.connect(gain); gain.connect(context.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.voices.delete(oscillator); };
      oscillator.start(); oscillator.stop(context.currentTime + 0.65);
    };
    beep(); this.interval = setInterval(beep, 1300); this.timeout = setTimeout(() => this.stop(), duration);
    return true;
  }
  async playAttachment(url: string, loop: boolean, duration = 30000) {
    if (!this.play(duration)) return false;
    const playback = this.playback;
    // Keep the ordinary alarm sounding while an authenticated download loads.
    try {
      const response = await fetch(url, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/wav')) return true;
      const data = await response.arrayBuffer();
      if (data.byteLength > 960044 || playback !== this.playback || !this.context) return true;
      const buffer = await this.context.decodeAudioData(data);
      if (playback !== this.playback || this.context.state !== 'running') return true;
      this.stop();
      const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = loop;
      source.connect(this.context.destination); this.recording = source; source.start();
      this.timeout = setTimeout(() => this.stop(), loop ? duration : Math.ceil(buffer.duration * 1000) + 100);
      return true;
    } catch { return true; } // Default alarm remains the fallback.
  }
  stop() {
    this.playback++;
    if (this.recording) { try { this.recording.stop(); } catch {} this.recording.disconnect(); this.recording = null; }
    clearInterval(this.interval); clearTimeout(this.timeout);
    for (const voice of this.voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
    this.voices.clear();
  }
  dispose() { this.stop(); void this.context?.close(); this.context = null; }
}
