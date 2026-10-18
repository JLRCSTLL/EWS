import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, CircleAlert, Expand, Grid2X2, Grid3X3, MapPin, Pause, Play, Radio, RotateCcw, Search, Send, ShieldCheck, TrafficCone, Video, VideoOff, Waves } from 'lucide-react';
import { cameraCategoryLabels, demoCameras, filterCameras, type CameraCategory, type CameraStatus, type DemoCamera } from '../../lib/cctv';
import type { AlertGeofence } from '../../lib/geofencing';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import '../../../styles/cctv.css';

const categoryIcons = { flood: Waves, traffic: TrafficCone, accidents: CircleAlert };
const statusLabels: Record<CameraStatus, string> = { loading: 'Loading clip', playing: 'Demo playing', paused: 'Paused', buffering: 'Buffering', error: 'Feed unavailable' };
const clockFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Manila' });

function CameraVideo({ camera, paused, time, onStatus }: { camera: DemoCamera; paused: boolean; time: string; onStatus?: (id: string, status: CameraStatus) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>('loading');
  const [retry, setRetry] = useState(0);
  const report = (next: CameraStatus) => setStatus(next);
  useEffect(() => { onStatus?.(camera.id, status); }, [camera.id, status, onStatus]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(error => { if (error.name !== 'AbortError') setStatus(error.name === 'NotAllowedError' ? 'paused' : 'error'); });
  }, [paused, camera.id, retry]);
  const play = () => videoRef.current?.play().catch(() => setStatus('paused'));
  return <div className="cctv-video">
    <video key={`${camera.id}-${retry}`} ref={videoRef} src={`/demo-cctv/${camera.source}.mp4`} poster={`/demo-cctv/${camera.source}.jpg`}
      muted loop playsInline preload="metadata" aria-label={`${camera.name} — illustrative demo video`}
      onLoadedMetadata={event => { const video = event.currentTarget; if (Number.isFinite(video.duration)) video.currentTime = Math.min(camera.offset, Math.max(0, video.duration - 1)); if (paused) report('paused'); }}
      onPlaying={() => report('playing')} onPause={() => setStatus(current => current === 'error' ? current : 'paused')}
      onWaiting={() => report('buffering')} onError={() => report('error')} />
    <div className="cctv-video-top"><span className={`cctv-stream-state is-${status}`}><i />{statusLabels[status]}</span><span>{camera.id}</span></div>
    <div className="cctv-video-bottom"><span>ILLUSTRATIVE FOOTAGE</span><time>{time} PHT</time></div>
    {status === 'error' && <div className="cctv-video-fallback" role="status"><VideoOff size={25} /><strong>Demo clip unavailable</strong><button onClick={() => { setStatus('loading'); setRetry(value => value + 1); }}><RotateCcw size={13} />Retry clip</button></div>}
    {status === 'paused' && !paused && <button className="cctv-play-overlay" onClick={play} aria-label={`Play ${camera.name}`}><Play size={20} />Play demo</button>}
  </div>;
}

interface Props {
  areas: AlertGeofence[];
  onOpenArea: (id: string) => void;
  onPreviewAlert: (id: string) => void;
}

export function CctvMonitoring({ areas, onOpenArea, onPreviewAlert }: Props) {
  const [category, setCategory] = useState<CameraCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [reviewed, setReviewed] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('ews-cctv-reviewed') || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => demoCameras.some(camera => camera.id === id && camera.event)) : []);
    } catch { return new Set(); }
  });
  const [selectedId, setSelectedId] = useState(demoCameras[0].id);
  const [expanded, setExpanded] = useState<DemoCamera | null>(null);
  const [compact, setCompact] = useState(true);
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [background, setBackground] = useState(document.hidden);
  const [now, setNow] = useState(() => Date.now());
  const [startedAt] = useState(() => Date.now());
  const [statuses, setStatuses] = useState<Record<string, CameraStatus>>({});
  useEffect(() => { try { sessionStorage.setItem('ews-cctv-reviewed', JSON.stringify([...reviewed])); } catch { /* Session-only review still works when browser storage is unavailable. */ } }, [reviewed]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    const visibility = () => setBackground(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  // Stable callback prevents playback status updates from re-running on every clock tick.
  const reportStatus = useMemo(() => (id: string, status: CameraStatus) => setStatuses(current => current[id] === status ? current : { ...current, [id]: status }), []);
  const cameras = filterCameras(demoCameras, category, query, attentionOnly, reviewed);
  const selected = cameras.find(camera => camera.id === selectedId) || cameras[0];
  const selectedArea = selected && areas.find(area => area.id === selected.areaId);
  const pending = demoCameras.filter(camera => camera.event && !reviewed.has(camera.id));
  const time = clockFormat.format(now);
  const categoryIcon = selected && categoryIcons[selected.category];
  const SelectedIcon = categoryIcon || Video;
  const markReviewed = (id: string) => setReviewed(current => new Set([...current, id]));
  const clearFilters = () => { setCategory('all'); setQuery(''); setAttentionOnly(false); };

  return <main className="cctv-page" id="cctv-main" tabIndex={-1}>
    <div className="cctv-page-heading"><div><div className="ops-eyebrow"><Video size={12} />VISUAL OPERATIONS</div><h1>CCTV monitoring<span>.</span></h1><p>Watch conditions. Verify an incident. Coordinate the response.</p></div><div className="cctv-demo-label"><Radio size={13} /><span>DEMO CONTROL ROOM<small>Looping sample footage · simulated readings</small></span></div></div>
    <div className="cctv-summary"><span><Video size={15} /><strong>{demoCameras.length}</strong> demo cameras</span><span><CircleAlert size={15} /><strong>{pending.length}</strong> need review</span><span><ShieldCheck size={15} /><strong>{reviewed.size}</strong> reviewed</span><span className="cctv-session-clock">SESSION CLOCK <time>{time}</time> PHT</span></div>
    <div className="cctv-toolbar">
      <div className="cctv-category-tabs" role="group" aria-label="Camera category">{(['all', 'flood', 'traffic', 'accidents'] as const).map(value => <button key={value} aria-pressed={category === value} className={category === value ? 'is-active' : ''} onClick={() => setCategory(value)}>{value === 'all' ? 'All cameras' : cameraCategoryLabels[value]}<span>{value === 'all' ? demoCameras.length : demoCameras.filter(camera => camera.category === value).length}</span></button>)}</div>
      <div className="cctv-view-actions"><button className={attentionOnly ? 'is-active' : ''} aria-pressed={attentionOnly} onClick={() => setAttentionOnly(value => !value)}><CircleAlert size={13} />Needs review</button><button onClick={() => setPaused(value => !value)}>{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? 'Play feeds' : 'Pause feeds'}</button><button aria-label={compact ? 'Use larger camera tiles' : 'Use compact camera wall'} onClick={() => setCompact(value => !value)}>{compact ? <Grid2X2 size={16} /> : <Grid3X3 size={16} />}</button></div>
    </div>
    <div className="cctv-content">
      <section className="cctv-wall-section" aria-label="Camera wall">
        <div className="cctv-wall-tools"><span>{cameras.length} cameras in view</span><label className="cctv-search"><Search size={14} /><input aria-label="Search cameras" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search camera or location…" />{query && <button aria-label="Clear camera search" onClick={() => setQuery('')}>×</button>}</label></div>
        <div className={`cctv-wall${compact ? ' is-compact' : ''}`}>
          {cameras.map(camera => { const Icon = categoryIcons[camera.category]; const needsReview = !!camera.event && !reviewed.has(camera.id); return <article key={camera.id} className={`cctv-camera${selected?.id === camera.id ? ' is-selected' : ''}`} aria-label={camera.name}>
            <div className="cctv-camera-visual"><CameraVideo camera={camera} time={time} paused={paused || background || !!expanded} onStatus={reportStatus} /><button className="cctv-expand" aria-label={`Expand ${camera.name}`} onClick={() => { setSelectedId(camera.id); setExpanded(camera); }}><Expand size={14} /></button></div>
            <button className="cctv-camera-info" aria-label={`Select ${camera.name}`} aria-pressed={selected?.id === camera.id} onClick={() => setSelectedId(camera.id)}><span className="cctv-camera-name"><strong>{camera.name}</strong><small><Icon size={11} />{cameraCategoryLabels[camera.category]}<span>·</span>{camera.location}</small></span><ChevronRight size={14} /></button>
            <div className={`cctv-camera-condition${needsReview ? ` is-${camera.event?.severity}` : ''}`}><span><i />{needsReview ? camera.event?.title : reviewed.has(camera.id) ? 'Reviewed by operator' : 'Routine monitoring'}</span><span>{camera.metric.value} {camera.metric.unit}</span></div>
          </article>; })}
        </div>
        {!cameras.length && <div className="cctv-empty"><VideoOff size={30} /><h2>No cameras match this view</h2><p>Try another location or clear your filters.</p><button onClick={clearFilters}>Clear filters</button></div>}
        <p className="cctv-footage-note">Demo camera names and locations are illustrative. Videos are prerecorded loops; alerts and readings are simulated. <a href="/demo-cctv/credits.txt" target="_blank" rel="noreferrer">Footage credits<ArrowUpRight size={11} /></a></p>
      </section>
      <aside className="cctv-inspector" aria-label="Camera details">
        {selected ? <section className="cctv-detail ops-glass"><div className="cctv-detail-eyebrow"><span>SELECTED CAMERA</span><span>{selected.id}</span></div><h2>{selected.name}</h2><p className="cctv-location"><MapPin size={12} />{selected.location}</p><div className="cctv-detail-type"><SelectedIcon size={14} />{cameraCategoryLabels[selected.category]}<span>{statusLabels[statuses[selected.id] || 'loading']}</span></div>
          <div className="cctv-reading"><div>{selected.metric.label}<span>DEMO</span></div><strong>{selected.metric.value}<small>{selected.metric.unit}</small></strong><p>{selected.metric.note}</p></div>
          {selected.event && <div className={`cctv-alert-detail is-${selected.event.severity}`}><div><CircleAlert size={14} /><strong>{selected.event.title}</strong></div><p>{selected.event.description}</p><button disabled={reviewed.has(selected.id)} onClick={() => markReviewed(selected.id)}><Check size={13} />{reviewed.has(selected.id) ? 'Reviewed for this session' : 'Mark reviewed'}</button></div>}
          <div className="cctv-linked-area"><span>LINKED ALERT AREA</span><strong>{selectedArea?.name || 'Linked geofence unavailable'}</strong><button disabled={!selectedArea} onClick={() => onOpenArea(selected.areaId)}>Open geofence<ArrowUpRight size={13} /></button></div>
          <button className="cctv-preview-alert" disabled={!selectedArea} onClick={() => onPreviewAlert(selected.areaId)}><Send size={14} />Preview area alert<ChevronRight size={14} /></button>
          <button className="cctv-detail-expand" onClick={() => setExpanded(selected)}><Expand size={13} />Open enlarged feed</button>
        </section> : <section className="cctv-detail ops-glass"><h2>Choose a camera</h2><p>Camera details appear here when a feed matches your filters.</p></section>}
        <section className="cctv-event-list"><div className="cctv-detail-eyebrow"><span>DEMO EVENT QUEUE</span><span>{pending.length} open</span></div>{demoCameras.filter(camera => camera.event).sort((a, b) => a.event!.minutesAgo - b.event!.minutesAgo).map(camera => <button key={camera.id} onClick={() => { clearFilters(); setSelectedId(camera.id); }}><span className={`cctv-event-dot is-${reviewed.has(camera.id) ? 'reviewed' : camera.event!.severity}`} /><span><strong>{camera.event!.title}</strong><small>{camera.id} · {clockFormat.format(startedAt - camera.event!.minutesAgo * 60_000)} · {reviewed.has(camera.id) ? 'Reviewed' : 'Open'}</small></span><ChevronRight size={12} /></button>)}</section>
      </aside>
    </div>
    <Dialog open={!!expanded} onOpenChange={open => { if (!open) setExpanded(null); }}><DialogContent className="ops-dialog cctv-dialog"><DialogHeader><div className="ops-eyebrow">CCTV / DEMO FEED</div><DialogTitle>{expanded?.name}</DialogTitle><DialogDescription>Illustrative prerecorded footage. Locations, alerts, and readings are simulated.</DialogDescription></DialogHeader>{expanded && <><CameraVideo camera={expanded} paused={paused || background} time={time} /><div className="cctv-expanded-footer"><span><MapPin size={13} />{expanded.location} · {expanded.id}</span><button onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Play feeds' : 'Pause feeds'}</button></div></>}</DialogContent></Dialog>
  </main>;
}
