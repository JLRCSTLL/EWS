import * as Dialog from '@radix-ui/react-dialog';
import { Check, Clock3, Play, Repeat2, X } from 'lucide-react';
import { tourChapterIndices, tourEstimatedMinutes, tourLevels, tourSpeeds, type TourLevel } from '../../lib/presentation-tour';
import '../../../styles/presentation-tour.css';
import '../../../styles/presentation-controls.css';

export function PresentationSetup({ open, onOpenChange, level, speed, onLevelChange, onSpeedChange, onStart }: {
  open: boolean; onOpenChange: (open: boolean) => void; level: TourLevel; speed: number;
  onLevelChange: (level: TourLevel) => void; onSpeedChange: (speed: number) => void; onStart: () => void;
}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
    <Dialog.Overlay className="ops-demo-setup-overlay" />
    <Dialog.Content className="ops-demo-setup">
      <Dialog.Close className="ops-demo-setup-close" aria-label="Close demo setup"><X size={19}/></Dialog.Close>
      <span className="ops-demo-setup-kicker"><Play size={14}/>WEB PRESENTATION</span>
      <Dialog.Title>Choose your demo</Dialog.Title>
      <Dialog.Description>Watch the platform in action. The cursor runs the tour automatically, with time to read each chapter.</Dialog.Description>
      <fieldset className="ops-demo-levels"><legend>Demo level</legend>{tourLevels.map((item, index) => <label key={item.id} className={level === item.id ? 'is-selected' : ''}>
        <input type="radio" name="demo-level" value={item.id} checked={level === item.id} onChange={() => onLevelChange(item.id)}/>
        <span className="ops-demo-level-number">0{index + 1}</span>
        <span><strong>{item.label}</strong><small>{item.description}</small><em><Clock3 size={12}/>About {tourEstimatedMinutes(item.id, speed)} min · {tourChapterIndices(item.id).length} chapters</em></span>
        {level === item.id && <Check size={18}/>}</label>)}</fieldset>
      <label className="ops-demo-setup-speed">Playback speed<select value={speed} onChange={event => onSpeedChange(Number(event.target.value))}>{tourSpeeds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>Slow is recommended for reading. You can change speed or pause during the tour.</small></label>
      <p className="ops-demo-loop-note"><Repeat2 size={16}/>Loops automatically · sample data only · no real alerts</p>
      <button className="ops-demo-start" onClick={onStart}><Play size={17}/>Start {tourLevels.find(item => item.id === level)?.label.toLowerCase()}</button>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
