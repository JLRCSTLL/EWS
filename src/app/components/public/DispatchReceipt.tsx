import { useLive } from '../../lib/live-service';
import { AlertReceiptButton } from './AlertReceiptButton';

export function DispatchReceipt({ incidentId }: { incidentId: string }) {
  const { state } = useLive();
  const messages = state?.alerts.filter(alert => alert.response_id === incidentId) || [];
  if (!messages.length) return null;
  const unread = messages.filter(alert => !alert.read_at);
  if (!unread.length) return <p className="rsp-receipt-confirmed" role="status">Dispatch acknowledged · read receipt sent</p>;
  return <section className="rsp-dispatch-receipt" aria-label="Dispatch read receipts">
    <span className="rsp-kicker">DISPATCH MESSAGE{unread.length > 1 ? 'S' : ''} · UNREAD</span>
    {unread.map(alert => <article key={alert.id}>
      <p>{alert.content}</p>
      <AlertReceiptButton alert={alert} />
    </article>)}
    <small>Confirms that you read the message. Use the response actions to update your trip status.</small>
  </section>;
}
