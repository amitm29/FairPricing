import { cookies } from 'next/headers';
import { getSessionCredentials } from '@/lib/google-play/client';
import type { ServiceAccountCredentials } from '@/lib/google-play/types';
const SESSION_COOKIE = 'gplay_session';
const PACKAGE_NAME_COOKIE = 'gplay_package_name';

export async function getAuthFromCookies(): Promise<{
  credentials: ServiceAccountCredentials;
  packageName: string;
} | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const packageName = cookieStore.get(PACKAGE_NAME_COOKIE)?.value;

  if (!sessionId || !packageName) {
    return null;
  }

  const credentials = await getSessionCredentials(sessionId);
  if (!credentials) {
    return null;
  }

  return { credentials, packageName };
}
