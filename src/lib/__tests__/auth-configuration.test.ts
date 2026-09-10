import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as appleAuth } from '@/app/api/apple/auth/route';
import { POST as googleAuth } from '@/app/api/auth/route';
import { encrypt, decrypt } from '@/lib/encryption';

afterEach(() => vi.unstubAllEnvs());
describe('store session configuration', () => {
  it.each([['Apple', appleAuth], ['Google', googleAuth]] as const)('%s reports missing production encryption before processing credentials', async (_, handler) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENCRYPTION_KEY', '');
    const request = new NextRequest('http://localhost/api/auth', {method:'POST', body:'{}'});
    const response = await handler(request);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('ENCRYPTION_KEY');
    expect(request.bodyUsed).toBe(false);
  });
  it('round-trips a session with a configured key', async () => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-only-session-secret-not-for-deployment');
    const value = JSON.stringify({example:'synthetic credentials'});
    const encrypted = await encrypt(value);
    expect(encrypted).not.toContain('synthetic');
    expect(await decrypt(encrypted)).toBe(value);
  });
});
