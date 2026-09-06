import type { ExpenseCategory, Receipt } from '../expenses.types';
import type { ParsedReceiptDraft } from './receipt-ocr.types';

export function normalizeReceiptProductName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL');
}

interface HistoryVote {
  count: number;
  latestKey: string;
}

function categoryByName(categories: ExpenseCategory[], names: string[]): string | undefined {
  const wanted = new Set(names.map((name) => name.toLocaleLowerCase('pl-PL')));
  return categories.find((category) => wanted.has(category.name.trim().toLocaleLowerCase('pl-PL')))?.id;
}

function builtInSuggestion(name: string, categories: ExpenseCategory[]): string | undefined {
  const normalized = normalizeReceiptProductName(name);
  const rules: Array<{ pattern: RegExp; categoryNames: string[] }> = [
    { pattern: /\b(?:kaucj|opakowani(?:e|a)\s+zwrotn)/iu, categoryNames: ['Kaucja / opakowania zwrotne', 'Kaucja', 'Opakowania zwrotne'] },
    { pattern: /\b(?:obuwie|buty?|trampk\p{L}*|sanda[łl]\p{L}*|kozak\p{L}*|kapci\p{L}*|odzie[żz]\p{L}*|koszul\p{L}*|spodni\p{L}*|bluz\p{L}*|kurtk\p{L}*|sukienk\p{L}*)\b/iu, categoryNames: ['Ubrania'] },
    { pattern: /\b(?:mle(?:ko)?|chleb|bu[łl]k\p{L}*|ser\p{L}*|jogurt\p{L}*|mas[łl]o|jaj\p{L}*|mi[ęe]so|piersi\p{L}*|makaron\p{L}*|ry[żz]\p{L}*|owoc\p{L}*|warzyw\p{L}*|[śs]liwk\p{L}*|pesto|czek\p{L}*|czekolad\p{L}*|orzech\p{L}*|orze\p{L}*)\b/iu, categoryNames: ['Jedzenie'] },
    { pattern: /\b(?:woda|sok\p{L}*|nap[óo]j\p{L}*|napgaz\p{L}*|ngaz\p{L}*|gazowan\p{L}*|niegazowan\p{L}*|cola|lemoniad\p{L}*|herbat\p{L}*|kaw\p{L}*)\b/iu, categoryNames: ['Napoje'] },
    { pattern: /\b(?:szampon\p{L}*|pasta\s+do\s+z[ęe]b\p{L}*|myd[łl]o|dezodorant\p{L}*|kosmet\p{L}*)\b/iu, categoryNames: ['Higiena / Kosmetyki'] },
    { pattern: /\b(?:ibuprofen|apap|paracetamol|lek\p{L}*|witamin\p{L}*|opatrun\p{L}*|termometr\p{L}*)\b/iu, categoryNames: ['Zdrowie'] },
    { pattern: /\b(?:p[\u0142l]yn\s+do\s+naczy[\u0144n]|proszek\s+do\s+prania|kapsu[\u0142l]k.*prani|wybielacz|detergent|papier|[śs]rodek\s+czyszcz)(?=$|[^\p{L}\p{N}_])/iu, categoryNames: ['Dom / Chemia'] },
  ];
  const match = rules.find((rule) => rule.pattern.test(normalized));
  if (match) return categoryByName(categories, match.categoryNames);

  const compactSemantic = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  if (/(?:orzech|orze|czekolad|sliwk|pesto|piersi)/u.test(compactSemantic)) {
    const food = categoryByName(categories, ['Jedzenie']);
    if (food) return food;
  }
  if (/(?:napgaz|ngaz|niegazowan|gazowan)/u.test(compactSemantic)) {
    const drinks = categoryByName(categories, ['Napoje']);
    if (drinks) return drinks;
  }

  const asciiTokens = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 5);
  const editDistanceAtMostOne = (left: string, right: string): boolean => {
    if (Math.abs(left.length - right.length) > 1) return false;
    if (left === right) return true;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) { i += 1; j += 1; continue; }
      edits += 1;
      if (edits > 1) return false;
      if (left.length > right.length) i += 1;
      else if (right.length > left.length) j += 1;
      else { i += 1; j += 1; }
    }
    return edits + (i < left.length || j < right.length ? 1 : 0) <= 1;
  };
  const fuzzy: Array<{ words: string[]; categoryNames: string[] }> = [
    { words: ['mleko', 'sliwka', 'pesto', 'orzech', 'czekolada', 'piersi'], categoryNames: ['Jedzenie'] },
    { words: ['napoj', 'woda', 'gazowana', 'niegazowana'], categoryNames: ['Napoje'] },
    { words: ['obuwie', 'sandal', 'kurtka', 'spodnie'], categoryNames: ['Ubrania'] },
    { words: ['szampon', 'dezodorant', 'kosmetyk'], categoryNames: ['Higiena / Kosmetyki'] },
    { words: ['detergent', 'proszek'], categoryNames: ['Dom / Chemia'] },
  ];
  for (const rule of fuzzy) {
    if (asciiTokens.some((token) => rule.words.some((word) => word.length >= 5 && editDistanceAtMostOne(token, word)))) {
      const category = categoryByName(categories, rule.categoryNames);
      if (category) return category;
    }
  }
  return undefined;
}

export function suggestCategoryId(
  productName: string,
  receipts: Receipt[],
  categories: ExpenseCategory[],
): string {
  const normalizedName = normalizeReceiptProductName(productName);
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const votes = new Map<string, HistoryVote>();

  for (const receipt of receipts) {
    const recencyKey = `${receipt.date}|${receipt.updatedAt}|${receipt.id}`;
    for (const item of receipt.items) {
      if (normalizeReceiptProductName(item.name) !== normalizedName || !validCategoryIds.has(item.categoryId)) continue;
      const current = votes.get(item.categoryId) ?? { count: 0, latestKey: '' };
      votes.set(item.categoryId, {
        count: current.count + 1,
        latestKey: recencyKey > current.latestKey ? recencyKey : current.latestKey,
      });
    }
  }

  const ranked = [...votes.entries()].sort(([categoryA, voteA], [categoryB, voteB]) =>
    voteB.count - voteA.count || voteB.latestKey.localeCompare(voteA.latestKey) || categoryA.localeCompare(categoryB));
  if (ranked.length) return ranked[0]![0];

  const builtIn = builtInSuggestion(productName, categories);
  if (builtIn) return builtIn;
  return categoryByName(categories, ['Inne']) ?? categories[0]?.id ?? '';
}

export function applyCategorySuggestions(
  parsed: ParsedReceiptDraft,
  receipts: Receipt[],
  categories: ExpenseCategory[],
): ParsedReceiptDraft {
  return {
    ...parsed,
    items: parsed.items.map((item) => ({
      ...item,
      suggestedCategoryId: suggestCategoryId(item.name, receipts, categories),
    })),
  };
}
