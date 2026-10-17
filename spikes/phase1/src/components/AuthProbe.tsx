import { useEffect, useState } from 'react';
import { createAuthClient } from '@neondatabase/neon-js/auth';

export default function AuthProbe() {
  const [message, setMessage] = useState('Live authentication has not been checked.');
  const [pending, setPending] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const client = () => createAuthClient(new URL('/api/auth', window.location.origin).href);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('auth') === 'failed') {
      setMessage('Sign-in callback failed. Check the provider, trusted origin, and test-user settings.');
      return;
    }
    void probe();
  }, []);
  async function signIn() {
    setPending(true);
    try {
      const result = await client().signIn.social({
        provider: 'google',
        callbackURL: new URL('/auth/callback', window.location.origin).href,
      });
      if (result.error) setMessage('Google sign-in could not start. Check the provider and trusted-origin configuration.');
      else setMessage('Opening Google sign-in...');
    } catch { setMessage('Google sign-in could not start. No signed-in session was confirmed.'); }
    finally { setPending(false); }
  }
  async function signOut() {
    setPending(true);
    try {
      const result = await client().signOut();
      if (result.error) { setMessage('Sign-out failed. The existing session may still be active.'); return; }
      setSignedIn(false);
      setMessage('Signed out. Use Check session to confirm the server rejects the session.');
    } catch { setMessage('Sign-out could not be confirmed.'); }
    finally { setPending(false); }
  }
  async function probe() {
    setPending(true);
    try {
      // Same-origin proxy is necessary: browser cookies set on the Neon domain
      // are not automatically available to Astro's server on the app domain.
      const session = await client().getSession();
      if (session.error) { setMessage('Authentication unavailable or not configured.'); return; }
      const server = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' });
      setSignedIn(Boolean(session.data?.session && server.ok));
      setMessage(session.data?.session && server.ok
        ? 'Signed in: browser and server session checks both succeeded.'
        : 'Not signed in. Use Sign in with Google to test the configured provider.');
    } catch { setMessage('Session probe failed; no authentication result recorded.'); }
    finally { setPending(false); }
  }
  return <section aria-labelledby="auth-probe-title">
    <h2 id="auth-probe-title">Auth adapter probe</h2>
    <button disabled={pending} onClick={signIn}>Sign in with Google</button>{' '}
    <button disabled={pending} onClick={probe}>{pending ? 'Checking...' : 'Check session'}</button>{' '}
    <button disabled={pending || !signedIn} onClick={signOut}>Sign out</button>
    <p role="status">{message}</p>
  </section>;
}
