import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { LiveProvider } from './app/lib/live-service';

const CommandApp = lazy(() => import('./app/App'));
const DemoPublicApp = lazy(() => import('./app/components/public/PublicApp'));
const PublicApp = lazy(() => import('./app/components/public/LivePublicApp'));
function Root() {
  const [publicView, setPublicView] = useState(() => window.location.hash.startsWith('#/public'));
  useEffect(() => {
    const sync = () => setPublicView(window.location.hash.startsWith('#/public'));
    window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, []);
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  return <Suspense fallback={<div style={{ padding: 32, fontFamily: 'Inter, sans-serif', color: '#6380a5' }}>Loading E-Ligtas…</div>}>{publicView ? demo ? <DemoPublicApp /> : <PublicApp /> : <CommandApp />}</Suspense>;
}
createRoot(document.getElementById('root')!).render(<LiveProvider><Root /></LiveProvider>);

