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
  const prefixed = /\b(aleja|aleje|ul\.?|al\.?|plac|pl\.?)\s*([\p{L}0-9 .'-]*?\p{L}[\p{L} .'-]*\s+\d+[a-zA-Z]?(?:\/\d+)?)(?=\s*[,;|]|\s*[-–—]\s*|\s*\*+|\s*$)/iu.exec(compact);
  if (prefixed?.[2]) {
    const prefix = canonicalStreetPrefix(prefixed[1]);
    const body = compactWhitespace(prefixed[2]);
    return `${prefix} ${body}`.trim();
  }

  // Bez prefiksu akceptujemy wyłącznie samodzielny, ulicopodobny fragment z nazwą i numerem.
  if (!/\b(grupa|sala|klinika|godz|seminari|praktyk|cwicze|ćwicze|wyklad|wykład|\d{1,2}[.:]\d{2}|\d+\s*g\b)/i.test(compact)) {
    const bare = /^([\p{L}][\p{L} .'-]{2,}\s+\d+[a-fA-F]?(?:\/\d+)?)$/u.exec(compact);
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

  if (!result.label) {
    const institutionMatches = [...compact.matchAll(/\b(Zakład|Katedra(?:\s+i\s+Zakład)?|Klinika)\s+([\p{L}][\p{L} .'-]{2,}?)(?=\s*\(|\s*[,;|]|\s+-\s+|\s*$)/giu)];
    if (institutionMatches.length === 1) {
      const label = compactWhitespace(`${institutionMatches[0]?.[1] ?? ''} ${institutionMatches[0]?.[2] ?? ''}`);
      if (label.length >= 8) result.label = label;
    }
  }

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

function footerMatchTokens(text: string): Set<string> {
  const stopwords = new Set([
    'prof', 'profesor', 'dr', 'hab', 'mgr', 'lek', 'med', 'pan', 'pani',
    'grupa', 'grupy', 'osobowe', 'godz', 'godzina', 'godziny', 'sala', 'sale',
    'zajecia', 'praktyczne', 'praktyki', 'seminaria', 'seminarium', 'cwiczenia', 'cwiczenie', 'wyklady', 'wyklad',
    'ul', 'aleja', 'plac', 'warszawa', 'katedra', 'klinika', 'zaklad', 'oddzial',
  ]);
  const tokens = foldPolishText(text)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token))
    .filter((token) => !/^\d+(?:g|godz)?$/.test(token));
  const canonical = tokens.map((token) => {
    // Stemy tylko dla nazw przedmiotów, gdzie skróty są częste i znaczenie jest stabilne.
    // Nie skracamy dowolnych słów do 4 liter - "Banaszkiewicz" kolidowałoby wtedy z "Banacha",
    // a "Pietrzak" z "piętro".
    if (/^rehab/.test(token)) return 'rehab';
    if (/^promoc/.test(token) || token === 'prom') return 'prom';
    if (/^pediatr/.test(token)) return 'pediatr';
    if (/^chirurg/.test(token)) return 'chirurg';
    if (/^intern/.test(token)) return 'intern';
    if (/^farmak/.test(token)) return 'farmak';
    // Krótkie nazwiska odmieniane a/y (Mucha/Muchy) oraz formy typu Stec/Steca.
    if (token.length === 5 && /[ay]$/.test(token)) return token.slice(0, 4);
    return token;
  });
  // "Podst." jest zbyt ogólne do wiązania lokalizacji.
  return new Set(canonical.filter((token) => token !== 'podst'));
}

export function findUnambiguousFooterHint(subject: string, hints: FooterLocationHint[]): FooterLocationHint | undefined {
  const subjectTokens = footerMatchTokens(subject);
  if (!subjectTokens.size) return undefined;

  const matches: Array<{ hint: FooterLocationHint; score: number; shared: number; identity: string }> = [];
  for (const hint of hints) {
    const hintTokens = footerMatchTokens(hint.key);
    if (!hintTokens.size) continue;
    const shared = [...subjectTokens].filter((token) => hintTokens.has(token)).length;
    const score = shared / Math.min(subjectTokens.size, hintTokens.size);
    const requiredShared = subjectTokens.size >= 2 ? 2 : 1;
    if (shared < requiredShared || score < 0.34) continue;
    const identity = [hint.address ?? '', hint.label ?? '', hint.room ?? ''].join('|');
    if (!identity.replace(/\|/g, '')) continue;
    matches.push({ hint, score, shared, identity });
  }
  if (!matches.length) return undefined;

  // Fallback po samym przedmiocie jest dozwolony tylko wtedy, gdy wszystkie
  // wiarygodne trafienia wskazują dokładnie tę samą lokalizację. Przedmiot
  // realizowany w kilku szpitalach ma pozostać nierozstrzygnięty bez nazwiska.
  const identities = new Set(matches.map((match) => match.identity));
  if (identities.size !== 1) return undefined;
  return matches.sort((a, b) => b.score - a.score || b.shared - a.shared)[0]?.hint;
}

export function findBestFooterHint(subject: string, hints: FooterLocationHint[]): FooterLocationHint | undefined {
  const subjectTokens = footerMatchTokens(subject);
  if (!subjectTokens.size) return undefined;

  let best: { hint: FooterLocationHint; score: number; shared: number } | undefined;
  let tied = false;
  for (const hint of hints) {
    const hintTokens = footerMatchTokens(hint.key);
    if (!hintTokens.size) continue;
    const shared = [...subjectTokens].filter((token) => hintTokens.has(token)).length;
    const score = shared / Math.min(subjectTokens.size, hintTokens.size);
    const requiredShared = subjectTokens.size >= 2 ? 2 : 1;
    if (shared < requiredShared || score < 0.34) continue;
    if (!best || score > best.score || (score === best.score && shared > best.shared)) {
      best = { hint, score, shared };
      tied = false;
      continue;
    }
    if (best && score === best.score && shared === best.shared && hint.key !== best.hint.key) {
      const bestIdentity = [best.hint.address ?? '', best.hint.label ?? '', best.hint.room ?? ''].join('|');
      const hintIdentity = [hint.address ?? '', hint.label ?? '', hint.room ?? ''].join('|');
      if (bestIdentity !== hintIdentity) tied = true;
    }
  }
  // Przy remisie nie zgadujemy lokalizacji. Lepszy brak danych niż zły szpital w kalendarzu.
  return tied ? undefined : best?.hint;
}
