import { compactWhitespace, normalizeClinicLabel } from './parser-normalization';

export interface NormalizedGroupResult {
  groups: string[];
  clinic?: string;
  originalText: string;
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

export function sortStudyGroups(groups: string[]): string[] {
  return [...groups].sort((left, right) => {
    const a = /^(\d+)([A-Z]?)$/.exec(left);
    const b = /^(\d+)([A-Z]?)$/.exec(right);
    if (!a || !b) return left.localeCompare(right, 'pl');
    const numberDifference = Number(a[1] ?? 0) - Number(b[1] ?? 0);
    if (numberDifference !== 0) return numberDifference;
    return (a[2] ?? '').localeCompare(b[2] ?? '');
  });
}

function hasExplicitGroupContext(text: string): boolean {
  return /\bgrupa\b|\bgr\.?\s*(?:nr\b)?/i.test(text);
}

function removeGroupPrefix(text: string): string {
  return text
    .replace(/^.*?\bgrupa\b\s*(?:nr\s*)?/i, '')
    .replace(/^.*?\bgr\.?\s*(?:nr\s*)?/i, '')
    .trim();
}

function looksLikeBareGroupExpression(body: string): boolean {
  const value = body.toUpperCase().trim();
  if (/^\d{1,2}\s*[ABC]?$/.test(value)) return true;
  if (/^\d{1,2}\s+[ABC](?:\s*(?:[,;/+]|\bI\b)?\s*[ABC]){1,3}$/.test(value)) return true;
  if (/^\d{1,2}\s*[ABC](?:\s+\d{1,2}\s*[ABC])+$/.test(value)) return true;
  return /^\d{1,2}\s*[ABC](?:\s*(?:[,;/+]|\bI\b)\s*\d{1,2}\s*[ABC])+$/.test(value);
}

function extractGroups(body: string, allowNumberOnly: boolean): string[] {
  const groups: string[] = [];

  // Pełne oznaczenia, np. 13A, 13 A, 13A/13B. Celowo tylko A-C.
  for (const match of body.matchAll(/(?<!\d)(\d{1,2})\s*([ABC])\b/g)) {
    const numberToken = match[1];
    const letter = match[2];
    if (numberToken && letter) groups.push(`${Number(numberToken)}${letter}`);
  }

  // Skrócona lista liter po jednym numerze, np. 13 a b, c.
  const listMatch = /(?<!\d)(\d{1,2})\s+([ABC](?:\s*(?:[,;/+]|\bI\b)?\s*[ABC]){1,3})\b/.exec(body);
  if (listMatch?.[1] && listMatch[2]) {
    for (const letter of listMatch[2].match(/[ABC]/g) ?? []) groups.push(`${Number(listMatch[1])}${letter}`);
  }

  if (!groups.length && allowNumberOnly) {
    const numberMatch = /(?<!\d)(\d{1,2})(?!\d)/.exec(body);
    if (numberMatch?.[1]) {
      const number = Number(numberMatch[1]);
      if (number >= 1 && number <= 99) groups.push(String(number));
    }
  }

  return groups;
}

export function normalizeGroupText(text: string, allowBare = false): NormalizedGroupResult {
  const originalText = text;
  const normalizedSpacing = compactWhitespace(text);
  const clinic = normalizeClinicLabel(normalizedSpacing);
  const explicitContext = hasExplicitGroupContext(normalizedSpacing);

  let body = explicitContext ? removeGroupPrefix(normalizedSpacing) : normalizedSpacing;
  body = body.replace(/\bklin(?:ika|\.)?\s*(?:nr\s*)?(?:I{1,3}|IV|V|VI|[1-6])\b.*$/i, '').trim();
  if (explicitContext) body = body.split(/\b(?:sala|sale|ul\.?|al\.?|aleja|aleje|plac|pl\.?)\b/i)[0] ?? body;
  body = body.replace(/\s*\/\s*\d{1,2}[.:]\d{2}\s*[-–—]\s*\d{1,2}[.:]\d{2}.*$/i, '').trim();
  body = body.toUpperCase();

  const permitted = explicitContext || (allowBare && looksLikeBareGroupExpression(body));
  const groups = permitted ? extractGroups(body, explicitContext || /^\s*\d{1,2}\s*$/.test(body)) : [];

  return {
    groups: sortStudyGroups(unique(groups)),
    ...(clinic ? { clinic } : {}),
    originalText,
  };
}

export function groupSetsIntersect(candidateGroups: string[], selectedGroups: string[]): boolean {
  const selected = new Set(selectedGroups.map((group) => group.toUpperCase()));
  return candidateGroups.some((group) => selected.has(group.toUpperCase()));
}
