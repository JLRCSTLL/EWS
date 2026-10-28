import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, MousePointer2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { presentationSteps, tourCardPosition, tourCueAt, tourMoveDuration, tourStepDuration, tourTypingInterval } from '../../lib/presentation-tour';
import '../../../styles/presentation-tour.css';

interface Props {
  index: number;
  onNext: () => void;
  onBack: () => void;
  onRestart: () => void;
  onExit: () => void;
  onJump: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
  projectPoint: (point: { lat: number; lng: number }) => { x: number; y: number } | null;
  onMapPoint: (point: { lat: number; lng: number }) => void;
}
interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }

// Native setters let React process the same input/change events as an operator typing.
function enterValue(element: HTMLElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

export function PresentationTour(props: Props) {
  const { index, onNext, onBack, onRestart, onExit } = props;
  const step = presentationSteps[index];
  const card = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const pointer = useRef({ x: window.innerWidth / 2, y: 90 });
  const clock = useRef({ index, elapsed: 0, cueIndex: -1, acted: false, typed: -1, waiting: 0,
    element: null as HTMLElement | null, from: pointer.current, bounds: null as Rect | null });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [problem, setProblem] = useState('');
  const [visual, setVisual] = useState({ ...pointer.current, pressed: false, typing: false, cue: 0, elapsed: 0, rect: null as Rect | null });
  const [position, setPosition] = useState({ left: 18, top: 90 });
  const last = index === presentationSteps.length - 1;
  const duration = tourStepDuration(index);
  const cue = step.cues[visual.cue] || step.cues[0];

  useEffect(() => { props.onPlayingChange(playing); }, [playing, props.onPlayingChange]);

  useEffect(() => {
    if (clock.current.index !== index) {
      clock.current = { index, elapsed: 0, cueIndex: -1, acted: false, typed: -1, waiting: 0, element: null, from: pointer.current, bounds: null };
      setProblem('');
    }
    heading.current?.focus({ preventScroll: true });
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(100, Math.max(0, now - previous));
      previous = now;
      if (document.hidden) return;
      const state = clock.current;
      const frame = tourCueAt(index, state.elapsed);
      const action = frame.cue;
      if (frame.index !== state.cueIndex) {
        state.cueIndex = frame.index; state.acted = false; state.typed = -1; state.waiting = 0;
        state.element = null; state.bounds = null; state.from = { ...pointer.current };
      }
      if (!state.acted && state.element && !state.element.isConnected) state.element = null;
      if (!state.element) {
        const element = document.querySelector<HTMLElement>(action.target);
        if (element && element.getClientRects().length) {
          state.element = element;
          element.scrollIntoView({ block: action.kind === 'map-point' || window.innerWidth < 700 ? 'center' : 'nearest', inline: 'nearest', behavior: 'instant' });
        }
      }
      const element = state.element;
      const mapPoint = action.point ? callbacks.current.projectPoint(action.point) : null;
      if (!element || (action.kind === 'map-point' && !mapPoint) || (!state.acted && element.matches(':disabled'))) {
        state.waiting += delta;
        if (state.waiting > 4000) {
          setProblem('This control is not ready. Restart the demo or skip this step.');
          setPlaying(false);
        }
        return;
      }
      const bounds = element.getBoundingClientRect();
      if (mapPoint) state.bounds = { left: mapPoint.x - 15, right: mapPoint.x + 15, top: mapPoint.y - 15, bottom: mapPoint.y + 15, width: 30, height: 30 };
      else if (bounds.width && bounds.height) state.bounds = { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      const target = state.bounds;
      if (!target) return;
      const x = Math.max(10, Math.min(window.innerWidth - 30, (target.left + target.right) / 2));
      const y = Math.max(10, Math.min(window.innerHeight - 30, (target.top + target.bottom) / 2));
      const progress = Math.min(1, frame.elapsed / tourMoveDuration);
      const ease = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : progress * progress * (3 - 2 * progress);
      pointer.current = { x: state.from.x + (x - state.from.x) * ease, y: state.from.y + (y - state.from.y) * ease };
      if (!state.acted && frame.elapsed >= tourMoveDuration) {
        state.acted = true;
        if (action.kind === 'click') element.click();
        else if (action.kind === 'select') enterValue(element, action.value || '');
        else if (action.kind === 'map-point' && action.point) callbacks.current.onMapPoint(action.point);
        else if (action.kind === 'type') { element.focus({ preventScroll: true }); enterValue(element, ''); }
      }
      if (action.kind === 'type' && state.acted) {
        const count = Math.min(action.value!.length, Math.floor((frame.elapsed - tourMoveDuration) / tourTypingInterval));
        if (count !== state.typed) { state.typed = count; enterValue(element, action.value!.slice(0, count)); }
      }
      const clipped = {
        left: Math.max(5, target.left - 5), top: Math.max(5, target.top - 5),
        right: Math.min(window.innerWidth - 5, target.right + 5), bottom: Math.min(window.innerHeight - 5, target.bottom + 5),
      };
      const rect = { ...clipped, width: clipped.right - clipped.left, height: clipped.bottom - clipped.top };
      setVisual({ ...pointer.current, pressed: !!action.kind && frame.elapsed >= tourMoveDuration && frame.elapsed < tourMoveDuration + 450,
        typing: action.kind === 'type' && state.acted, cue: frame.index, elapsed: state.elapsed, rect: rect.width > 0 && rect.height > 0 ? rect : null });
      const size = card.current?.getBoundingClientRect();
      const placed = tourCardPosition(rect, { width: window.innerWidth, height: window.innerHeight }, { width: size?.width || 310, height: size?.height || 240 });
      setPosition(current => current.left === placed.left && current.top === placed.top ? current : placed);
      state.elapsed += delta * speed;
      if (state.elapsed >= duration) { window.clearInterval(timer); callbacks.current.onNext(); }
    }, 33);
    return () => window.clearInterval(timer);
  }, [index, playing, duration, speed]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onExit(); }
      else if (event.key === 'ArrowRight' && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onNext(); }
      else if (event.key === 'ArrowLeft' && !(event.target instanceof HTMLSelectElement)) { event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onBack(); }
      else if (event.key === 'Tab') {
        const buttons = Array.from(card.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)') || []);
        if (!buttons.length) return;
        const current = buttons.indexOf(document.activeElement as HTMLElement);
        const next = current < 0 ? event.shiftKey ? buttons.length - 1 : 0 : (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        event.preventDefault(); event.stopImmediatePropagation(); buttons[next].focus();
      }
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, []);

  return createPortal(<div className="ops-tour-overlay" data-step={step.id}>
    {visual.rect && <div className="ops-tour-spotlight" aria-hidden="true" style={{ left: visual.rect.left, top: visual.rect.top, width: visual.rect.width, height: visual.rect.height }} />}
    <div className={`ops-demo-cursor${visual.pressed ? ' is-clicking' : ''}${visual.typing ? ' is-typing' : ''}`} aria-hidden="true" style={{ transform: `translate3d(${visual.x}px, ${visual.y}px, 0)` }}>
      <span className="ops-demo-click-ring" /><svg viewBox="0 0 32 38" width="29" height="35"><path d="M3 2L26 22L16 23L22 34L16 37L10 25L3 32Z" fill="#f4f8f5" stroke="#16271e" strokeWidth="2" strokeLinejoin="round" /></svg><span className="ops-demo-cursor-label">DEMO</span>
    </div>
    <div ref={card} className="ops-tour-card" role="dialog" aria-modal="true" aria-labelledby="ops-tour-title" aria-describedby="ops-tour-description" style={position}>
      <div className="ops-tour-top"><span><MousePointer2 size={12} />AUTOMATIC PRESENTATION</span><button onClick={onExit} aria-label="Exit guided demo"><X size={16} /></button></div>
      <div className="ops-tour-progress" aria-label={`Step ${index + 1} of ${presentationSteps.length}`}>{presentationSteps.map((item, stepIndex) => <span key={item.id} className={stepIndex <= index ? 'is-complete' : ''} />)}</div>
      <div className="ops-tour-chapter">{String(index + 1).padStart(2, '0')} / {String(presentationSteps.length).padStart(2, '0')}<span>{step.label}</span></div>
      <h2 id="ops-tour-title" ref={heading} tabIndex={-1}>{step.title}</h2>
      <p id="ops-tour-description">{step.description}</p>
      <div className="ops-tour-current" role="status"><i className={playing ? 'is-playing' : ''} /><span>{problem || (playing ? cue.label : 'Presentation paused')}</span></div>
      <div className="ops-tour-countdown"><i style={{ width: `${Math.max(0, 1 - visual.elapsed / duration) * 100}%` }} /></div>
      <div className="ops-tour-actions">
        <button disabled={!index} onClick={onBack} aria-label="Previous demo step"><ArrowLeft size={15} /></button>
        <button className="ops-tour-play" onClick={() => { setProblem(''); setPlaying(value => !value); }} aria-label={playing ? 'Pause automatic demo' : 'Resume automatic demo'}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Resume'}</button>
        <button onClick={last ? onExit : onNext} aria-label={last ? 'Finish guided demo' : 'Next demo step'}>{last ? <Check size={15} /> : <ArrowRight size={15} />}</button>
        <button onClick={onRestart} aria-label="Restart guided demo"><RotateCcw size={14} /></button>
      </div>
      <div className="ops-tour-options"><label>Chapter<select aria-label="Demo chapter" value={index} onChange={event=>props.onJump(Number(event.target.value))}>{presentationSteps.map((item,i)=><option key={item.id} value={i}>{i+1}. {item.label}</option>)}</select></label><label>Speed<select aria-label="Demo playback speed" value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label></div>
      <div className="ops-tour-footer"><span>Automatic · Demo data · No real alerts</span><span>Esc to exit</span></div>
    </div>
  </div>, document.body);
}

