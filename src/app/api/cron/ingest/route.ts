import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runIngestion, type RunResult } from '@/lib/ingest/worker';

/**
 * Ingestion trigger, called on a schedule by GitHub Actions.
 *
 * Protected by a shared secret rather than left open: this route is the only
 * thing that spends our upstream rate-limit budget, so an unauthenticated
 * caller could drain it.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization') ?? '';
  if (!matches(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  const started = Date.now();
  const result = await runIngestion({ limit });

  return NextResponse.json({ ...result, ms: Date.now() - started }, { status: statusFor(result) });
}

/**
 * The cron job treats any non-200 as a failure, so anything that means "data is
 * silently going stale" has to be one. A misconfigured worker returning 200
 * with an error in the body would leave the schedule green forever.
 */
function statusFor(result: RunResult): number {
  if (!result.ran) return 503;                    // configuration fault
  if (result.rateLimited) return 429;             // backing off, not succeeding
  // One bad tag is normal. Every job failing is an outage — a revoked token, a
  // dead database — and must not read as a healthy run.
  if (result.processed > 0 && result.ok === 0 && result.notFound === 0) return 500;
  return 200;
}

/**
 * Constant-time comparison. Hashing first sidesteps `timingSafeEqual`'s
 * requirement that both buffers be the same length — comparing lengths
 * directly would leak the secret's length before the first byte is checked.
 */
function matches(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
