const WEEKDAY_ALIASES: Record<string, string> = {
  poniedzialek: 'PONIEDZIAŁEK',
  wtorek: 'WTOREK',
  sroda: 'ŚRODA',
  czwartek: 'CZWARTEK',
  piatek: 'PIĄTEK',
  sobota: 'SOBOTA',
  niedziela: 'NIEDZIELA',
};

const CLINIC_ROMAN: Record<string, string> = {
  '1': 'I', I: 'I',
  '2': 'II', II: 'II',
  '3': 'III', III: 'III',
  '4': 'IV', IV: 'IV',
  '5': 'V', V: 'V',
  '6': 'VI', VI: 'VI',
};

export function foldPolishText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Łł]/g, 'l')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeWeekdayLabel(text: string): string | undefined {
  const folded = foldPolishText(text).replace(/[^a-z]/g, '');
  return WEEKDAY_ALIASES[folded];
}

export function normalizeClinicLabel(text: string): string | undefined {
  const compact = compactWhitespace(text);
  const match = /\bklin(?:ika|\.)?\s*(?:nr\s*)?(I{1,3}|IV|V|VI|[1-6])\b/i.exec(compact);
  const token = match?.[1]?.toUpperCase();
  if (!token) return undefined;
  const roman = CLINIC_ROMAN[token];
  return roman ? `Klinika ${roman}` : undefined;
}

export function normalizeSemanticText(text: string | undefined): string {
  return foldPolishText(text ?? '')
    .replace(/\bul\.?\s+/g, '')
    .replace(/\balej(?:a|e)\s+/g, 'al ')
    .replace(/\bal\.?\s+/g, 'al ')
    .replace(/\bplac\s+/g, 'pl ')
    .replace(/\bpl\.?\s+/g, 'pl ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
