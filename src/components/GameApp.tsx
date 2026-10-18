import { useCallback, useEffect, useRef, useState } from 'react';
import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BrandHeader, BrandFooter, Decorations, Icon } from './Brand';

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
  event_not_found: 'This event could not be found. Check the link from your organiser.',
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
  const [loaded,setLoaded] = useState(false);
  const [hostDenied,setHostDenied] = useState(false);
  const [confirmClose,setConfirmClose] = useState(false);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
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
    finally { setBusy(false); setLoaded(true); }
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
      const receipt = await api<{progress:Progress}>(`${base}/claims`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({squareKey:request.squareKey,code:request.code,requestId:request.requestId})});
      sessionStorage.removeItem(storageKey); setPending(null); setSelected(null); setCode('');
      setOwn(current=>current?{...current,progress:receipt.progress,card:current.card.map(cell=>cell.squareKey===request.squareKey?{...cell,claimed:true}:cell)}:current);
      setMessage('Square claimed!');
      // A refresh failure cannot turn a confirmed receipt into an unknown claim.
      try { await loadOwn(); await loadBoard(); }
      catch { setMessage('Square claimed! Some details could not refresh. Use Refresh to update them.'); }
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
        let changed: {status:string;closes_at?:string} | null = null;
        if(action!=='state') {
          const result = await api<{status:string;closes_at?:string}>(`${base}/host/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
          changed = result;
          setBoard(current=>current?{...current,event:{...current.event,status:result.status,closesAt:result.closes_at??current.event.closesAt}}:current);
        }
        setHost(await api<HostState>(`${base}/host/state`)); await loadBoard();
        // Public board data can be cached for 10 seconds; the host receipt is newer.
        if(changed) { const result=changed; setBoard(current=>current?{...current,event:{...current.event,status:result.status,closesAt:result.closes_at??current.event.closesAt}}:current); }
      }
      setMessage(action==='open'?'The 12-minute round is open.':action==='close'?'The round is closed.':'Host information updated.');
      setHostDenied(false); setConfirmClose(false);
    }catch(error){if(error instanceof ApiError && error.status===403){setHostDenied(true);setHost(null);}setMessage(describe(error));}finally{setBusy(false);}
  }
  const seconds = board?.event.closesAt ? Math.max(0,Math.ceil((new Date(board.event.closesAt).getTime()-clock)/1000)) : null;
  const open = board?.event.status==='open' && (seconds===null || seconds>0);
  const roundLabel = !board?'Loading event':board.event.status==='draft'?'Waiting for the host':open?'Round open':'Round closed';
  const available = own?.codes.filter(item=>!item.spent).length ?? 0;
  const winners = host?.players.filter(player=>host.firstLineWinners.includes(player.participationId)) ?? [];
  function cancelClaim() { setSelected(null); setCode(''); selectedButton.current?.focus(); }
  return <div className="app-frame">
    <a href="#event-main" className="skip-link">Skip to event</a>
    <Decorations/>
    <BrandHeader>
      <a className="header-help" href="/#how-to-play">How to play</a>
      <button className="utility" disabled={busy} onClick={()=>void refresh()} aria-label="Refresh"><Icon name="refresh"/><span>Refresh</span></button>
      {userId&&<button className="utility" disabled={busy||Boolean(pending)} onClick={()=>void signOut()} aria-label="Sign out"><Icon name="exit"/><span>Sign out</span></button>}
    </BrandHeader>
    <main id="event-main" className="shell event-main">
      <div className="event-heading">
        <div><p className="eyebrow">{open?'Event live':'Meet your community'}</p><h1>{board?.event.title ?? 'GDG Bingo'}</h1><p className="subtitle">Two codes. New conversations. Your next team.</p></div>
        <div className={`round-badge ${open?'is-open':''}`}><span className="status-dot"/><strong>{roundLabel}</strong>{open&&seconds!==null&&<><span className="badge-divider"/><span className="countdown" aria-label="Time remaining">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} left</span></>}</div>
      </div>
      <p role="status" className="notice"><Icon name="info"/><span>{message}</span></p>
      {!loaded&&<div className="panel loading-panel" aria-busy="true"><div className="skeleton skeleton-heading"/><div className="skeleton skeleton-card"/><p>Getting your event ready…</p></div>}
      {loaded&&!board&&<section className="panel empty-state"><Icon name="info"/><h2>Let’s find your event</h2><p>Check your connection and the event link shared by your organiser.</p><button className="primary" disabled={busy} onClick={()=>void refresh()}>Try again</button><a href="/">Back to GDG Bingo</a></section>}
      {loaded&&board&&!userId&&<section className="panel join-panel"><div className="icon-chip blue"><Icon name="people"/></div><p className="eyebrow">Your next conversation starts here</p><h2>Join the room</h2><p>Sign in with Google, then enter the private invitation from your organiser. Your card and two codes will be waiting.</p><button className="primary" disabled={busy} onClick={()=>void signIn()}>Sign in with Google <Icon name="arrow"/></button></section>}
      {userId&&!own&&<form className="panel join-panel" onSubmit={join}><p className="eyebrow">You’re one step away</p><h2>Your invitation</h2><p className="muted">Use the private invitation your organiser sent you. This is different from a player’s outgoing code.</p>
        <label htmlFor="name">Display name</label><input id="name" type="text" placeholder="What should we call you?" maxLength={80} required value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname"/>
        <label htmlFor="invitation">Private invitation</label><input id="invitation" type="text" maxLength={80} required value={invitation} onChange={e=>setInvitation(e.target.value)} autoComplete="off" spellCheck={false}/>
        <p className="muted">Your name and progress appear on the public board. Event records are retained for 30 days. Recruitment follow-up is optional.</p><button className="primary" disabled={busy}>Join event <Icon name="arrow"/></button>
      </form>}
      {board&&<div className="event-toolbar"><nav className="tabs" aria-label="Event views">{(['card','board','host'] as const).map(item=><button key={item} aria-pressed={tab===item} onClick={()=>{setTab(item);if(item==='host'&&userId)void hostAction('state');}}>{item==='card'?'My card':item==='board'?'Board':'Host'}</button>)}</nav>
        {own&&<div className="metrics" aria-label="Your progress"><div><strong>{own.progress.claimedCount}<small>/24</small></strong><span>Squares</span></div><div><strong>{own.progress.lineCount}</strong><span>Lines</span></div><div><strong>{available}</strong><span>Codes to give</span></div></div>}
      </div>}
      {tab==='card'&&own&&<>
        <div className="game-layout"><div className="card-column">
          <section className="panel card-panel" aria-labelledby="card-heading"><div className="row spread"><h2 id="card-heading">{own.displayName}’s card</h2><span className="sr-only">{own.progress.claimedCount}/24 · {own.progress.lineCount} {own.progress.lineCount===1?'line':'lines'}</span></div>
            <p className="muted card-hint">Find someone who matches a square. Ask for their code, then select that square.</p>
            {!open&&<p className="round-note">{board?.event.status==='draft'?'Your card is ready. The host will start the round.':'This round has ended. Your confirmed squares are saved.'}</p>}
            <div className="card" aria-label="Bingo card">{own.card.map(cell=><button key={cell.position} className={cell.claimed||cell.position===12?'marked':''} aria-pressed={selected?.position===cell.position} disabled={busy||Boolean(pending)||cell.claimed||cell.position===12||!open} onClick={event=>{selectedButton.current=event.currentTarget;setSelected(cell);}} aria-label={`${cell.label??'Free centre'}${cell.claimed?', claimed':''}`}>
              {cell.position===12?<strong className="free-label">FREE</strong>:<>{cell.claimed&&<Icon name="check"/>}<span>{cell.label}</span></>}
            </button>)}</div>
            {selected&&!pending&&<form className="claim-form" onSubmit={claim} onKeyDown={event=>{if(event.key==='Escape')cancelClaim();}}><h3><Icon name="target"/>Claim: {selected.label}</h3><p className="muted">Paste the code this person gave you. Your own codes are for other players.</p><label htmlFor="received-code">Code from your match</label><div className="claim-actions"><input id="received-code" ref={codeInput} type="text" autoComplete="off" spellCheck={false} maxLength={80} required value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter received code…"/><button className="primary" disabled={busy||!open}>Claim square</button><button type="button" onClick={cancelClaim}>Cancel</button></div></form>}
            {pending&&<div className="claim-form"><h3><Icon name="target"/>Confirm your claim</h3><p>{busy?'Checking this claim. Please wait…':'An earlier claim needs confirmation. Retrying keeps the same code and request.'}</p><button className="primary" disabled={busy} onClick={()=>void claim()}>{busy?'Checking claim…':'Retry claim'}</button></div>}
          </section>
        </div><aside className="wallet-column" aria-label="Your private codes and instructions">
          <section className="panel wallet"><h2><Icon name="wallet"/>Give a code</h2><h3 className="sr-only">Your two outgoing codes</h3><p className="muted">You don’t need to select a square to give a code. Copy and send it privately to your match in Teams. It works once.</p>
            {own.codes.map(item=><div key={item.ordinal} className={`code-ticket ${item.spent?'spent':'available'}`}><div className="row spread"><strong>Code {item.ordinal}</strong><span className={`badge ${item.spent?'neutral':'success'}`}>{item.spent?'Used':'Available'}</span></div><p className="code">{item.token.match(/.{1,8}/g)?.join('-')}</p><button disabled={item.spent||busy} onClick={async()=>{try{await navigator.clipboard.writeText(item.token);setMessage('Code copied. Send it privately to your match.');}catch{setMessage('Copy unavailable. Select the code text to copy it manually.');}}} aria-label={`Copy code ${item.ordinal}`}><Icon name={item.spent?'check':'copy'}/>{item.spent?'Already used':`Copy code ${item.ordinal}`}</button></div>)}
            <p className="wallet-note">Refresh to check whether a match has used your code.</p>
          </section>
          <section className="panel receive-guide"><p className="eyebrow">How to receive a code</p><ol><li>Find someone who matches a square.</li><li>Ask for their code in a Teams DM.</li><li>Select that square on <strong>your</strong> card.</li><li>Paste their code and claim.</li></ol><p className="muted">Codes aren’t tied to a particular square. Both of someone’s codes can confirm different squares for you.</p></section>
        </aside></div>
        <details className="panel preferences"><summary><span><Icon name="settings"/>Stay involved <span className="muted">(optional)</span></span><Icon name="chevron"/></summary><form onSubmit={saveConsent}><p className="muted">These choices don’t affect your game. You can change or withdraw them here.</p><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to GDG organisers contacting me about future projects using my event identity.</label><p className="muted">Event records are retained for 30 days.</p><fieldset><legend>Skills you’d like to share (optional)</legend><div className="skill-options">{own.card.filter(cell=>cell.skillKey).map(cell=><label className="check-label" key={cell.squareKey}><input type="checkbox" checked={skills.includes(cell.skillKey!)} onChange={e=>setSkills(current=>e.target.checked?[...current,cell.skillKey!]:current.filter(key=>key!==cell.skillKey))}/>{cell.label}</label>)}</div></fieldset><button className="primary" disabled={busy}>Save preferences</button></form></details>
      </>}
      {tab==='board'&&board&&<section className="panel board-panel"><div className="row spread"><div><p className="eyebrow">Good conversations add up</p><h2>Meet the room</h2></div><span className="badge neutral"><Icon name="people"/>{board.total} players</span></div><p className="muted">Updates about every 30 seconds while visible during the round. Codes left means codes available to give.</p><PlayerTable players={board.players} offset={(page-1)*100}/><div className="pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(board.total/100))}</span><button disabled={page*100>=board.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></section>}
      {tab==='host'&&<section className="panel host-panel"><p className="eyebrow">The organiser’s view</p><h2>Host controls</h2>{!host?<div className="empty-state"><Icon name="settings"/><h3>{hostDenied?'This view is for your host':busy?'Loading host controls…':'Organiser access'}</h3><p>{hostDenied?'Your player card and the public board are still available.':userId?'Select Host to check your organiser access.':'Sign in with an organiser account to load controls.'}</p></div>:<>
        <div className="host-actions"><button className="primary" disabled={busy||board?.event.status!=='draft'} onClick={()=>void hostAction('open')}>Start 12-minute round</button><button disabled={busy||board?.event.status!=='open'||!open} onClick={()=>setConfirmClose(true)}>Close round</button><button disabled={busy} onClick={()=>void hostAction('reveal')}>Reveal skills</button><a className="button" href={`${base}/host/export.csv`}>Download results CSV</a></div>
        {confirmClose&&<div className="confirm-close" role="group" aria-label="Confirm round closure"><h3>Close this round now?</h3><p>New claims will stop. A closed round cannot be restarted.</p><div className="row"><button className="danger" disabled={busy} onClick={()=>void hostAction('close')}>Confirm close round</button><button disabled={busy} onClick={()=>setConfirmClose(false)}>Keep playing</button></div></div>}
        <div className="qualification"><Icon name="trophy"/><div><h3>First-line qualifiers</h3><p>{winners.map(player=>player.displayName).join(', ')||'No qualifiers yet. The first completed line will appear here.'}</p><p className="muted">{host.tiePolicy}</p></div></div><PlayerTable players={host.players}/>
        {reveal&&<div className="skill-reveal"><h3>Skills in the room</h3><p className="muted">{reveal.description}</p><div className="skill-grid">{reveal.skills.map(skill=><div className="skill-card" key={skill.skillKey}><strong>{skill.label}</strong><div className="skill-counts"><span><b>{skill.peerConfirmedCount}</b> peer-confirmed</span><span><b>{skill.selfSelectedCount}</b> self-selected</span></div><meter min={0} max={Math.max(1,host.players.length)} value={skill.peerConfirmedCount} aria-label={`${skill.label}: peer-confirmed people`}/></div>)}</div></div>}
      </>}</section>}
    </main><BrandFooter/>
  </div>;
}
function PlayerTable({players,offset=0}:{players:Player[];offset?:number}) {
  if(!players.length)return <div className="empty-state"><Icon name="people"/><h3>The room is getting ready</h3><p>Players will appear here after joining. Invite your next conversation.</p></div>;
  return <div className="table-wrap"><table><caption className="sr-only">Event standings</caption><thead><tr><th scope="col">Player</th><th scope="col">Squares</th><th scope="col">Lines</th><th scope="col">Codes left</th></tr></thead><tbody>{players.map((player,index)=><tr key={index}><th scope="row"><span className="player-rank">{offset+index+1}</span>{player.displayName}</th><td>{player.claimedCount}<span className="muted">/24</span></td><td>{player.lineCount}{player.blackout&&<span className="badge success">Blackout</span>}</td><td>{player.codesRemaining}</td></tr>)}</tbody></table></div>;
}
