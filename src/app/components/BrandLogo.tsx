import '../../styles/agila-brand.css';

export function BrandLogo({ caption = '', compact = false }: { caption?: string; compact?: boolean }) {
  return <span className={`agila-logo${compact ? ' agila-logo-compact' : ''}`}>
    <img className="agila-mark" width={compact ? 30 : 42} height={compact ? 29 : 38} src="/brand/agila-mark-white.svg" alt="" aria-hidden="true" />
    <span className="agila-logo-type"><img className="agila-wordmark" width={compact ? 92 : 117} height={compact ? 15 : 19} src="/brand/agila-wordmark-white.svg" alt="AGILA" />{caption && <span className="agila-logo-caption">{caption}</span>}</span>
  </span>;
}

export function LoadingScreen({ mobile = false }: { mobile?: boolean }) {
  return <div className="agila-loading-screen" role="status" aria-live="polite" aria-busy="true">
    <div className="agila-loading-contours" aria-hidden="true" />
    <div className="agila-loading-content">
      <img className="agila-loading-mark" src="/brand/agila-mark-white.svg" alt="" aria-hidden="true" />
      <img className="agila-loading-wordmark" src="/brand/agila-wordmark-white.svg" alt="AGILA" />
      <p className="agila-expansion">Advanced Geospatial Intelligence<br />for Life Safety and Alerts</p>
      <div className="agila-loading-track" aria-hidden="true"><span /></div>
      <p className="agila-loading-status">{mobile ? 'Connecting to your command center' : 'Preparing your command center'}</p>
    </div>
    <span className="agila-loading-edition">{mobile ? 'MOBILE RESPONSE' : 'COMMAND CENTER'}</span>
  </div>;
}
