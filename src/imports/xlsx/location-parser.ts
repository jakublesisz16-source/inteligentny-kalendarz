import { compactWhitespace, foldPolishText, normalizeSemanticText } from './parser-normalization';

export interface LocationParseResult {
  room?: string;
  address?: string;
  label?: string;
}

export interface FooterLocationHint extends LocationParseResult {
  key: string;
  rawText: string;
}

function canonicalStreetPrefix(prefix: string | undefined): string {
  const folded = foldPolishText(prefix ?? '');
  if (/^ul/.test(folded)) return 'ul.';
  if (/^al/.test(folded)) return 'al.';
  if (/^(plac|pl)/.test(folded)) return 'pl.';
  return '';
}

export function normalizeLocationIdentity(text: string): string {
  return normalizeSemanticText(text)
    .replace(/^(ul|al|pl)\s+/, '')
    .trim();
}

function parseAddress(compact: string): string | undefined {
  const prefixed = /\b(ul\.?|al\.?|aleja|aleje|plac|pl\.?)\s+([\p{L}0-9 .'-]*?\p{L}[\p{L} .'-]*\s+\d+[a-zA-Z]?(?:\/\d+)?)(?=\s*[,;|]|\s*$)/iu.exec(compact);
  if (prefixed?.[2]) {
    const prefix = canonicalStreetPrefix(prefixed[1]);
    const body = compactWhitespace(prefixed[2]);
    return `${prefix} ${body}`.trim();
  }

  // Bez prefiksu akceptujemy wyłącznie samodzielny, ulicopodobny fragment z nazwą i numerem.
  if (!/\b(grupa|sala|klinika|godz|\d{1,2}[.:]\d{2})\b/i.test(compact)) {
    const bare = /^([\p{L}][\p{L} .'-]{2,}\s+\d+[a-zA-Z]?(?:\/\d+)?)$/u.exec(compact);
    if (bare?.[1]) return compactWhitespace(bare[1]);
  }
  return undefined;
}

export function parseLocationText(text: string): LocationParseResult {
  const compact = compactWhitespace(text);
  const result: LocationParseResult = {};

  const roomMatch = /\b(sala(?:\s+nr)?|sale|sala\s+seminaryjna)\s*([^,;|]*?)(?=\s*[,;|]\s*(?:ul\.?|al\.?|aleja|plac|pl\.?)\b|\s*$)/i.exec(compact);
  if (roomMatch?.[1] && roomMatch[2]) {
    const room = `${roomMatch[1]} ${roomMatch[2]}`.replace(/\s+/g, ' ').trim();
    if (room.length > 4) result.room = room;
  }

  const address = parseAddress(compact);
  if (address) result.address = address;

  const campusMatch = /\bKampus\s+[A-ZĄĆĘŁŃÓŚŹŻ][\p{L}0-9 -]+?(?=\s*[,;|]|\s*$)/u.exec(compact);
  if (campusMatch) result.label = compactWhitespace(campusMatch[0]);
  const hospitalMatch = /\bSzpital\s+[A-ZĄĆĘŁŃÓŚŹŻ][\p{L}0-9 -]+?(?=\s*[,;|]|\s*$)/u.exec(compact);
  if (hospitalMatch) result.label = compactWhitespace(hospitalMatch[0]);
  if (!result.label && /\bCBI\b/i.test(compact)) result.label = 'CBI';
  if (!result.label && /\bCSM\b/i.test(compact)) result.label = 'CSM';

  return result;
}

export function normalizeSubjectKey(text: string): string {
  return foldPolishText(text)
    .replace(/\b(cwiczenia|cwiczenie|seminaria|seminarium|zajecia|praktyczne|praktyki|wyklady|wyklad|laboratorium|lab)\b/g, ' ')
    .replace(/\b(nza|nzm|nzn|nzw|nzt|nzr|nzi|nzj|nzb|nzme|nzzp|\d+[a-z]\d+)\b/g, ' ')
    .replace(/\b\d+\s*g\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findBestFooterHint(subject: string, hints: FooterLocationHint[]): FooterLocationHint | undefined {
  const subjectTokens = new Set(normalizeSubjectKey(subject).split(' ').filter((token) => token.length > 2));
  if (!subjectTokens.size) return undefined;

  let best: { hint: FooterLocationHint; score: number; shared: number } | undefined;
  for (const hint of hints) {
    const hintTokens = new Set(normalizeSubjectKey(hint.key).split(' ').filter((token) => token.length > 2));
    if (!hintTokens.size) continue;
    const shared = [...subjectTokens].filter((token) => hintTokens.has(token)).length;
    const score = shared / Math.min(subjectTokens.size, hintTokens.size);
    if (shared >= 1 && score >= 0.5 && (!best || score > best.score || (score === best.score && shared > best.shared))) {
      best = { hint, score, shared };
    }
  }
  return best?.hint;
}
