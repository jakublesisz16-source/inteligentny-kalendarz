import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const temp = mkdtempSync(join(tmpdir(), 'ik-finance-category-'));
const compileArgs = [
  'src/shopping/expenses.types.ts',
  'src/shopping/expenses.utils.ts',
  'src/shopping/receipt-ocr/receipt-ocr.types.ts',
  'src/shopping/receipt-ocr/category-suggestions.ts',
  '--target', 'ES2022',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--skipLibCheck',
  '--outDir', temp,
  '--rootDir', 'src',
  '--pretty', 'false',
];

try {
  const compile = spawnSync('tsc', compileArgs, { cwd: process.cwd(), encoding: 'utf8' });
  if (compile.status !== 0) {
    process.stderr.write(compile.stdout || '');
    process.stderr.write(compile.stderr || '');
    throw new Error(`targeted TypeScript compile failed (${compile.status ?? 'no-exit'})`);
  }
  writeFileSync(join(temp, 'package.json'), '{"type":"commonjs"}\n');
  const require = createRequire(import.meta.url);
  const { suggestCategoryId } = require(join(temp, 'shopping/receipt-ocr/category-suggestions.js'));

  const names = [
    ['food', 'Jedzenie'], ['drinks', 'Napoje'], ['home', 'Dom / Chemia'], ['hygiene', 'Higiena / Kosmetyki'],
    ['health', 'Zdrowie'], ['clothes', 'Ubrania'], ['electronics', 'Elektronika'], ['transport', 'Transport'],
    ['entertainment', 'Rozrywka'], ['deposit', 'Kaucja / opakowania zwrotne'], ['other', 'Inne'], ['pet', 'Zwierzęta'],
    ['custom', 'Moja ręczna'], ['custom2', 'Druga ręczna'],
  ];
  const categories = names.map(([id, name], sortOrder) => ({ id, name, sortOrder, createdAt: '', updatedAt: '' }));
  const cases = [
    ['JajaWWybL10szt', 'food'], ['M1EKO2%1l', 'food'], ['W0DAgaz1,5l', 'drinks'], ['Mle bez lakt2 1I', 'food'], ['FrytSteFrAviko750g', 'food'], ['LoDiuDuoWan-Tru120ml', 'food'],
    ['NapGazHellCze1,25I', 'drinks'], ['WorkiNaSmieci35l', 'home'], ['TabletkiDoZmywarki30szt', 'home'],
    ['ZelPodPrysznic500ml', 'hygiene'], ['Płyn do płukania ust', 'hygiene'], ['Płyn do płukania tkanin', 'home'], ['Chusteczki nawilżane', 'hygiene'], ['SzczoteczkaDoZebow', 'hygiene'], ['KabelUSB-C2m', 'electronics'],
    ['LadowarkaUSB-C20W', 'electronics'], ['BiletZTMulg20min', 'transport'], ['BenzynaPb95', 'transport'],
    ['BiletKino2D', 'entertainment'], ['GraPlanszowa', 'entertainment'], ['KarmaPiesPedigree500g', 'pet'], ['KarmaPedigree500g', 'pet'], ['ZwirekDlaKota5l', 'pet'], ['ZwirekBentonitowy5l', 'pet'],
    ['Papierosy Marlboro', 'other'], ['SzamponSamochodowyAktywny', 'transport'], ['OlejSilnikowy5W30', 'transport'], ['Lodówka turystyczna', 'other'], ['Serwetki papierowe', 'home'],
    ['Tabletki do zmywarki', 'home'], ['Krem czekoladowy', 'food'],
    ['TabietkiDoZmywarki30szt', 'home'], ['WorkiNaSmiecl35l', 'home'], ['PaplerToaletowy8rolek', 'home'],
    ['Sól do zmywarki 1kg', 'home'], ['SolDoZmywarki2kg', 'home'], ['Masło do ciała kakaowe', 'hygiene'], ['MasloDoCiala250ml', 'hygiene'],
    ['Woda kolońska 100ml', 'hygiene'], ['WodaToaletowa50ml', 'hygiene'], ['Woda micelarna 400ml', 'hygiene'],
    ['Sól fizjologiczna 0,9%', 'health'], ['SolFizjologiczna10x5ml', 'health'], ['Woda utleniona 3%', 'health'], ['Płyn do soczewek 360ml', 'health'],
    ['Olej silnikowy 5W30 1l', 'transport'], ['OlejPrzekladniowy75W90', 'transport'], ['Płyn hamulcowy DOT4', 'transport'], ['PlynChlodniczy5l', 'transport'],
    ['Papier ścierny P120', 'home'], ['Pasta do butów czarna', 'home'], ['Mleczko do czyszczenia Cif', 'home'], ['Woda do żelazka 1l', 'home'],
    ['Gąbka do kąpieli', 'hygiene'], ['Kabel do ładowania USB-C', 'electronics'],
    ['Sól do kąpieli', 'hygiene'], ['Woda perfumowana', 'hygiene'], ['Woda demineralizowana', 'home'], ['Woda destylowana', 'home'], ['Woda do akumulatora', 'transport'],
    ['Pasta jajeczna', 'food'], ['Pasta termoprzewodząca', 'electronics'], ['Tabletki do WC', 'home'], ['Żel do WC', 'home'], ['Płyn do prania', 'home'],
    ['Płyn do kąpieli', 'hygiene'], ['Żel do mycia twarzy', 'hygiene'], ['Żel energetyczny', 'food'], ['Krem do golenia', 'hygiene'], ['Krem do butów', 'home'],
    ['Olej do włosów', 'hygiene'], ['Olejek do ciała', 'hygiene'], ['Spray do szyb', 'home'], ['Spray do nosa', 'health'], ['Krople do oczu', 'health'],
    ['Mleczko kokosowe', 'food'], ['Mleczko do ciała', 'hygiene'], ['Puder do twarzy', 'hygiene'], ['Papier śniadaniowy', 'home'], ['Folia spożywcza', 'home'],
    ['Folia ochronna do telefonu', 'electronics'], ['Bateria AA', 'electronics'], ['Akumulator samochodowy', 'transport'], ['Przewód hamulcowy', 'transport'],
    ['WODAKOLONSKA100ML', 'hygiene'], ['SOLD0ZMYWARKI1KG', 'home'], ['MASLOD0CIALA250ML', 'hygiene'], ['WODAUTLENIONA3%', 'health'],
    ['OLEJSILNIKOWY5W30', 'transport'], ['PLYNHAMULCOWYDOT4', 'transport'], ['PAPIERSCIERNYP120', 'home'], ['KABELDOLADOWANIAUSBC', 'electronics'],
    ['WODADEMINERALIZOWANA1L', 'home'], ['PASTATERMOPRZEWODZACA5G', 'electronics'], ['FOLIAOCHRONNADOTELEFONU', 'electronics'],
  ];

  const legacyCases = [
    ['chleb żytni', 'food'], ['woda gazowana', 'drinks'], ['szampon', 'hygiene'], ['ibuprofen', 'health'], ['płyn do naczyń', 'home'], ['nieznany przedmiot', 'other'],
    ['FrytZigźag900g', 'food'], ['NapEnerDziki0,5lPus', 'drinks'], ['RożekMarlWiśnia150ml', 'food'], ['SokMandarynRivPet1l', 'drinks'], ['WodaNgPrimavera1l', 'drinks'],
    ['PastaColgateWhite', 'hygiene'], ['Ręcznik Milla X2', 'home'], ['Banan luz', 'food'], ['Arbuz luz', 'food'],
    ['OBUWIE DAMSKIE', 'clothes'], ['buty sportowe', 'clothes'], ['sandały', 'clothes'], ['kurtka zimowa', 'clothes'],
    ['mleko świeże', 'food'], ['pesto zielone', 'food'], ['czekolada mleczna', 'food'], ['napój gazowany', 'drinks'], ['kawa mielona', 'drinks'],
    ['dezodorant', 'hygiene'], ['detergent do domu', 'home'], ['opatrunek', 'health'], ['termometr', 'health'], ['butelka kaucja', 'deposit'],
    ['Polaris NGaz 1,5l', 'drinks'], ['NapGaz Test 1,25l', 'drinks'], ['Mle bez lakt 2 1l', 'food'], ['Fil Z Piersi K kg', 'food'],
    ['FilKurChoB Anty kg', 'food'], ['Olej Kujawski 1l', 'food'], ['Śliwka Domowa Luz', 'food'], ['CzekOrzechMix100g', 'food'],
  ];

  const failures = [];
  for (const [name, expected] of [...legacyCases, ...cases]) {
    const actual = suggestCategoryId(name, [], categories);
    if (actual !== expected) failures.push(`${name}: ${actual} != ${expected}`);
  }

  const learned = {
    id: 'product-1', name: 'NapEner Dziki puszka', originalName: 'NapEnerDziki0,5lPus', normalizedKey: 'napenerdziki0 5lpus',
    categoryId: 'custom', createdAt: '', updatedAt: '',
  };
  if (suggestCategoryId('NapEnerDziki0,5lPusz', [], categories, [learned]) !== 'custom') failures.push('near-identical learned variant did not reuse manual category');
  if (suggestCategoryId('NapEnerMonster0,5lPus', [], categories, [learned]) !== 'drinks') failures.push('materially different product incorrectly reused manual category');

  if (suggestCategoryId('NapEnerDziki500mlPuszka', [], categories, [learned]) !== 'custom') failures.push('package-size variation did not stay in the learned product family');

  const learnedMilk = {
    id: 'product-milk', name: 'Mleko bez laktozy', originalName: 'Mle bez lakt 2% 1l', normalizedKey: 'mle bez lakt 2 1l',
    categoryId: 'custom', createdAt: '', updatedAt: '',
  };
  if (suggestCategoryId('MleBezLakt3,2%500ml', [], categories, [learnedMilk]) !== 'custom') failures.push('abbreviated milk package variant did not reuse learned family category');

  const learnedBrand = {
    id: 'product-brand', name: 'Mleko Łaciate', originalName: 'Mleko Łaciate 2% 1l', normalizedKey: 'mleko laciate 2 1l',
    categoryId: 'custom', createdAt: '', updatedAt: '',
  };
  if (suggestCategoryId('MlekoMlekovita2%1l', [], categories, [learnedBrand]) !== 'food') failures.push('different milk brand incorrectly inherited custom learned family category');

  const wrongDefault = {
    id: 'product-wrong-default', name: 'Olej Kujawski', originalName: 'Olej Kujawski 1l', normalizedKey: 'olej kujawski 1l',
    categoryId: 'home', createdAt: '', updatedAt: '',
  };
  if (suggestCategoryId('OlejKujawski500ml', [], categories, [wrongDefault]) !== 'food') failures.push('approximate default learned category overrode a conflicting built-in signal');

  { const actual = suggestCategoryId('PrzewodAudioPro1m', [], categories, []); if (actual !== 'other') failures.push(`unknown cable baseline unexpectedly classified as ${actual}`); }

  const learnedCable = {
    id: 'product-cable', name: 'Przewód Audio Pro', originalName: 'PrzewodAudioPro2m', normalizedKey: 'przewodaudiopro2m',
    categoryId: 'electronics', createdAt: '', updatedAt: '',
  };
  { const actual = suggestCategoryId('PrzewodAudioPro1m', [], categories, [learnedCable]); if (actual !== 'electronics') failures.push(`high-confidence default product family did not bridge an otherwise unknown variant (${actual})`); }

  const ambiguousFamily = [
    { ...learned, id: 'family-a', categoryId: 'custom' },
    { ...learned, id: 'family-b', categoryId: 'custom2', name: 'NapEner Dziki pusz', originalName: 'NapEnerDziki0,5lPusz' },
  ];
  if (suggestCategoryId('NapEnerDziki500mlPuszka', [], categories, ambiguousFamily) !== 'drinks') failures.push('ambiguous learned families did not fail closed to the built-in category');

  const history = [{
    id: 'r1', merchant: 'Test', date: '2026-09-20', totalMinor: 100, createdAt: '', updatedAt: '2026-09-20T10:00:00Z',
    items: [{ id: 'i1', name: 'NapEnerDziki0,5lPusz', categoryId: 'drinks', amountMinor: 100 }],
  }];
  if (suggestCategoryId('NapEnerDziki0,5lPusz', history, categories, [learned]) !== 'drinks') failures.push('exact history did not outrank approximate learned match');

  const renamed = categories.map((category) => category.id === 'electronics'
    ? { ...category, id: 'expense-category-electronics', name: 'Sprzęt' }
    : category);
  if (suggestCategoryId('KabelUSB-C2m', [], renamed) !== 'expense-category-electronics') failures.push('stable default category id was not recognized after rename');

  const ordinaryMeanings = [
    ['Sól morska 1kg', 'food'], ['Masło ekstra 200g', 'food'], ['Woda gazowana 1,5l', 'drinks'],
    ['Olej Kujawski 1l', 'food'], ['Gąbka kuchenna', 'home'], ['Pasta pomidorowa', 'food'],
    ['Olej do smażenia', 'food'], ['Krople czekoladowe', 'food'], ['Puder cukierniczy', 'food'],
    ['Bateria kuchenna', 'other'], ['Papier fotograficzny', 'other'], ['Papier do drukarki', 'other'],
  ];
  for (const [name, expected] of ordinaryMeanings) {
    const actual = suggestCategoryId(name, [], categories);
    if (actual !== expected) failures.push(`ordinary meaning ${name}: ${actual} != ${expected}`);
  }

  if (failures.length) {
    console.error(`Finance category robustness proof failed (${failures.length}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Finance category robustness proof PASS (${legacyCases.length + cases.length + ordinaryMeanings.length + 10}/${legacyCases.length + cases.length + ordinaryMeanings.length + 10})`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
