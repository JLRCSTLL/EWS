import { ArrowUpRight, Check, Crosshair, PenLine, Plus, Trash2, Undo2, X } from 'lucide-react';
import { formatGeofenceArea, getGeofenceError, type AlertGeofence, type GeofenceGeometry, type GeofenceShape } from '../../lib/geofencing';

interface Props {
  saved: AlertGeofence | null;
  draft: GeofenceGeometry | null;
  areas: AlertGeofence[];
  draftName: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDraw: (shape: GeofenceShape) => void;
  onUndo: () => void;
  onCenterPoint: () => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onFocus: () => void;
  onBroadcast: () => void;
}

export function GeofenceTools(props: Props) {
  const { saved, draft } = props;
  const error = draft ? getGeofenceError(draft) : null;
  return <section className="ops-geofence-panel ops-glass" aria-label="Geofence tools">
    <div className="ops-card-heading"><h2><PenLine size={14} />Alert geofence</h2><button className="ops-small-icon" onClick={props.onClose} aria-label="Close geofence tools"><X size={14} /></button></div>
    {!draft && <div className="ops-fence-picker"><label>Saved areas ({props.areas.length})<select aria-label="Selected geofence" value={saved?.id || ''} onChange={event => props.onSelect(event.target.value)}><option value="" disabled>Choose an area</option>{props.areas.map(area => <option key={area.id} value={area.id}>{area.name || 'Unnamed area'}</option>)}</select></label><button onClick={props.onNew} aria-label="Draw a new geofence"><Plus size={15} /></button></div>}
    {draft ? <>
      <label className="ops-fence-name">Area name<input aria-label="Draft geofence name" value={props.draftName} maxLength={60} onChange={event => props.onRename(event.target.value)} /></label>
      {draft.shape !== 'boundary' && <div className="ops-fence-shapes" role="group" aria-label="Geofence shape">
        {(['polygon', 'rectangle', 'circle'] as const).map((shape) => <button key={shape} aria-pressed={draft.shape === shape} onClick={() => props.onDraw(shape)}>{shape}</button>)}
      </div>}
      <p className="ops-fence-instruction" role="status">{error || `Preview · not saved · ${formatGeofenceArea(draft)}`}</p>
      {draft.shape === 'boundary' ? <p className="ops-fence-hint">{draft.source?.note}<br /><a href={draft.source?.url} target="_blank" rel="noreferrer">{draft.source?.label}</a><br />Includes all mapped parts and excludes holes. Save to reuse this area.</p> : <p className="ops-fence-hint">Tap the map to add points. Drag a point to adjust it.</p>}
      {draft.shape !== 'boundary' && <div className="ops-fence-actions">
        <button onClick={props.onUndo} disabled={!draft.points.length}><Undo2 size={12} />Undo</button>
        <button onClick={props.onCenterPoint} disabled={draft.shape !== 'polygon' && draft.points.length === 2}><Crosshair size={12} />Add center point</button>
      </div>}
      <div className="ops-fence-actions ops-fence-actions--primary">
        <button onClick={props.onCancel}>Cancel</button>
        <button data-demo="save-area" onClick={props.onSave} disabled={!!error || !props.draftName.trim()}><Check size={13} />{draft.shape === 'boundary' ? 'Save geofence' : 'Save area'}</button>
      </div>
    </> : saved && <>
      <label className="ops-fence-name">Area name<input aria-label="Geofence area name" value={saved.name} maxLength={60} onChange={(event) => props.onRename(event.target.value)} /></label>
      <p className="ops-fence-instruction"><span className="ops-fence-shape-label">{saved.shape}</span> · {formatGeofenceArea(saved)} · saved locally</p><p className="ops-fence-hint">Search another location to add its boundary. Your saved areas stay on the map.</p>
      <div className="ops-fence-actions">
        {saved.shape !== 'boundary' && <button onClick={props.onEdit}><PenLine size={12} />Edit boundary</button>}
        <button onClick={props.onFocus}><Crosshair size={12} />Locate</button>
        <button onClick={props.onRemove} aria-label="Remove geofence"><Trash2 size={12} /></button>
      </div>
      {saved.source && <p className="ops-fence-hint"><a href={saved.source.url} target="_blank" rel="noreferrer">{saved.source.label}</a><br />{saved.source.note}</p>}
      <button className="ops-fence-broadcast" onClick={props.onBroadcast} disabled={!saved.name.trim()}>Send alert to this area<ArrowUpRight size={14} /></button>
    </>}
    {!draft && !saved && <p className="ops-fence-hint">Choose a saved area or draw a new boundary. Population counts update as you draw.</p>}
  </section>;
}
