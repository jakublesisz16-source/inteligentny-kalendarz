import { compactWhitespace, foldPolishText, normalizeClinicLabel } from './parser-normalization';

export interface NormalizedGroupResult {
  groups: string[];
  clinic?: string;
  originalText: string;
}

export type StudyGroupKind = 'MAIN' | 'G12' | 'G8' | 'G4' | 'GENERIC';

interface ParsedStudyGroupKey {
  encoded: boolean;
  kind: StudyGroupKind;
  label: string;
  number?: number;
  letter?: string;
  subgroup?: number;
}

const GROUP_KEY_RE = /^(MAIN|G12|G8|G4|GENERIC):(\d{1,2}(?:[A-Z](?:[12])?)?)$/;
const GROUP_LABEL_RE = /^(\d{1,2})([A-Z]?)([12]?)$/;

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function parsePlainGroupLabel(label: string): Omit<ParsedStudyGroupKey, 'encoded' | 'kind' | 'label'> {
  const match = GROUP_LABEL_RE.exec(label.toUpperCase());
  if (!match) return {};
  const numberToken = match[1];
  const letter = match[2];
  const subgroupToken = match[3];
  return {
    ...(numberToken ? { number: Number(numberToken) } : {}),
    ...(letter ? { letter } : {}),
    ...(subgroupToken ? { subgroup: Number(subgroupToken) } : {}),
  };
}

export function parseStudyGroupKey(value: string): ParsedStudyGroupKey {
  const normalized = value.trim().toUpperCase();
  const encoded = GROUP_KEY_RE.exec(normalized);
  if (encoded?.[1] && encoded[2]) {
    return {
      encoded: true,
      kind: encoded[1] as StudyGroupKind,
      label: encoded[2],
      ...parsePlainGroupLabel(encoded[2]),
    };
  }
  return {
    encoded: false,
    kind: 'GENERIC',
    label: normalized,
    ...parsePlainGroupLabel(normalized),
  };
}

export function studyGroupKey(kind: StudyGroupKind, label: string): string {
  const normalized = label.trim().toUpperCase();
  return `${kind}:${normalized}`;
}

export function studyGroupPlainLabel(group: string): string {
  return parseStudyGroupKey(group).label;
}

export function studyGroupDisplayLabel(group: string): string {
  const parsed = parseStudyGroupKey(group);
  if (!parsed.encoded) return parsed.label;
  switch (parsed.kind) {
    case 'MAIN': return `${parsed.label} - grupa główna`;
    case 'G12': return `${parsed.label} - grupa 12-os.`;
    case 'G8': return `${parsed.label} - grupa 8-os.`;
    case 'G4': return `${parsed.label} - grupa 4-os.`;
    default: return parsed.label;
  }
}

export function studyGroupCompactLabel(group: string): string {
  const parsed = parseStudyGroupKey(group);
  if (!parsed.encoded) return parsed.label;
  switch (parsed.kind) {
    case 'MAIN': return `${parsed.label} · główna`;
    case 'G12': return `${parsed.label} · 12-os.`;
    case 'G8': return `${parsed.label} · 8-os.`;
    case 'G4': return `${parsed.label} · 4-os.`;
    default: return parsed.label;
  }
}

export function formatStudyGroupList(groups: string[]): string {
  return groups.map(studyGroupDisplayLabel).join(', ');
}

export function inferStudyGroupKind(headerText: string, plainGroup: string): StudyGroupKind {
  const parsed = parsePlainGroupLabel(plainGroup);
  if (parsed.number && !parsed.letter) return 'MAIN';
  if (parsed.subgroup) return 'G4';

  const folded = foldPolishText(headerText);
  if (/\b12\s*[- ]?\s*osob/.test(folded)) return 'G12';
  if (/\b8\s*[- ]?\s*osob/.test(folded)) return 'G8';
  if (/\b4\s*[- ]?\s*osob/.test(folded)) return 'G4';
  return 'GENERIC';
}

export function sortStudyGroups(groups: string[]): string[] {
  const kindOrder: Record<StudyGroupKind, number> = { MAIN: 0, G12: 1, G8: 2, G4: 3, GENERIC: 4 };
  return [...groups].sort((left, right) => {
    const a = parseStudyGroupKey(left);
    const b = parseStudyGroupKey(right);
    const numberDifference = (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER);
    if (numberDifference !== 0) return numberDifference;
    const kindDifference = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDifference !== 0) return kindDifference;
    const letterDifference = (a.letter ?? '').localeCompare(b.letter ?? '', 'pl');
    if (letterDifference !== 0) return letterDifference;
    const subgroupDifference = (a.subgroup ?? 0) - (b.subgroup ?? 0);
    if (subgroupDifference !== 0) return subgroupDifference;
    return a.label.localeCompare(b.label, 'pl');
  });
}

function hasExplicitGroupContext(text: string): boolean {
  return /\bgrupa\b|\bgr(?:\.|\b)\s*(?:nr\b)?/i.test(text);
}

function removeGroupPrefix(text: string): string {
  return text
    .replace(/^.*?\bgrupa\b\s*(?:nr\s*)?/i, '')
    .replace(/^.*?\bgr\.?\s*(?:nr\s*)?/i, '')
    .trim();
}

function looksLikeBareGroupExpression(body: string): boolean {
  const value = body.toUpperCase().trim();
  if (/^(?:\d{1,2}|\d{1,2}\s*[A-Z](?:\s*[12])?)$/.test(value)) return true;
  if (/^\d{1,2}\s+[A-Z](?:\s*(?:[,;/+]|\bI\b)?\s*[A-Z]){1,3}$/.test(value)) return true;
  if (/^\d{1,2}\s*[A-Z](?:\s+\d{1,2}\s*[A-Z])+$/.test(value)) return true;
  return /^\d{1,2}\s*[A-Z](?:\s*(?:[,;/+]|\bI\b)\s*\d{1,2}\s*[A-Z])+$/.test(value);
}

function extractGroups(body: string, allowNumberOnly: boolean): string[] {
  const groups: string[] = [];

  // Pełne oznaczenia, np. 13A, 13 A, 13A1, 13A/13B. Litery A-Z są dozwolone w jednoznacznym kontekście grupy.
  for (const match of body.matchAll(/(?<!\d)(\d{1,2})\s*([A-Z])\s*([12])?\b/g)) {
    const numberToken = match[1];
    const letter = match[2];
    const subgroup = match[3];
    if (numberToken && letter) groups.push(`${Number(numberToken)}${letter}${subgroup ?? ''}`);
  }

  // Skrócona lista liter po jednym numerze, np. 13 a b, c.
  const listMatch = /(?<!\d)(\d{1,2})\s+([A-Z](?:\s*(?:[,;/+]|\bI\b)?\s*[A-Z]){1,3})\b/.exec(body);
  if (listMatch?.[1] && listMatch[2]) {
    for (const letter of listMatch[2].match(/[A-Z]/g) ?? []) {
      if (letter === 'I') continue; // polski spójnik w skrócie typu '13 D i E'
      groups.push(`${Number(listMatch[1])}${letter}`);
    }
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

function encodedGroupMatches(candidate: ParsedStudyGroupKey, selected: ParsedStudyGroupKey): boolean {
  if (candidate.kind === selected.kind && candidate.label === selected.label) return true;
  if (!candidate.number || !selected.number || candidate.number !== selected.number) return false;

  // Zajęcia całej grupy głównej dotyczą każdej podgrupy o tym samym numerze.
  if (candidate.kind === 'MAIN') return true;

  // Grupa 4-osobowa jest jednoznacznie częścią odpowiadającej jej grupy 8-osobowej.
  if (candidate.kind === 'G8' && selected.kind === 'G4') {
    return Boolean(candidate.letter && candidate.letter === selected.letter);
  }

  // Podział 12-osobowy przecina podział 8-osobowy, więc nie wolno go wyprowadzać z litery.
  return false;
}

export function groupSetsIntersect(candidateGroups: string[], selectedGroups: string[]): boolean {
  const candidates = candidateGroups.map(parseStudyGroupKey);
  const selected = selectedGroups.map(parseStudyGroupKey);

  return candidates.some((candidate) => selected.some((choice) => {
    if (candidate.encoded && choice.encoded) return encodedGroupMatches(candidate, choice);
    if (!candidate.encoded && !choice.encoded) return candidate.label === choice.label;

    // Migracja starych profili: numery główne i grupy 4-osobowe są jednoznaczne.
    // Oznaczenie typu 13A jest celowo NIE mapowane automatycznie, bo może znaczyć grupę 8- albo 12-osobową.
    const legacy = candidate.encoded ? choice : candidate;
    const encoded = candidate.encoded ? candidate : choice;
    if (!legacy.number || !encoded.number || legacy.number !== encoded.number) return false;
    if (!legacy.letter && encoded.kind === 'MAIN') return true;
    if (legacy.subgroup && encoded.kind === 'G4') return legacy.label === encoded.label;
    return false;
  }));
}
