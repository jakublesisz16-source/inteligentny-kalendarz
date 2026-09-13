import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../core/sha256';

describe('1.2.0.53 SHA-256 fallback', () => {
  it('hashes correctly when WebCrypto subtle is unavailable on an insecure LAN origin', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
      expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    }
  });
});
