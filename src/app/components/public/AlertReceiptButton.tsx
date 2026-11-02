import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useLive } from '../../lib/live-service';
import type { LiveAlert } from '../../lib/live-model';

/** Reading a message is separate from accepting or completing its response incident. */
export function AlertReceiptButton({ alert }: { alert: LiveAlert }) {
  const live = useLive();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function acknowledge() {
    setBusy(true); setError('');
    try { await live.mutate(`/alerts/${alert.id}/receipt`, { read: true }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send the read receipt. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="el-alert-receipt">
    <button className="el-primary" disabled={busy || !!alert.read_at || live.connection !== 'connected'} onClick={() => void acknowledge()}>
      <CheckCheck size={18} />{alert.read_at ? 'Acknowledged' : busy ? 'Sending read receipt…' : alert.response_id ? 'Mark dispatch as read' : 'I have read this alert'}
    </button>
    {alert.read_at && <p className="el-caption" role="status">Read receipt sent to the command center.</p>}
    {error && <p className="el-notice" role="alert">{error}</p>}
  </div>;
}
