export function nextJournalTimestampIso(candidateTimestamp: string, existingTimestamps: readonly string[]): string {
  const candidateMs = Date.parse(candidateTimestamp);
  if (!Number.isFinite(candidateMs)) throw new Error('Nieprawidłowy czas wpisu dziennika zmian.');

  let latestStoredMs = Number.NEGATIVE_INFINITY;
  for (const timestamp of existingTimestamps) {
    const parsed = Date.parse(timestamp);
    if (Number.isFinite(parsed) && parsed > latestStoredMs) latestStoredMs = parsed;
  }

  const finalMs = latestStoredMs >= candidateMs ? latestStoredMs + 1 : candidateMs;
  return new Date(finalMs).toISOString();
}
