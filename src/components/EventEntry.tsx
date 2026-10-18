import { useEffect, useRef, useState } from 'react';
import { Icon } from './Brand';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export default function EventEntry() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    function showEntry() {
      input.current?.focus({preventScroll:true});
      form.current?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
    function activate(event: MouseEvent) {
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
      if(!(event.target instanceof Element)||!event.target.closest('a[href="#join-event"]')) return;
      event.preventDefault();
      if(location.hash!=='#join-event') history.pushState(null,'','#join-event');
      showEntry();
    }
    function hashChanged() { if(location.hash==='#join-event')showEntry(); }
    document.addEventListener('click',activate);
    window.addEventListener('hashchange',hashChanged);
    hashChanged();
    return ()=>{document.removeEventListener('click',activate);window.removeEventListener('hashchange',hashChanged);};
  },[]);
  function open(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    let id = value.trim();
    if (!uuid.test(id)) {
      try {
        const url = new URL(id, location.origin);
        id = url.pathname.match(/^\/events\/([^/]+)\/?$/)?.[1] ?? '';
      } catch { id = ''; }
    }
    if (!uuid.test(id)) { setError('Paste the event link from your organiser, or its event ID. Your private invitation is entered after sign-in.'); return; }
    // Always navigate within this deployment, even when a link came from another host.
    location.assign(`/events/${id.toLowerCase()}`);
  }
  return <form ref={form} className="event-entry panel" id="join-event" onSubmit={open}>
    <label htmlFor="event-link">Have an event link?</label>
    <div className="entry-row"><input ref={input} id="event-link" type="text" placeholder="Paste your organiser’s event link" value={value} onChange={e=>{setValue(e.target.value);setError('');}} required autoComplete="off" aria-describedby="event-link-help" aria-invalid={Boolean(error)}/><button className="primary" type="submit">Open event <Icon name="arrow"/></button></div>
    <p id="event-link-help" className={error?'field-error':'muted'} role={error?'alert':undefined}>{error||'Your invitation stays private. You’ll enter it inside the event.'}</p>
  </form>;
}
