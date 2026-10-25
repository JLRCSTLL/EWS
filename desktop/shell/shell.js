'use strict';
const byId = id => document.getElementById(id);
function render(state) {
  document.body.classList.toggle('error', state.phase === 'error');
  byId('splash').hidden = state.phase === 'ready';
  byId('splash').setAttribute('aria-busy', String(state.phase === 'loading'));
  byId('status-title').textContent = state.phase === 'error' ? 'Connection interrupted' : 'Preparing your workspace';
  byId('status-detail').textContent = state.message;
  byId('retry').hidden = byId('retry-note').hidden = state.phase !== 'error';
  byId('version').textContent = `DESKTOP ${state.version}`;
  byId('connection').className = `connection ${state.service}`;
  byId('connection').querySelector('span').textContent = ({ checking: 'Connecting', connected: 'Service connected', unavailable: 'Service unavailable · Retry' })[state.service];
  byId('connection').title = state.service === 'connected' ? 'The shared service is reachable. Sign in inside the command center for live operations.' : 'Check the shared service connection';
  byId('fullscreen').setAttribute('aria-label', state.fullScreen ? 'Exit full screen' : 'Enter full screen');
  byId('awake').hidden = !state.keepAwake;
}
document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', async () => {
  button.disabled = true;
  try { await window.desktop.command(button.dataset.command); } finally { button.disabled = false; }
}));
window.desktop.onState(render);
void window.desktop.getState().then(render);
