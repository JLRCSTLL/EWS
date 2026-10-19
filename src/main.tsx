import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';

const CommandApp = lazy(() => import('./app/App'));
const PublicApp = lazy(() => import('./app/components/public/PublicApp'));
function Root() {
  const [publicView, setPublicView] = useState(() => window.location.hash.startsWith('#/public'));
  useEffect(() => {
    const sync = () => setPublicView(window.location.hash.startsWith('#/public'));
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  return <Suspense fallback={<div style={{ padding: 32, fontFamily: 'Inter, sans-serif', color: '#6380a5' }}>Loading E-Ligtas…</div>}>{publicView ? <PublicApp /> : <CommandApp />}</Suspense>;
}
createRoot(document.getElementById('root')!).render(<Root />);

