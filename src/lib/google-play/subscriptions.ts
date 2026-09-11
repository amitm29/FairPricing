import { googlePlayFetch } from './client';
import type {
  ServiceAccountCredentials,
  Subscription,
  BasePlan,
  RegionalBasePlanConfig,
  Money,
  RegionsVersion,
} from './types';

interface GoogleApiSubscription extends Subscription {
  regionsVersion?: RegionsVersion;
}

interface SubscriptionListResponse {
  subscriptions?: GoogleApiSubscription[];
  nextPageToken?: string;
}

interface SubscriptionUpdateRequestBody {
  packageName: string;
  productId: string;
  basePlans?: BasePlan[];
}

/**
 * Get the latest available regions version for Google Play pricing.
 * Required for subscription price updates. Format: YYYY/MM.
 */
export function getLatestRegionsVersion(): string {
  return '2025/03';
}

export async function listSubscriptions(
  credentials: ServiceAccountCredentials,
  packageName: string
): Promise<Subscription[]> {
  const subscriptions: Subscription[] = [];
  let pageToken: string | undefined;

  do {
    const response = await googlePlayFetch<SubscriptionListResponse>(
      credentials,
      `/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/subscriptions`,
      {
        query: {
          pageSize: 100,
          pageToken,
        },
      }
    );

    if (response.subscriptions) {
      subscriptions.push(...response.subscriptions);
    }

    pageToken = response.nextPageToken ?? undefined;
  } while (pageToken);

  return subscriptions;
}

export async function getSubscription(
  credentials: ServiceAccountCredentials,
  packageName: string,
  productId: string
): Promise<Subscription | null> {
  try {
    const subscription = await googlePlayFetch<GoogleApiSubscription>(
      credentials,
      `/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/subscriptions/${encodeURIComponent(productId)}`
    );

    if (subscription.regionsVersion) {
      console.log(`Subscription ${productId} regionsVersion:`, subscription.regionsVersion);
    } else {
      console.warn(`Subscription ${productId} has no regionsVersion in API response`);
    }

    return subscription;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

export async function getBasePlan(
  credentials: ServiceAccountCredentials,
  packageName: string,
  productId: string,
  basePlanId: string
): Promise<BasePlan | null> {
  const subscription = await getSubscription(credentials, packageName, productId);
  if (!subscription) {
    return null;
  }
  return subscription.basePlans?.find(bp => bp.basePlanId === basePlanId) || null;
}

/**
 * Merge a set of priced regions into a base plan's existing configs.
 *
 * Regions in `updates` are set and made available to new subscribers, since
 * the developer is deliberately pricing them. Every other existing region is
 * kept exactly as it is — including one closed to new subscribers. Regions
 * absent from both stay absent: a region that was never part of the plan is
 * not added on the developer's behalf. Google Play accepts a plan that does
 * not cover every region, so nothing here needs to be filled in.
 */
export function mergeRegionalConfigs(
  existing: RegionalBasePlanConfig[],
  updates: RegionalBasePlanConfig[]
): RegionalBasePlanConfig[] {
  const merged = new Map<string, RegionalBasePlanConfig>();
  for (const config of existing) merged.set(config.regionCode, config);
  for (const config of updates) merged.set(config.regionCode, { ...config, newSubscriberAvailability: true });
  return Array.from(merged.values());
}

/** Remove one region from a base plan's configs. Nothing is added in its place. */
export function removeRegionalConfig(
  existing: RegionalBasePlanConfig[],
  regionCode: string
): RegionalBasePlanConfig[] {
  return existing.filter((config) => config.regionCode !== regionCode);
}

export async function updateBasePlanPrices(
  credentials: ServiceAccountCredentials,
  packageName: string,
  productId: string,
  basePlanId: string,
  regionalConfigs: RegionalBasePlanConfig[]
): Promise<BasePlan> {
  const subscription = await getSubscription(credentials, packageName, productId);
  if (!subscription) {
    throw new Error(`Subscription ${productId} not found`);
  }

  const basePlan = subscription.basePlans?.find(bp => bp.basePlanId === basePlanId);
  if (!basePlan) {
    throw new Error(`Base plan ${basePlanId} not found in subscription ${productId}`);
  }

  const updatedConfigs = mergeRegionalConfigs(basePlan.regionalConfigs || [], regionalConfigs);

  const updatedBasePlans = subscription.basePlans?.map(bp => {
    if (bp.basePlanId === basePlanId) {
      return {
        ...bp,
        regionalConfigs: updatedConfigs,
      };
    }
    return bp;
  });

  const regionsVersionString = subscription.regionsVersion?.version || getLatestRegionsVersion();

  const requestBody: SubscriptionUpdateRequestBody = {
    packageName,
    productId,
    basePlans: updatedBasePlans,
  };

  const response = await googlePlayFetch<GoogleApiSubscription>(
    credentials,
    `/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/subscriptions/${encodeURIComponent(productId)}`,
    {
      method: 'PATCH',
      query: {
        'regionsVersion.version': regionsVersionString,
        updateMask: 'basePlans',
      },
      body: requestBody,
    }
  );

  return response.basePlans?.find(bp => bp.basePlanId === basePlanId) || basePlan;
}

export async function deleteBasePlanRegionPrice(
  credentials: ServiceAccountCredentials,
  packageName: string,
  productId: string,
  basePlanId: string,
  regionCode: string
): Promise<BasePlan> {
  const subscription = await getSubscription(credentials, packageName, productId);
  if (!subscription) {
    throw new Error(`Subscription ${productId} not found`);
  }

  const basePlan = subscription.basePlans?.find(bp => bp.basePlanId === basePlanId);
  if (!basePlan) {
    throw new Error(`Base plan ${basePlanId} not found`);
  }

  const updatedConfigs = removeRegionalConfig(basePlan.regionalConfigs || [], regionCode);

  const updatedBasePlans = subscription.basePlans?.map(bp => {
    if (bp.basePlanId === basePlanId) {
      return {
        ...bp,
        regionalConfigs: updatedConfigs,
      };
    }
    return bp;
  });

  const regionsVersionString = subscription.regionsVersion?.version || getLatestRegionsVersion();

  const deleteRequestBody: SubscriptionUpdateRequestBody = {
    packageName,
    productId,
    basePlans: updatedBasePlans,
  };

  const response = await googlePlayFetch<GoogleApiSubscription>(
    credentials,
    `/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/subscriptions/${encodeURIComponent(productId)}`,
    {
      method: 'PATCH',
      query: {
        'regionsVersion.version': regionsVersionString,
        updateMask: 'basePlans',
      },
      body: deleteRequestBody,
    }
  );

  return response.basePlans?.find(bp => bp.basePlanId === basePlanId) || basePlan;
}

export function calculateNewBasePlanPrice(
  currentConfig: RegionalBasePlanConfig,
  operation: { type: 'fixed' | 'percentage' | 'round'; value?: number; roundTo?: number }
): RegionalBasePlanConfig {
  const parsedUnits = parseFloat(currentConfig.price.units);
  if (isNaN(parsedUnits) || !Number.isFinite(parsedUnits)) {
    throw new Error(`Invalid price units value: "${currentConfig.price.units}"`);
  }
  const currentAmount = parsedUnits +
    (currentConfig.price.nanos ? currentConfig.price.nanos / 1_000_000_000 : 0);

  let newAmount: number;

  switch (operation.type) {
    case 'fixed':
      newAmount = operation.value ?? currentAmount;
      break;
    case 'percentage':
      newAmount = currentAmount * (1 + (operation.value ?? 0) / 100);
      break;
    case 'round':
      const roundTo = operation.roundTo ?? 0.99;
      newAmount = Math.floor(currentAmount) + roundTo;
      break;
    default:
      newAmount = currentAmount;
  }

  newAmount = Math.max(0, newAmount);

  let units = Math.floor(newAmount);
  let nanos = Math.round((newAmount - units) * 1_000_000_000);

  if (nanos > 999_999_999) {
    units += Math.floor(nanos / 1_000_000_000);
    nanos = nanos % 1_000_000_000;
  }

  const newPrice: Money = {
    currencyCode: currentConfig.price.currencyCode,
    units: units.toString(),
    nanos: nanos > 0 ? nanos : undefined,
  };

  return {
    ...currentConfig,
    price: newPrice,
  };
}
