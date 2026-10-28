import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

const storageKey = 'tanoviq-mobile-glass-tint';

export function useGlassTint() {
  const [tint, setTint] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const value = saved === null ? 65 : Number(saved);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 65;
    } catch { return 65; }
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, String(tint)); } catch { /* The appearance still works for this visit. */ }
  }, [tint]);
  return [tint, setTint] as const;
}

export function MobileAppearance({ tint, onChange }: { tint: number; onChange: (value: number) => void }) {
  return <section className="el-card el-appearance" aria-labelledby="mobile-appearance-title">
    <div className="el-section-heading"><span className="el-icon-soft"><SlidersHorizontal size={21} /></span><div><h2 id="mobile-appearance-title">Glass appearance</h2><p>Adjust the tint of your panels and navigation.</p></div></div>
    <label htmlFor="mobile-glass-tint">Glass tint <output htmlFor="mobile-glass-tint">{tint}%</output></label>
    <input id="mobile-glass-tint" type="range" min="0" max="100" step="5" value={tint} onChange={event => onChange(Number(event.target.value))} />
    <div className="el-tint-labels" aria-hidden="true"><span>Clearer</span><span>More solid</span></div>
    <p className="el-caption">Messages keep a solid background so important details stay easy to read.</p>
  </section>;
}
