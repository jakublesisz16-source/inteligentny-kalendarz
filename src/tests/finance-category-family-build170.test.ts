import { describe, expect, it } from 'vitest';
import type { ExpenseCategory, ExpenseProduct } from '../shopping/expenses.types';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

const categories: ExpenseCategory[] = [
  ['food', 'Jedzenie'], ['drinks', 'Napoje'], ['home', 'Dom / Chemia'], ['hygiene', 'Higiena / Kosmetyki'],
  ['health', 'Zdrowie'], ['clothes', 'Ubrania'], ['electronics', 'Elektronika'], ['transport', 'Transport'],
  ['entertainment', 'Rozrywka'], ['deposit', 'Kaucja / opakowania zwrotne'], ['other', 'Inne'], ['pet', 'Zwierzęta'],
  ['custom', 'Moja ręczna'], ['custom2', 'Druga ręczna'],
].map(([id, name], sortOrder) => ({ id: id!, name: name!, sortOrder, createdAt: '', updatedAt: '' }));

function product(originalName: string, categoryId: string, name = originalName): ExpenseProduct {
  return {
    id: `product-${categoryId}-${originalName}`,
    name,
    originalName,
    normalizedKey: originalName.toLocaleLowerCase('pl-PL'),
    categoryId,
    createdAt: '',
    updatedAt: '',
  };
}

describe('Build170 product-family category learning', () => {
  it.each([
    ['TabietkiDoZmywarki30szt', 'home'],
    ['WorkiNaSmiecl35l', 'home'],
    ['PaplerToaletowy8rolek', 'home'],
  ])('tolerates a single OCR error inside a long compact signal: %s', (name, expected) => {
    expect(suggestCategoryId(name, [], categories)).toBe(expected);
  });

  it('does not create a false water match across normal token boundaries', () => {
    expect(suggestCategoryId('PrzewodAudioPro1m', [], categories)).toBe('other');
  });

  it('treats package size and packaging as product-family noise', () => {
    const learned = product('NapEnerDziki0,5lPus', 'custom', 'NapEner Dziki puszka');
    expect(suggestCategoryId('NapEnerDziki500mlPuszka', [], categories, [learned])).toBe('custom');
  });

  it('matches common receipt abbreviations inside the same learned family', () => {
    const learned = product('Mle bez lakt 2% 1l', 'custom', 'Mleko bez laktozy');
    expect(suggestCategoryId('MleBezLakt3,2%500ml', [], categories, [learned])).toBe('custom');
  });

  it('does not transfer a custom family category across a different brand token', () => {
    const learned = product('Mleko Łaciate 2% 1l', 'custom', 'Mleko Łaciate');
    expect(suggestCategoryId('MlekoMlekovita2%1l', [], categories, [learned])).toBe('food');
  });

  it('does not let an approximate default-category exemplar override a conflicting semantic rule', () => {
    const learned = product('Olej Kujawski 1l', 'home', 'Olej Kujawski');
    expect(suggestCategoryId('OlejKujawski500ml', [], categories, [learned])).toBe('food');
  });

  it('can bridge a high-confidence default family when built-in semantics are silent', () => {
    const learned = product('PrzewodAudioPro2m', 'electronics', 'Przewód Audio Pro');
    expect(suggestCategoryId('PrzewodAudioPro1m', [], categories, [learned])).toBe('electronics');
  });

  it('fails closed when two learned categories are equally plausible for the same family', () => {
    const learned = [
      product('NapEnerDziki0,5lPus', 'custom', 'NapEner Dziki puszka'),
      product('NapEnerDziki0,5lPusz', 'custom2', 'NapEner Dziki pusz'),
    ];
    expect(suggestCategoryId('NapEnerDziki500mlPuszka', [], categories, learned)).toBe('drinks');
  });
});
