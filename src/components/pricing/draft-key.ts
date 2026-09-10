/** App identifiers are public package/bundle IDs. Never include credential material. */
export function pricingDraftKey(platform: 'google' | 'apple', appId: string, kind: 'product' | 'subscription', productId: string, basePlanId?: string): string {
  return JSON.stringify([platform, appId, kind, productId, basePlanId ?? null]);
}
