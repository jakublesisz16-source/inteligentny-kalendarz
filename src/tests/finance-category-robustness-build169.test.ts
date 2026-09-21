import { describe, expect, it } from 'vitest';
import type { ExpenseCategory, ExpenseProduct, Receipt } from '../shopping/expenses.types';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

const categories: ExpenseCategory[] = [
  ['food', 'Jedzenie'], ['drinks', 'Napoje'], ['home', 'Dom / Chemia'], ['hygiene', 'Higiena / Kosmetyki'],
  ['health', 'Zdrowie'], ['clothes', 'Ubrania'], ['electronics', 'Elektronika'], ['transport', 'Transport'],
  ['entertainment', 'Rozrywka'], ['deposit', 'Kaucja / opakowania zwrotne'], ['other', 'Inne'], ['pet', 'Zwierzęta'],
  ['custom', 'Moja ręczna'],
].map(([id, name], sortOrder) => ({ id: id!, name: name!, sortOrder, createdAt: '', updatedAt: '' }));

function receipt(name: string, categoryId: string): Receipt {
  return {
    id: 'history', merchant: 'Test', date: '2026-09-20', totalMinor: 100,
    createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
    items: [{ id: 'item', name, categoryId, amountMinor: 100 }],
  };
}

function learnedProduct(categoryId = 'custom'): ExpenseProduct {
  return {
    id: 'product-1',
    name: 'NapEner Dziki puszka',
    originalName: 'NapEnerDziki0,5lPus',
    normalizedKey: 'napenerdziki0 5lpus',
    categoryId,
    createdAt: '',
    updatedAt: '',
  };
}

describe('Build169 robust finance category assignment', () => {
  it.each([
    ['JajaWWybL10szt', 'food'], ['M1EKO2%1l', 'food'], ['W0DAgaz1,5l', 'drinks'],
    ['Mle bez lakt2 1I', 'food'],
    ['FrytSteFrAviko750g', 'food'],
    ['LoDiuDuoWan-Tru120ml', 'food'],
    ['NapGazHellCze1,25I', 'drinks'],
    ['WorkiNaSmieci35l', 'home'],
    ['TabletkiDoZmywarki30szt', 'home'],
    ['ZelPodPrysznic500ml', 'hygiene'], ['Płyn do płukania ust', 'hygiene'], ['Płyn do płukania tkanin', 'home'], ['Chusteczki nawilżane', 'hygiene'],
    ['SzczoteczkaDoZebow', 'hygiene'],
    ['KabelUSB-C2m', 'electronics'],
    ['LadowarkaUSB-C20W', 'electronics'],
    ['BiletZTMulg20min', 'transport'],
    ['BenzynaPb95', 'transport'],
    ['BiletKino2D', 'entertainment'],
    ['GraPlanszowa', 'entertainment'],
    ['KarmaPiesPedigree500g', 'pet'],
    ['KarmaPedigree500g', 'pet'],
    ['ZwirekDlaKota5l', 'pet'],
    ['ZwirekBentonitowy5l', 'pet'],
  ])('classifies noisy receipt name %s as %s', (name, categoryId) => {
    expect(suggestCategoryId(name, [], categories)).toBe(categoryId);
  });

  it.each([
    ['Papierosy Marlboro', 'other'],
    ['SzamponSamochodowyAktywny', 'transport'],
    ['OlejSilnikowy5W30', 'transport'],
    ['Lodówka turystyczna', 'other'],
    ['Serwetki papierowe', 'home'],
    ['Tabletki do zmywarki', 'home'],
    ['Krem czekoladowy', 'food'],
  ])('avoids known false-positive traps for %s', (name, categoryId) => {
    expect(suggestCategoryId(name, [], categories)).toBe(categoryId);
  });

  it('reuses a manual learned category for a near-identical OCR variant', () => {
    expect(suggestCategoryId('NapEnerDziki0,5lPusz', [], categories, [learnedProduct()])).toBe('custom');
  });

  it('does not transfer a learned category to a materially different product', () => {
    expect(suggestCategoryId('NapEnerMonster0,5lPus', [], categories, [learnedProduct()])).toBe('drinks');
  });

  it('keeps exact history above approximate learned matching', () => {
    expect(suggestCategoryId('NapEnerDziki0,5lPusz', [receipt('NapEnerDziki0,5lPusz', 'drinks')], categories, [learnedProduct()])).toBe('drinks');
  });

  it('uses stable default category ids even after a default category is renamed', () => {
    const renamed = categories.map((category) => category.id === 'electronics'
      ? { ...category, id: 'expense-category-electronics', name: 'Sprzęt' }
      : category);
    expect(suggestCategoryId('KabelUSB-C2m', [], renamed)).toBe('expense-category-electronics');
  });
});
