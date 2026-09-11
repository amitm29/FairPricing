import { getAppleAuthFromCookies } from '../../../../auth/session';
import { getSubscriptionPricePoints } from '@/lib/apple-connect';
import { createLadderHandler } from '@/lib/apple-connect/ladder-route';

// POST /api/apple/subscriptions/[id]/price-points/ladder  { mode: 'probe' | 'full' }
export const POST = createLadderHandler({
  kind: 'subscription',
  getAuth: getAppleAuthFromCookies,
  locate: async (_credentials, routeId) => ({ appleId: routeId, label: routeId }),
  fetchPointsFor: (appleId) => (credentials, territory) => getSubscriptionPricePoints(credentials, appleId, territory),
});
