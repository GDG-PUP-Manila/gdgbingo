import { useEffect, useState } from 'react';
export default function ReturnToEvent() {
  const [failedEvent,setFailedEvent] = useState<string | null>(null);
  useEffect(() => {
    try {
      const eventId = sessionStorage.getItem('gdgbingo:return-event');
      sessionStorage.removeItem('gdgbingo:return-event');
      const valid = eventId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId);
      if (new URLSearchParams(location.search).get('auth') === 'failed') { if(valid)setFailedEvent(eventId); return; }
      if (valid) location.replace(`/events/${eventId}`);
    } catch { /* The landing page remains usable with storage disabled. */ }
  }, []);
  return failedEvent?<p className="notice auth-return" role="alert">Google sign-in didn’t finish. <a href={`/events/${failedEvent}`}>Return to your event and try again.</a></p>:null;
}
