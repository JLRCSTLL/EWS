import { DisasterEventFeed } from '../DisasterEventFeed';

export function DisasterFeedWidget() {
  return (
    <div className="embedded-widget-panel h-full min-h-0 min-w-0">
      <DisasterEventFeed />
    </div>
  );
}
