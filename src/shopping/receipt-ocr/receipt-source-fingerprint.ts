export async function createReceiptSourceFingerprint(source: Blob): Promise<string | undefined> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return undefined;
  try {
    const bytes = await source.arrayBuffer();
    const digest = await subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `sha256:${hash}`;
  } catch {
    return undefined;
  }
}
