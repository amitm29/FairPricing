import { NextResponse } from 'next/server';
import { getAppleAuthFromCookies } from '../../../../auth/session';
import { getInAppPurchase, getInAppPurchasePricePointsForTerritory } from '@/lib/apple-connect';
import { createLadderHandler } from '@/lib/apple-connect/ladder-route';
import { validateAndDecodeAppleProductId, ValidationError } from '@/lib/validation';

// POST /api/apple/products/[id]/price-points/ladder  { mode: 'probe' | 'full' }
export const POST = createLadderHandler({
  kind: 'iap',
  getAuth: getAppleAuthFromCookies,
  locate: async (credentials, routeId) => {
    let productId: string;
    try {
      productId = validateAndDecodeAppleProductId(routeId);
    } catch (error) {
      if (error instanceof ValidationError) return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
      throw error;
    }
    const product = await getInAppPurchase(credentials, productId);
    return product ? { appleId: product.id, label: productId } : null;
  },
  fetchPointsFor: (appleId) => (credentials, territory) => getInAppPurchasePricePointsForTerritory(credentials, appleId, territory),
});
