import { useEffect } from 'react';
export default function ReturnToEvent() {
  useEffect(() => {
    try {
      const eventId = sessionStorage.getItem('gdgbingo:return-event');
      sessionStorage.removeItem('gdgbingo:return-event');
      if (new URLSearchParams(location.search).get('auth') === 'failed') return;
      if (eventId && /^[0-9a-f-]{36}$/i.test(eventId)) location.replace(`/events/${eventId}`);
    } catch { /* The landing page remains usable with storage disabled. */ }
  }, []);
  return null;
}
