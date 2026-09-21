import { describe, expect, it } from 'vitest';
import type { ExpenseCategory } from '../shopping/expenses.types';
import { suggestCategoryId } from '../shopping/receipt-ocr/category-suggestions';

const categoryPairs = [
  ['food', 'Jedzenie'], ['drinks', 'Napoje'], ['home', 'Dom / Chemia'], ['hygiene', 'Higiena / Kosmetyki'],
  ['health', 'Zdrowie'], ['clothes', 'Ubrania'], ['electronics', 'Elektronika'], ['transport', 'Transport'],
  ['entertainment', 'Rozrywka'], ['deposit', 'Kaucja / opakowania zwrotne'], ['other', 'Inne'], ['pet', 'Zwierzęta'],
] as const;

const categories: ExpenseCategory[] = categoryPairs.map(([id, name], sortOrder) => ({
  id, name, sortOrder, createdAt: '', updatedAt: '',
}));

const contextualCases: Array<[string, string]> = [
  ['Sól do zmywarki 1kg', 'home'], ['SolDoZmywarki2kg', 'home'], ['Sól do kąpieli', 'hygiene'],
  ['Masło do ciała kakaowe', 'hygiene'], ['MasloDoCiala250ml', 'hygiene'], ['Woda kolońska 100ml', 'hygiene'],
  ['WodaToaletowa50ml', 'hygiene'], ['Woda micelarna 400ml', 'hygiene'], ['Woda perfumowana', 'hygiene'],
  ['Sól fizjologiczna 0,9%', 'health'], ['SolFizjologiczna10x5ml', 'health'], ['Woda utleniona 3%', 'health'],
  ['Płyn do soczewek 360ml', 'health'], ['Spray do nosa', 'health'], ['Krople do oczu', 'health'],
  ['Olej silnikowy 5W30 1l', 'transport'], ['OlejPrzekladniowy75W90', 'transport'], ['Płyn hamulcowy DOT4', 'transport'],
  ['PlynChlodniczy5l', 'transport'], ['Woda do akumulatora', 'transport'], ['Akumulator samochodowy', 'transport'],
  ['Przewód hamulcowy', 'transport'], ['Papier ścierny P120', 'home'], ['Pasta do butów czarna', 'home'],
  ['Krem do butów', 'home'], ['Mleczko do czyszczenia Cif', 'home'], ['Woda do żelazka 1l', 'home'],
  ['Woda demineralizowana', 'home'], ['Woda destylowana', 'home'], ['Tabletki do WC', 'home'], ['Żel do WC', 'home'],
  ['Płyn do prania', 'home'], ['Spray do szyb', 'home'], ['Papier śniadaniowy', 'home'], ['Folia spożywcza', 'home'],
  ['Gąbka do kąpieli', 'hygiene'], ['Płyn do kąpieli', 'hygiene'], ['Żel do mycia twarzy', 'hygiene'],
  ['Krem do golenia', 'hygiene'], ['Olej do włosów', 'hygiene'], ['Olejek do ciała', 'hygiene'], ['Mleczko do ciała', 'hygiene'],
  ['Puder do twarzy', 'hygiene'], ['Pasta jajeczna', 'food'], ['Żel energetyczny', 'food'], ['Mleczko kokosowe', 'food'],
  ['Kabel do ładowania USB-C', 'electronics'], ['Pasta termoprzewodząca', 'electronics'], ['Folia ochronna do telefonu', 'electronics'],
  ['Bateria AA', 'electronics'],
  ['WODAKOLONSKA100ML', 'hygiene'], ['SOLD0ZMYWARKI1KG', 'home'], ['MASLOD0CIALA250ML', 'hygiene'],
  ['WODAUTLENIONA3%', 'health'], ['OLEJSILNIKOWY5W30', 'transport'], ['PLYNHAMULCOWYDOT4', 'transport'],
  ['PAPIERSCIERNYP120', 'home'], ['KABELDOLADOWANIAUSBC', 'electronics'], ['WODADEMINERALIZOWANA1L', 'home'],
  ['PASTATERMOPRZEWODZACA5G', 'electronics'], ['FOLIAOCHRONNADOTELEFONU', 'electronics'],
];

describe('Build171 contextual category disambiguation', () => {
  it.each(contextualCases)('%s -> %s', (name, expected) => {
    expect(suggestCategoryId(name, [], categories)).toBe(expected);
  });

  it('keeps the ordinary meanings when no disambiguating context is present', () => {
    expect(suggestCategoryId('Sól morska 1kg', [], categories)).toBe('food');
    expect(suggestCategoryId('Masło ekstra 200g', [], categories)).toBe('food');
    expect(suggestCategoryId('Woda gazowana 1,5l', [], categories)).toBe('drinks');
    expect(suggestCategoryId('Olej Kujawski 1l', [], categories)).toBe('food');
    expect(suggestCategoryId('Gąbka kuchenna', [], categories)).toBe('home');
    expect(suggestCategoryId('Pasta pomidorowa', [], categories)).toBe('food');
    expect(suggestCategoryId('Olej do smażenia', [], categories)).toBe('food');
    expect(suggestCategoryId('Krople czekoladowe', [], categories)).toBe('food');
    expect(suggestCategoryId('Puder cukierniczy', [], categories)).toBe('food');
    expect(suggestCategoryId('Bateria kuchenna', [], categories)).toBe('other');
    expect(suggestCategoryId('Papier fotograficzny', [], categories)).toBe('other');
    expect(suggestCategoryId('Papier do drukarki', [], categories)).toBe('other');
  });
});
