import { useCallback, useEffect, useRef, useState } from 'react';
import { createAuthClient } from '@neondatabase/neon-js/auth';

type Progress = { claimedCount: number; lineCount: number; blackout: boolean };
type Cell = { position: number; squareKey: string | null; label: string | null; skillKey: string | null; claimed: boolean };
type Player = Progress & { displayName: string; codesRemaining: number };
type OwnState = { participationId: string; displayName: string; recruitmentConsent: boolean; skills: string[]; card: Cell[]; codes: { ordinal: number; token: string; spent: boolean }[]; progress: Progress };
type Board = { event: { title: string; status: string; closesAt: string | null }; players: Player[]; page: number; total: number };
type PendingClaim = { userId: string; squareKey: string; code: string; requestId: string };
type HostState = { players: (Player & { participationId: string; firstLineAt: string | null })[]; firstLineWinners: string[]; tiePolicy: string };
type Reveal = { description: string; skills: { skillKey: string; label: string; peerConfirmedCount: number; selfSelectedCount: number }[] };

class ApiError extends Error {
  status: number;
  constructor(code: string, status: number) { super(code); this.status = status; }
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options });
  let data;
  try { data = await response.json(); } catch { throw new ApiError('connection_failed',503); }
  if (!response.ok) throw new ApiError(data.code ?? data.error ?? 'request_failed',response.status);
  return data;
}
const messages: Record<string,string> = {
  invitation_invalid: 'That invitation is invalid, expired, or already used by another account.',
  display_name_invalid: 'Enter a display name between 1 and 80 characters.',
  round_not_open: 'The round is not open. Refresh to check its status.',
  joining_closed: 'Joining has closed for this event.', code_invalid: 'That code is not valid for this event.',
  code_spent: 'That code has already been used.', self_claim: 'Your own codes are for other players.',
  square_already_claimed: 'That square is already claimed. Your submitted code was not newly spent.',
  rate_limited: 'Please wait a few seconds, then retry.', host_required: 'This account is not a host for this event.',
};
const describe = (error: unknown) => error instanceof ApiError ? messages[error.message] ?? 'The request could not be confirmed. Please try again.' : 'Connection interrupted. Please try again.';

export default function GameApp({ eventId }: { eventId: string }) {
  const base = `/api/events/${eventId}`;
  const storageKey = `gdgbingo:pending:${eventId}`;
  const [userId,setUserId] = useState<string | null>(null);
  const [own,setOwn] = useState<OwnState | null>(null);
  const [board,setBoard] = useState<Board | null>(null);
  const [message,setMessage] = useState('Loading your event…');
  const [busy,setBusy] = useState(false);
  const [tab,setTab] = useState<'card'|'board'|'host'>('card');
  const [page,setPage] = useState(1);
  const [name,setName] = useState(''); const [invitation,setInvitation] = useState('');
  const [selected,setSelected] = useState<Cell | null>(null); const [code,setCode] = useState('');
  const [pending,setPending] = useState<PendingClaim | null>(null);
  const [consent,setConsent] = useState(false); const [skills,setSkills] = useState<string[]>([]);
  const [host,setHost] = useState<HostState | null>(null); const [reveal,setReveal] = useState<Reveal | null>(null);
  const [clock,setClock] = useState(0);
  const inFlight = useRef(false); const codeInput = useRef<HTMLInputElement>(null);
  const boardRequest = useRef<AbortController | null>(null);
  const client = () => createAuthClient(new URL('/api/auth',location.origin).href);
  async function loadOwn() {
    try {
      const state = await api<OwnState>(`${base}/me`);
      setOwn(state); setConsent(state.recruitmentConsent); setSkills(state.skills);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) { setOwn(null); return; }
      throw error;
    }
  }
  const loadBoard = useCallback(async () => {
    boardRequest.current?.abort();
    const controller = new AbortController();
    boardRequest.current = controller;
    const result = await api<Board>(`${base}/board?page=${page}`,{signal:controller.signal});
    if(controller.signal.aborted) throw new DOMException('Aborted','AbortError');
    setBoard(result);
    return result;
  },[base,page]);
  async function refresh() {
    setBusy(true);
    try {
      await loadBoard();
      try {
        const session = await api<{ userId: string }>('/api/session');
        setUserId(session.userId);
        await loadOwn();
        let restored: PendingClaim | null = null;
        try { restored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'); } catch { /* Corrupt local data is ignored. */ }
        if (restored && restored.userId === session.userId && typeof restored.requestId === 'string' && typeof restored.code === 'string' && typeof restored.squareKey === 'string') {
          setPending(restored); setMessage('An earlier claim needs confirmation. Use Retry claim before submitting another.');
        } else { setPending(null); setMessage('Ready. Find someone who matches a square.'); }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) { setUserId(null); setOwn(null); setMessage('Sign in with Google to join.'); }
        else throw error;
      }
    } catch (error) { setMessage(describe(error)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); },[eventId]);
  useEffect(() => { if (selected) codeInput.current?.focus(); },[selected]);
  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(()=>setClock(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[]);
  useEffect(() => {
    if (tab !== 'board') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false, running = false, failures = 0;
    async function poll() {
      clearTimeout(timer);
      if (stopped || running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const result = await loadBoard(); failures = 0;
        if (!stopped && document.visibilityState==='visible' && result.event.status === 'open') timer = setTimeout(poll,27_000+Math.random()*6_000);
      } catch {
        failures++;
        if (!stopped && document.visibilityState==='visible' && failures < 5) timer = setTimeout(poll,Math.min(120_000,30_000*2**failures));
      } finally { running = false; }
    }
    function visible() { if (document.visibilityState === 'visible') void poll(); else {clearTimeout(timer);boardRequest.current?.abort();} }
    void poll(); document.addEventListener('visibilitychange',visible);
    return ()=>{stopped=true;clearTimeout(timer);boardRequest.current?.abort();document.removeEventListener('visibilitychange',visible);};
  },[tab,loadBoard]);
  async function signIn() {
    setBusy(true);
    try {
      sessionStorage.setItem('gdgbingo:return-event',eventId);
      const result = await client().signIn.social({provider:'google',callbackURL:new URL('/auth/callback',location.origin).href});
      if(result.error) throw new Error();
    } catch { setMessage('Google sign-in could not start. Please try again.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true);
    try {
      const result=await client().signOut(); if(result.error) throw new Error();
      sessionStorage.removeItem(storageKey); setPending(null); setOwn(null); setUserId(null); setHost(null); setReveal(null);
      setCode(''); setInvitation(''); setMessage('Signed out.');
    } catch {setMessage('Sign-out could not be confirmed. Please try again.');}
    finally {setBusy(false);}
  }
  async function join(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      await api(`${base}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:name,invitation})});
      setInvitation(''); await loadOwn(); setMessage('You’re in. Your card and two codes are ready.');
    } catch(error) {setMessage(describe(error));} finally {setBusy(false);}
  }
  async function claim(event?: React.SyntheticEvent<HTMLFormElement>) {
    event?.preventDefault();
    if(inFlight.current || !userId || (!pending && (!selected?.squareKey || !code.trim()))) return;
    const request = pending ?? {userId,squareKey:selected!.squareKey!,code,requestId:crypto.randomUUID()};
    try {sessionStorage.setItem(storageKey,JSON.stringify(request));}
    catch {setMessage('Allow session storage to keep your claim safe across interruptions, then try again.');return;}
    inFlight.current=true; setBusy(true); setPending(request); setMessage('Checking your claim. Please wait…');
    try {
      await api(`${base}/claims`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({squareKey:request.squareKey,code:request.code,requestId:request.requestId})});
      sessionStorage.removeItem(storageKey); setPending(null); setSelected(null); setCode('');
      setMessage('Square claimed!'); await loadOwn(); await loadBoard();
    } catch(error) {
      if(error instanceof ApiError && error.status<500 && error.status!==429 && error.status!==401) {
        sessionStorage.removeItem(storageKey);setPending(null);setMessage(describe(error));
      } else setMessage('This claim’s outcome is not confirmed. Keep the same code and use Retry claim.');
    } finally {inFlight.current=false;setBusy(false);}
  }
  async function saveConsent(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);
    try {await api(`${base}/me/profile`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({recruitmentConsent:consent,skills})});setMessage('Preferences saved.');}
    catch(error){setMessage(describe(error));}finally{setBusy(false);}
  }
  async function hostAction(action: 'state'|'open'|'close'|'reveal') {
    setBusy(true);
    try {
      if(action==='reveal') setReveal(await api<Reveal>(`${base}/host/reveal`));
      else {
        if(action!=='state') await api(`${base}/host/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        setHost(await api<HostState>(`${base}/host/state`)); await loadBoard();
      }
      setMessage(action==='open'?'The 12-minute round is open.':action==='close'?'The round is closed.':'Host information updated.');
    }catch(error){setMessage(describe(error));}finally{setBusy(false);}
  }
  const seconds = board?.event.closesAt ? Math.max(0,Math.ceil((new Date(board.event.closesAt).getTime()-clock)/1000)) : null;
  const open = board?.event.status==='open' && (seconds===null || seconds>0);
  return <>
    <header><h1>{board?.event.title ?? 'GDG Bingo'}</h1><p>Two codes. New conversations. Your next team.</p>
      <div className="row spread"><span>{board?.event.status==='draft'?'Waiting for the host':open?`Round open · ${Math.floor((seconds??0)/60)}:${String((seconds??0)%60).padStart(2,'0')} left`:'Round closed'}</span>
      <div className="row"><button disabled={busy} onClick={()=>void refresh()}>Refresh</button>{userId&&<button disabled={busy||Boolean(pending)} onClick={()=>void signOut()}>Sign out</button>}</div></div>
    </header>
    <p role="status" className="notice">{message}</p>
    {!userId&&<section className="panel"><h2>Join the room</h2><p>Sign in, then enter the private invitation from your organiser.</p><button className="primary" disabled={busy} onClick={()=>void signIn()}>Sign in with Google</button></section>}
    {userId&&!own&&<form className="panel" onSubmit={join}><h2>Your invitation</h2>
      <label htmlFor="name">Display name</label><input id="name" type="text" maxLength={80} required value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" />
      <label htmlFor="invitation">Private invitation</label><input id="invitation" type="text" maxLength={80} required value={invitation} onChange={e=>setInvitation(e.target.value)} autoComplete="off" spellCheck={false} />
      <p className="muted">Your display name and progress appear on the public board. Event records are retained for 30 days. Recruitment follow-up is optional.</p>
      <button className="primary" disabled={busy}>Join event</button></form>}
    <nav className="tabs" aria-label="Event views">{(['card','board','host'] as const).map(item=><button key={item} aria-pressed={tab===item} onClick={()=>{setTab(item);if(item==='host'&&userId)void hostAction('state');}}>{item==='card'?'My card':item==='board'?'Board':'Host'}</button>)}</nav>
    {tab==='card'&&own&&<>
      <section className="panel"><div className="row spread"><h2>{own.displayName}’s card</h2><span>{own.progress.claimedCount}/24 · {own.progress.lineCount} {own.progress.lineCount===1?'line':'lines'}</span></div>
        <p className="muted">Find a match. Ask for a code in a Teams DM. Select the matching square.</p>
        <div className="card" aria-label="Bingo card">{own.card.map(cell=><button key={cell.position} className={cell.claimed||cell.position===12?'marked':''} aria-pressed={selected?.position===cell.position} disabled={busy||Boolean(pending)||cell.claimed||cell.position===12||!open} onClick={()=>setSelected(cell)} aria-label={`${cell.label??'Free centre'}${cell.claimed?', claimed':''}`}>
          {cell.position===12?'FREE':<>{cell.claimed?'✓ ':''}{cell.label}</>}
        </button>)}</div>
        {selected&&!pending&&<form onSubmit={claim}><h3>{selected.label}</h3><label htmlFor="received-code">Code from your match</label><input id="received-code" ref={codeInput} type="text" autoComplete="off" spellCheck={false} maxLength={80} required value={code} onChange={e=>setCode(e.target.value)} /><div className="row" style={{marginTop:12}}><button className="primary" disabled={busy||!open}>Claim square</button><button type="button" onClick={()=>setSelected(null)}>Cancel</button></div></form>}
        {pending&&<div><p>{busy?'Checking this claim. Please wait…':'An earlier claim needs confirmation. Retrying keeps the same code and request.'}</p><button className="primary" disabled={busy} onClick={()=>void claim()}>{busy?'Checking claim…':'Retry claim'}</button></div>}
      </section>
      <section className="panel"><h2>Your two outgoing codes</h2><p className="muted">Give each code to one person through a Teams DM. It confirms one square, once.</p>{own.codes.map(item=><div key={item.ordinal} className="panel"><div className="row spread"><strong>Code {item.ordinal} · {item.spent?'Used':'Available'}</strong><button disabled={item.spent} onClick={async()=>{try{await navigator.clipboard.writeText(item.token);setMessage('Code copied. Send it privately to your match.');}catch{setMessage('Copy unavailable. Select the code text to copy it manually.');}}}>Copy code {item.ordinal}</button></div><p className="code">{item.token.match(/.{1,8}/g)?.join('-')}</p></div>)}</section>
      <form className="panel" onSubmit={saveConsent}><h2>Stay involved</h2><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to GDG organisers contacting me about future projects using my event identity.</label><p className="muted">Optional. You can withdraw here. It does not affect your game. Event records are retained for 30 days.</p><fieldset><legend>Skills you’d like to share (optional)</legend>{own.card.filter(cell=>cell.skillKey).map(cell=><label className="check-label" key={cell.squareKey}><input type="checkbox" checked={skills.includes(cell.skillKey!)} onChange={e=>setSkills(current=>e.target.checked?[...current,cell.skillKey!]:current.filter(key=>key!==cell.skillKey))}/>{cell.label}</label>)}</fieldset><button disabled={busy}>Save preferences</button></form>
    </>}
    {tab==='board'&&board&&<section className="panel"><h2>Meet the room</h2><p className="muted">Updates about every 30 seconds while visible during the round. Codes left means codes available to give.</p><PlayerTable players={board.players}/><div className="row"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} · {board.total} players</span><button disabled={page*100>=board.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>}
    {tab==='host'&&<section className="panel"><h2>Host controls</h2>{!host?<p>Sign in with an organiser account, then select Host to load controls.</p>:<><div className="row"><button disabled={busy||board?.event.status!=='draft'} onClick={()=>void hostAction('open')}>Start 12-minute round</button><button disabled={busy||board?.event.status==='draft'||board?.event.status==='closed'} onClick={()=>void hostAction('close')}>Close round</button><button disabled={busy} onClick={()=>void hostAction('reveal')}>Reveal skills</button><a className="button" href={`${base}/host/export.csv`}>Download results CSV</a></div><p>{host.tiePolicy}</p><p>First-line qualifiers: {host.players.filter(player=>host.firstLineWinners.includes(player.participationId)).map(player=>player.displayName).join(', ')||'None yet'}</p><PlayerTable players={host.players}/>{reveal&&<><h3>Skills in the room</h3><p>{reveal.description}</p><ul>{reveal.skills.map(skill=><li key={skill.skillKey}>{skill.label}: {skill.peerConfirmedCount} peer-confirmed, {skill.selfSelectedCount} self-selected</li>)}</ul></>}</>}</section>}
  </>;
}
function PlayerTable({players}:{players:Player[]}) {
  return <div className="table-wrap"><table><caption>Event standings</caption><thead><tr><th scope="col">Player</th><th scope="col">Squares</th><th scope="col">Lines</th><th scope="col">Codes left</th></tr></thead><tbody>{players.map((player,index)=><tr key={index}><th scope="row">{player.displayName}</th><td>{player.claimedCount}</td><td>{player.lineCount}{player.blackout?' · Blackout':''}</td><td>{player.codesRemaining}</td></tr>)}</tbody></table></div>;
}
