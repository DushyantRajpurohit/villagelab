/**
 * Supercell developer-key rotation.
 *
 * The API pins each key to a whitelisted IP. Free serverless and CI runners have
 * *dynamic* egress IPs, so a static key breaks intermittently and confusingly.
 * Paying for a fixed egress IP is the alternative; this module is why we don't
 * have to.
 *
 * Strategy is deliberately lazy: we only rotate after the API has actually
 * rejected us with `accessDenied.invalidIp`. That keeps us well inside the
 * ~10-keys-per-account ceiling instead of burning a key every cold start.
 *
 * This talks to the developer *portal*, which is not part of the documented
 * public API and can change without notice. It is isolated here on purpose —
 * if it breaks, set COC_API_TOKEN to a static key and point the worker at a
 * fixed-IP host, and nothing else in the codebase changes.
 */

const PORTAL = 'https://developer.clashofclans.com/api';

/** Keys we create are named with this prefix so we only ever revoke our own. */
const KEY_PREFIX = 'villagelab-auto';

export interface RotationResult {
  token: string;
  ip: string;
}

/**
 * The 403 body tells us which IP the request actually came from, e.g.
 * "Invalid authorization: API key does not allow access from IP 1.2.3.4".
 * Parsing it avoids depending on a third-party IP-echo service.
 */
export function extractIp(message: string | undefined): string | null {
  if (!message) return null;
  const m = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(message);
  return m ? m[1] : null;
}

async function portal(path: string, init: RequestInit, cookie?: string) {
  const res = await fetch(PORTAL + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Developer portal ${path} failed (${res.status}): ${JSON.stringify(body).slice(0, 200)}`);
  }
  return { body, setCookie: res.headers.get('set-cookie') ?? '' };
}

/**
 * Log in, revoke our previous auto-created keys, and mint one for `ip`.
 * Returns the new token.
 */
export async function rotateKey(ip: string): Promise<RotationResult> {
  const email = process.env.COC_DEV_EMAIL;
  const password = process.env.COC_DEV_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'Key rotation needs COC_DEV_EMAIL and COC_DEV_PASSWORD (your developer.clashofclans.com login).',
    );
  }

  const login = await portal('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const cookie = login.setCookie.split(';')[0];
  if (!cookie) throw new Error('Developer portal login returned no session cookie');

  const list = await portal('/apikey/list', { method: 'POST', body: '{}' }, cookie);
  const keys: Array<{ id: string; name: string; cidrRanges?: string[] }> =
    (list.body as { keys?: [] }).keys ?? [];

  // Revoke only keys we created, and only those not already covering this IP.
  const ours = keys.filter((k) => k.name?.startsWith(KEY_PREFIX));
  const alreadyValid = ours.find((k) => k.cidrRanges?.includes(ip));
  if (alreadyValid) {
    // Someone else already rotated for this IP (concurrent worker); reuse it.
    const revealed = await portal('/apikey/list', { method: 'POST', body: '{}' }, cookie);
    const match = ((revealed.body as { keys?: Array<{ id: string; key: string }> }).keys ?? [])
      .find((k) => k.id === alreadyValid.id);
    if (match?.key) return { token: match.key, ip };
  }

  for (const k of ours) {
    await portal('/apikey/revoke', { method: 'POST', body: JSON.stringify({ id: k.id }) }, cookie);
  }

  const created = await portal('/apikey/create', {
    method: 'POST',
    body: JSON.stringify({
      name: `${KEY_PREFIX}-${Date.now().toString(36)}`,
      description: 'Auto-rotated by VillageLab ingestion worker',
      cidrRanges: [ip],
      scopes: ['clash'],
    }),
  }, cookie);

  const token = (created.body as { key?: { key?: string } }).key?.key;
  if (!token) throw new Error('Developer portal did not return a key');
  return { token, ip };
}
