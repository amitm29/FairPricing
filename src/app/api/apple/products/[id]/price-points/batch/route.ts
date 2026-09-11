import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppleAuthFromCookies } from '../../../../auth/session';
import {
  getInAppPurchase,
  getInAppPurchasePricePointsForTerritory,
  AppleApiError,
} from '@/lib/apple-connect';
import { validateAndDecodeAppleProductId, ValidationError } from '@/lib/validation';
import { executeWithRateLimit, RateLimitError } from '@/lib/utils/rate-limit';
import { createNdjsonStream, NDJSON_HEADERS } from '@/lib/utils/ndjson-stream';

const batchSchema = z.object({
  territories: z.record(
    z.string(),
    z.object({
      targetPrice: z.number().positive(),
      maxPrice: z.number().positive().finite().optional(),
      currency: z.string().min(1),
    })
  ),
});

// POST /api/apple/products/[id]/price-points/batch
//
// Resolves the closest live App Store Connect price point for each territory.
// Unlike the write path's cached fast path, this asks Apple for the current
// ladder in every territory, so the prices it returns are the ones a customer
// would actually be charged — which is what a review step has to show.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAppleAuthFromCookies();
    if (!auth) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;
    let productId: string;
    try {
      productId = validateAndDecodeAppleProductId(id);
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
      }
      throw error;
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const result = batchSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body', details: result.error.issues }, { status: 400 });
    }

    const entries = Object.entries(result.data.territories);
    if (entries.length === 0) {
      return NextResponse.json({ error: 'No territories provided' }, { status: 400 });
    }

    const product = await getInAppPurchase(auth.credentials, productId);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const { stream, writer } = createNdjsonStream();
    const credentials = auth.credentials;
    const inAppPurchaseId = product.id;

    (async () => {
      try {
        const resolved: Record<string, { pricePointId: string; tierPrice: number }> = {};
        const skipped: string[] = [];

        const tasks = entries.map(([territoryCode, { targetPrice, maxPrice }]) => async () => {
          const pricePoints = await getInAppPurchasePricePointsForTerritory(credentials, inAppPurchaseId, territoryCode);
          return {
            territoryCode,
            targetPrice,
            pricePoints: pricePoints.filter((p) => Number(p.customerPrice) <= (maxPrice ?? Infinity)),
          };
        });

        const results = await executeWithRateLimit(tasks, {
          concurrency: 3,
          delayBetweenBatches: 300,
          maxRetries: 3,
          retryDelay: 2000,
          onProgress: (completed, total) => writer.progress(completed, total, 'resolve'),
        });

        for (const { territoryCode, targetPrice, pricePoints } of results) {
          if (!pricePoints || pricePoints.length === 0) {
            skipped.push(territoryCode);
            continue;
          }
          const closest = pricePoints.reduce((best, pp) =>
            Math.abs(parseFloat(pp.customerPrice) - targetPrice) < Math.abs(parseFloat(best.customerPrice) - targetPrice) ? pp : best
          );
          resolved[territoryCode] = { pricePointId: closest.id, tierPrice: parseFloat(closest.customerPrice) };
        }

        writer.done({ resolved, skipped });
      } catch (error) {
        console.error('Error resolving product price points:', error);
        if (error instanceof RateLimitError) {
          writer.error(
            `Failed to resolve price points: ${error.successCount} of ${error.totalCount} territories succeeded before failure`,
            error.successCount,
            error.totalCount
          );
        } else if (error instanceof AppleApiError) {
          writer.error(error.detail || 'Failed to resolve price points');
        } else {
          writer.error('Failed to resolve price points');
        }
      }
    })();

    return new Response(stream, { headers: NDJSON_HEADERS });
  } catch (error) {
    console.error('Error in product batch price points:', error);
    if (error instanceof AppleApiError) {
      return NextResponse.json({ error: error.detail || 'Failed to resolve price points' }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Failed to resolve price points' }, { status: 500 });
  }
}
