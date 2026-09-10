import { cookies } from 'next/headers';
import { getAppleSessionCredentials } from '@/lib/apple-connect/client';
import type { AppleConnectCredentials } from '@/lib/apple-connect/types';
const SESSION_COOKIE = 'apple_session';
const BUNDLE_ID_COOKIE = 'apple_bundle_id';

export async function getAppleAuthFromCookies(): Promise<{
  credentials: AppleConnectCredentials;
  bundleId: string;
} | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const bundleId = cookieStore.get(BUNDLE_ID_COOKIE)?.value;

  if (!sessionId || !bundleId) {
    return null;
  }

  const sessionCredentials = await getAppleSessionCredentials(sessionId);
  if (!sessionCredentials) {
    return null;
  }

  const credentials: AppleConnectCredentials = {
    ...sessionCredentials,
    bundleId,
  };

  return { credentials, bundleId };
}
