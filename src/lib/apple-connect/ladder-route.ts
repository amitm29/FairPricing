import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { AppleConnectCredentials } from './types';
import { AppleApiError } from './client';
import { fetchLadder, probeSource, type PointsFetcher } from './ladder-server';
import type { LadderKind } from './tier-ladder';
import { RateLimitError } from '@/lib/utils/rate-limit';
import { createNdjsonStream, NDJSON_HEADERS } from '@/lib/utils/ndjson-stream';

const bodySchema = z.object({
  mode: z.enum(['probe', 'full']),
  territory: z.string().min(2).max(3).optional(),
});

/**
 * One handler body for both kinds. `probe` is a single call and answers as
 * JSON; `full` walks every territory and streams progress.
 */
export function createLadderHandler(options: {
  kind: LadderKind;
  getAuth: () => Promise<{ credentials: AppleConnectCredentials } | null>;
  /** Turn the route param into the Apple id the fetcher needs; null → 404. */
  locate: (credentials: AppleConnectCredentials, routeId: string) => Promise<{ appleId: string; label: string } | null | Response>;
  fetchPointsFor: (appleId: string) => PointsFetcher;
}) {
  return async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
      const auth = await options.getAuth();
      if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

      const { id } = await params;
      let body;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
      }
      const parsed = bodySchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });

      const located = await options.locate(auth.credentials, id);
      if (located instanceof Response) return located;
      if (!located) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const fetchPoints = options.fetchPointsFor(located.appleId);

      if (parsed.data.mode === 'probe') {
        const probe = await probeSource(auth.credentials, fetchPoints, parsed.data.territory ?? 'USA');
        return NextResponse.json(probe);
      }

      const { stream, writer } = createNdjsonStream();
      (async () => {
        try {
          const result = await fetchLadder(auth.credentials, fetchPoints, options.kind, located.label, (completed, total) =>
            writer.progress(completed, total, 'ladder')
          );
          writer.done(result);
        } catch (error) {
          console.error(`Error fetching ${options.kind} tier ladder:`, error);
          if (error instanceof RateLimitError) {
            writer.error(`Failed to fetch tiers: ${error.successCount} of ${error.totalCount} territories succeeded before failure`, error.successCount, error.totalCount);
          } else if (error instanceof AppleApiError) {
            writer.error(error.detail || 'Failed to fetch tiers');
          } else {
            writer.error('Failed to fetch tiers');
          }
        }
      })();
      return new Response(stream, { headers: NDJSON_HEADERS });
    } catch (error) {
      console.error(`Error in ${options.kind} tier ladder route:`, error);
      if (error instanceof AppleApiError) return NextResponse.json({ error: error.detail || 'Failed to fetch tiers' }, { status: error.statusCode });
      return NextResponse.json({ error: 'Failed to fetch tiers' }, { status: 500 });
    }
  };
}
