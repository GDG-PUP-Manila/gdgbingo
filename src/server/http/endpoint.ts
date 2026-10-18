import type { APIContext } from 'astro';
import { createAstroAuth, readAuthConfig } from '../auth-adapter.mjs';
import { GameError } from '../game/errors.ts';

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function requireUser(context: APIContext): Promise<string> {
  const config = readAuthConfig();
  if (!config) throw new GameError('auth_not_configured', 503);
  const result = await createAstroAuth(context, config).getSession();
  if (result.error) throw new GameError('auth_unavailable', 503);
  if (!result.data?.session || !result.data.user?.id) throw new GameError('unauthenticated', 401);
  return result.data.user.id;
}

export async function readBody(context: APIContext): Promise<Record<string, unknown>> {
  if (context.request.headers.get('origin') !== context.url.origin) throw new GameError('origin_rejected', 403);
  if (context.request.headers.get('content-type')?.split(';')[0]?.trim() !== 'application/json') throw new GameError('json_required', 415);
  const reader = context.request.body?.getReader();
  if (!reader) throw new GameError('invalid_input', 422);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); throw new GameError('body_too_large', 413); }
      chunks.push(value);
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GameError('invalid_input', 422);
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof GameError) throw error;
    throw new GameError('invalid_input', 422);
  } finally { reader.releaseLock(); }
}

export function endpoint(work: (context: APIContext, eventId: string) => Promise<Response>) {
  return async (context: APIContext) => {
    try {
      const eventId = (context.params.eventId ?? '').toLowerCase();
      if (!isUuid(eventId)) throw new GameError('event_not_found', 404);
      return await work(context, eventId);
    } catch (error) {
      if (error instanceof GameError) return json({ code: error.code }, error.status);
      // Deliberately omit raw provider/database errors, query parameters and tokens.
      return json({ code: 'temporarily_unavailable' }, 503);
    }
  };
}
