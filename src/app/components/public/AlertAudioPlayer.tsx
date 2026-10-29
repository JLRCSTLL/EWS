import { useState } from 'react';
import type { AlertAudio } from '../../lib/live-model';
import { alertAudioUrl } from '../../lib/alert-audio';
import '../../../styles/alert-audio.css';

export function AlertAudioPlayer({ audio }: { audio?: AlertAudio | null }) {
  const [failed, setFailed] = useState(false);
  if (!audio) return null;
  return <section className="el-alert-audio" aria-label="Audio attached to this alert">
    <strong>{audio.kind === 'voice' ? 'Voice message' : 'Attached alarm sound'}</strong>
    <p>{audio.name} · {(audio.durationMs / 1000).toFixed(1)} sec</p>
    <audio key={audio.id} controls preload="none" src={alertAudioUrl(audio.id)} onError={() => setFailed(true)} onCanPlay={() => setFailed(false)} aria-label="Play alert audio" />
    {failed && <p role="status">Audio could not load. Check your connection and try again. The written instructions are shown above.</p>}
  </section>;
}
