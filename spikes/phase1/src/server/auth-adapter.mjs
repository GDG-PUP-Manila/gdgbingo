import { createAuthServer, handleAuthProxyRequest, processAuthMiddleware } from '@neondatabase/neon-js/auth/server';

export const privateHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
export const privateJson = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: privateHeaders });

export function readAuthConfig(env = process.env) {
  if (!env.NEON_AUTH_BASE_URL || !env.NEON_AUTH_COOKIE_SECRET) return null;
  const url = new URL(env.NEON_AUTH_BASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Auth base URL must be a fixed HTTPS endpoint without credentials, query, or fragment.');
  }
  if (env.NEON_AUTH_COOKIE_SECRET.length < 32) throw new Error('Auth cookie secret must have at least 32 characters.');
  return { baseUrl: url.href.replace(/\/$/, ''), cookieSecret: env.NEON_AUTH_COOKIE_SECRET, sameSite: 'lax' };
}

export function createAstroAuth(context, config) {
  return createAuthServer({
    ...config,
    // Per-request closure prevents one user's cookies leaking to another request.
    context: () => ({
      getCookies: () => context.request.headers.get('cookie') ?? '',
      setCookie: (name, value, options) => context.cookies.set(name, value, options),
      getHeader: name => context.request.headers.get(name),
      getOrigin: () => context.request.headers.get('origin') ?? context.url.origin,
      getFramework: () => 'astro-phase1-spike',
    }),
    // Avoid logging upstream responses, cookies, or request payloads.
    log: { debug() {}, info() {}, warn() {}, error() {} },
  });
}

export async function sessionResponse(context, env = process.env) {
  try {
    const config = readAuthConfig(env);
    if (!config) return privateJson({ error: 'auth_not_configured' }, 503);
    const result = await createAstroAuth(context, config).getSession();
    if (result.error) return privateJson({ error: 'auth_unavailable' }, 503);
    if (!result.data?.session || !result.data?.user) return privateJson({ error: 'unauthenticated' }, 401);
    // Expose the minimum diagnostic identity, never the session token/object.
    return privateJson({ authenticated: true, userId: result.data.user.id });
  } catch {
    return privateJson({ error: 'auth_unavailable' }, 503);
  }
}

export async function proxyResponse(context, env = process.env) {
  const path = context.params.path ?? '';
  const methods = new Map([
    ['get-session', 'GET'], ['sign-in/social', 'POST'],
    ['callback/google', 'GET'], ['callback/github', 'GET'], ['sign-out', 'POST'],
  ]);
  if (!methods.has(path)) return privateJson({ error: 'not_found' }, 404);
  if (context.request.method !== methods.get(path)) return privateJson({ error: 'method_not_allowed' }, 405);
  if (context.request.method === 'POST' && context.request.headers.get('origin') !== context.url.origin) {
    return privateJson({ error: 'origin_rejected' }, 403);
  }
  try {
    const config = readAuthConfig(env);
    if (!config) return privateJson({ error: 'auth_not_configured' }, 503);
    const result = await handleAuthProxyRequest({ ...config, request: context.request, path });
    const response = new Response(result.body, { status: result.status, headers: result.headers });
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.delete('Vercel-CDN-Cache-Control');
    response.headers.delete('CDN-Cache-Control');
    return response;
  } catch {
    return privateJson({ error: 'auth_unavailable' }, 503);
  }
}

export async function callbackResponse(context, env = process.env) {
  try {
    const config = readAuthConfig(env);
    if (!config) return privateJson({ error: 'auth_not_configured' }, 503);
    const result = await processAuthMiddleware({
      ...config,
      request: context.request,
      pathname: context.url.pathname,
      skipRoutes: [],
      loginUrl: '/auth/sign-in',
      logLevel: 'silent',
    });
    // Fixed same-origin destinations discard verifier/error query parameters
    // and prevent a callback query from becoming an open redirect.
    const location = result.action === 'redirect_oauth'
      ? '/auth/callback'
      : result.action === 'allow' ? '/' : '/?auth=failed';
    const headers = new Headers({
      Location: location,
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    });
    for (const cookie of result.cookies ?? []) headers.append('Set-Cookie', cookie);
    return new Response(null, { status: 302, headers });
  } catch {
    return privateJson({ error: 'auth_callback_failed' }, 503);
  }
}
