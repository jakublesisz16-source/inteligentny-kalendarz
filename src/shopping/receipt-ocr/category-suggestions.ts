import type { ExpenseCategory, ExpenseProduct, Receipt } from '../expenses.types';
import { normalizeExpenseProductKey } from '../expenses.utils';
import type { ParsedReceiptDraft } from './receipt-ocr.types';

export function normalizeReceiptProductName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL');
}

interface HistoryVote {
  count: number;
  latestKey: string;
}

type BuiltInCategoryKind = 'food' | 'drinks' | 'home' | 'hygiene' | 'health' | 'clothes' | 'electronics' | 'transport' | 'entertainment' | 'deposit' | 'pet';

const CATEGORY_IDENTITIES: Record<BuiltInCategoryKind, { ids: string[]; names: string[] }> = {
  food: { ids: ['expense-category-food'], names: ['Jedzenie'] },
  drinks: { ids: ['expense-category-drinks'], names: ['Napoje'] },
  home: { ids: ['expense-category-home'], names: ['Dom / Chemia'] },
  hygiene: { ids: ['expense-category-hygiene'], names: ['Higiena / Kosmetyki'] },
  health: { ids: ['expense-category-health'], names: ['Zdrowie'] },
  clothes: { ids: ['expense-category-clothes'], names: ['Ubrania'] },
  electronics: { ids: ['expense-category-electronics'], names: ['Elektronika'] },
  transport: { ids: ['expense-category-transport'], names: ['Transport'] },
  entertainment: { ids: ['expense-category-entertainment'], names: ['Rozrywka'] },
  deposit: { ids: ['expense-category-deposit'], names: ['Kaucja / opakowania zwrotne', 'Kaucja', 'Opakowania zwrotne'] },
  pet: { ids: ['expense-category-pet'], names: ['Zwierzęta', 'Zwierzęta / Karma'] },
};

function categoryByName(categories: ExpenseCategory[], names: string[]): string | undefined {
  const wanted = new Set(names.map((name) => name.toLocaleLowerCase('pl-PL')));
  return categories.find((category) => wanted.has(category.name.trim().toLocaleLowerCase('pl-PL')))?.id;
}

function categoryByKind(categories: ExpenseCategory[], kind: BuiltInCategoryKind): string | undefined {
  const identity = CATEGORY_IDENTITIES[kind];
  const byStableId = categories.find((category) => identity.ids.includes(category.id));
  return byStableId?.id ?? categoryByName(categories, identity.names);
}

interface CategorySignalText {
  spaced: string;
  compact: string;
  tokens: string[];
}

function categorySignalText(value: string): CategorySignalText {
  const separated = value
    .replace(/(?<=[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])0(?=[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])/gu, 'o')
    .replace(/(?<=[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])[1|](?=[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])/gu, 'l')
    .replace(/([a-ząćęłńóśźż])([A-ZĄĆĘŁŃÓŚŹŻ])/gu, '$1 $2')
    .replace(/([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])(\d)/gu, '$1 $2')
    .replace(/(\d)([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż])/gu, '$1 $2');
  const spaced = normalizeExpenseProductKey(separated);
  const compact = spaced.replace(/\s+/g, '');
  return {
    spaced,
    compact,
    tokens: spaced.split(' ').filter(Boolean),
  };
}

function editDistanceAtMostOne(left: string, right: string): boolean {
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
}

interface BuiltInSignalRule {
  kind: BuiltInCategoryKind;
  strong: RegExp[];
  compact?: string[];
  fuzzy?: string[];
  blocked?: RegExp[];
}

interface ContextualCategoryRule {
  kind: BuiltInCategoryKind;
  patterns: RegExp[];
  compact?: string[];
}

// High-precision semantic disambiguation. These phrases describe the use of the
// product, so they are stronger than a generic noun such as `woda`, `sol`,
// `maslo`, `papier` or `olej`. Keep this list about reusable contexts, not brands.
const CONTEXTUAL_CATEGORY_RULES: ContextualCategoryRule[] = [
  {
    kind: 'transport',
    patterns: [
      /\bolej\s+(?:silnik\w*|motor\w*|przeklad\w*|hydraul\w*)\b/u,
      /\bplyn\w*\s+(?:hamulc\w*|chlodnic\w*|do\s+chlodnic\w*|do\s+spryskiwacz\w*)\b/u,
      /\b(?:smar|odmrazacz)\w*\s+(?:samochod\w*|do\s+zamk\w*)?\b/u,
      /\bakumulator\w*\s+samochod\w*\b/u,
      /\bwoda\s+do\s+akumulator\w*\b/u,
      /\bprzewod\w*\s+(?:hamulc\w*|paliwow\w*)\b/u,
    ],
    compact: ['olejsilnik', 'olejmotor', 'olejprzeklad', 'olejhydraul', 'plynhamulc', 'plynchlodnic', 'plyndochlodnic', 'plyndospryskiw', 'akumulatorsamochod', 'wodadoakumulator', 'przewodhamulc', 'przewodpaliw'],
  },
  {
    kind: 'hygiene',
    patterns: [
      /\bmaslo\s+do\s+cial\w*\b/u,
      /\bwoda\s+(?:kolonsk\w*|toalet\w*|micelarn\w*|perfum\w*)\b/u,
      /\bgabka\s+(?:do\s+)?(?:kapiel\w*|cial\w*)\b/u,
      /\bsol\s+do\s+kapiel\w*\b/u,
      /\b(?:plyn|zel)\w*\s+do\s+(?:kapiel\w*|myci\w*\s+(?:twarz\w*|cial\w*))\b/u,
      /\b(?:krem|pianka)\w*\s+do\s+goleni\w*\b/u,
      /\b(?:olej|olejek)\w*\s+do\s+(?:wlos\w*|cial\w*|brod\w*)\b/u,
      /\bmleczko\s+do\s+cial\w*\b/u,
      /\bpuder\s+do\s+twarz\w*\b/u,
    ],
    compact: ['maslodocial', 'wodakolonsk', 'wodatoalet', 'wodamicelar', 'wodaperfum', 'gabkadokapiel', 'gabkadocial', 'soldokapiel', 'plyndokapiel', 'zeldokapiel', 'zeldomyciatwarz', 'zeldomyciacial', 'kremdogoleni', 'piankadogoleni', 'olejdowlos', 'olejekdowlos', 'olejdocial', 'olejekdocial', 'mleczkodocial', 'puderdotwarz'],
  },
  {
    kind: 'health',
    patterns: [
      /\bsol\s+fizjolog\w*\b/u,
      /\bwoda\s+utlenion\w*\b/u,
      /\bplyn\w*\s+do\s+soczewek\b/u,
      /\bspray\w*\s+do\s+nosa\b/u,
      /\bkropl\w*\s+do\s+(?:oczu|nosa|uszu)\b/u,
    ],
    compact: ['solfizjolog', 'wodautlenion', 'plyndosoczewek', 'spraydonosa', 'kropledooczu', 'kropledouszu', 'kropledonosa'],
  },
  {
    kind: 'home',
    patterns: [
      /\bsol\s+do\s+zmywark\w*\b/u,
      /\bpapier\s+(?:sciern\w*|sniadani\w*)\b/u,
      /\b(?:pasta|krem)\s+do\s+but\w*\b/u,
      /\bmleczko\s+do\s+(?:czyszcz\w*|kuchni|lazienk\w*)\b/u,
      /\bwoda\s+(?:destylowan\w*|demineralizowan\w*)\b/u,
      /\bwoda\s+do\s+(?:zelazk\w*|prasowani\w*)\b/u,
      /\b(?:tablet\w*|zel\w*)\s+do\s+wc\b/u,
      /\bplyn\w*\s+do\s+prani\w*\b/u,
      /\bspray\w*\s+do\s+szyb\w*\b/u,
      /\bfolia\s+spozywcz\w*\b/u,
    ],
    compact: ['soldozmywark', 'papiersciern', 'papiersniadani', 'pastadobut', 'kremdobut', 'mleczkodoczyszcz', 'wodadestylowan', 'wodademineralizowan', 'wodadozelazk', 'wodadoprasowan', 'tabletkidowc', 'zeldowc', 'plyndopran', 'spraydoszyb', 'foliaspozywcz'],
  },
  {
    kind: 'food',
    patterns: [
      /\bpasta\s+(?:jajeczn\w*|kanapkow\w*)\b/u,
      /\bzel\s+energetyczn\w*\b/u,
      /\bmleczko\s+kokosow\w*\b/u,
    ],
    compact: ['pastajajecz', 'pastakanapkow', 'zelenergetyczn', 'mleczkokokosow'],
  },
  {
    kind: 'electronics',
    patterns: [
      /\bkabel\w*\s+do\s+ladowani\w*\b/u,
      /\bpasta\s+termoprzewodz\w*\b/u,
      /\bfolia\s+(?:ochronn\w*|szklo\w*)\s+(?:do|na)\s+(?:telefon\w*|smartfon\w*|tablet\w*)\b/u,
    ],
    compact: ['kabeldoladowan', 'pastatermoprzewodz', 'foliaochronnadotelefon', 'foliaochronnanasmar', 'foliaochronnadosmartfon', 'foliaochronnanatablet', 'szklodotelefon', 'szklonasmar', 'szklonatablet'],
  },
];

const BUILT_IN_SIGNAL_RULES: BuiltInSignalRule[] = [
  {
    kind: 'deposit',
    strong: [/\b(?:kaucj\w*|opakowani\w*\s+zwrotn\w*)\b/u],
    compact: ['kaucj', 'opakowaniazwrotn', 'opakowaniezwrotn'],
  },
  {
    kind: 'transport',
    strong: [
      /\b(?:benzyn\w*|diesel|paliw\w*|autogaz|parking\w*|autostrad\w*|taks\w*|taxi|uber|bolt|adblue)\b/u,
      /\b(?:szampon\w*|wosk\w*)\s+samochod\w*\b/u,
      /\bplyn\w*\s+do\s+spryskiwacz\w*\b/u,
      /\bbilet\w*\s+(?:ztm|mpk|pkp|km|autobus\w*|tramwaj\w*|metro|kolej\w*|pociag\w*)\b/u,
      /\bolej\s+naped\w*\b/u,
    ],
    compact: ['benzynapb', 'benzpb', 'olejnaped', 'olejnap', 'biletztm', 'bilztm', 'biletmpk', 'biletpkp', 'biletautobus', 'bilettramwaj', 'plyndospryskiw', 'adblue'],
  },
  {
    kind: 'entertainment',
    strong: [
      /\b(?:kino|teatr\w*|muze\w*|koncert\w*|ksiazk\w*|komiks\w*|zabawk\w*)\b/u,
      /\b(?:gra|gry)\s+(?:plansz\w*|komputer\w*|video|wideo|konsol\w*)\b/u,
      /\bbilet\w*\s+(?:kino|teatr\w*|muze\w*|koncert\w*)\b/u,
    ],
    compact: ['graplansz', 'biletkino', 'biletteatr', 'biletkoncert'],
  },
  {
    kind: 'electronics',
    strong: [
      /\b(?:ladowark\w*|powerbank\w*|sluchawk\w*|pendriv\w*|adapter\w*|przejsciow\w*|klawiatur\w*)\b/u,
      /\bkabel\w*\s*(?:usb|hdmi|audio|lightning|ethernet|lan|type\s*c|typ\s*c)\b/u,
      /\b(?:bateria|baterie)\s+(?:aa|aaa|aaaa|alkaliczn\w*|litow\w*|cr\s*\d{3,4})\b/u,
      /\bakumulator\w*\b/u,
      /\b(?:mysz|myszka)\s+(?:komputer\w*|bezprzewod\w*)\b/u,
    ],
    compact: ['kabelusb', 'kabusb', 'kabelhdmi', 'ladowarkausb', 'ladusb', 'powerbank', 'sluchawk', 'pendrive', 'przedluzacz'],
  },
  {
    kind: 'clothes',
    strong: [/\b(?:obuwie|buty?|trampk\w*|sandal\w*|kozak\w*|kapci\w*|odziez\w*|koszul\w*|spodni\w*|bluz\w*|kurtk\w*|sukienk\w*|skarpet\w*|bielizn\w*|czapk\w*|rekawicz\w*)\b/u],
    compact: ['obuwie', 'butysport', 'sandal', 'kurtka', 'skarpet', 'bielizn'],
    fuzzy: ['obuwie', 'sandal', 'kurtka', 'spodnie'],
  },
  {
    kind: 'hygiene',
    strong: [
      /\b(?:szampon\w*|mydlo|dezodorant\w*|kosmet\w*|antyperspirant\w*|podpask\w*|tampon\w*)\b/u,
      /\bpasta\s+do\s+zeb\w*\b/u,
      /\bszczoteczk\w*\s+do\s+zeb\w*\b/u,
      /\bplyn\w*\s+do\s+plukani\w*\s+ust\b/u,
      /\b(?:chusteczk\w*\s+(?:higien\w*|nawilz\w*)|plyn\w*\s+micelarn\w*|pieluch\w*)\b/u,
      /\bzel\w*\s+pod\s+prysznic\w*\b/u,
      /\b(?:maszynk\w*|piank\w*)\s+do\s+goleni\w*\b/u,
      /\bkrem\w*\s+do\s+(?:twarz\w*|rak|cial\w*)\b/u,
    ],
    compact: ['colgate', 'pastadozeb', 'pastazeb', 'szczoteczkadozeb', 'szczeczeb', 'plyndoplukaniaust', 'zelpodprysznic', 'zelprysz', 'szampon', 'szamp', 'dezodorant', 'dezod', 'antyperspirant', 'mydlo', 'chusteczkhigien', 'chusteczknawilz', 'plynmicelar', 'pieluch', 'podpask', 'tampon'],
    fuzzy: ['szampon', 'dezodorant', 'kosmetyk'],
    blocked: [/\bszampon\w*\s+samochod\w*\b/u],
  },
  {
    kind: 'health',
    strong: [
      /\b(?:ibuprofen|apap|paracetamol|opatrun\w*|termometr\w*|plastr\w*|witamin\w*|suplement\w*)\b/u,
      /\b(?:lek|leki|syrop)\b/u,
      /\btablet\w*\s+(?:przeciw\w*|lek\w*|witamin\w*)\b/u,
    ],
    compact: ['ibuprofen', 'paracetamol', 'opatrunek', 'termometr', 'witamina'],
    fuzzy: ['ibuprofen', 'paracetamol', 'termometr'],
  },
  {
    kind: 'home',
    strong: [
      /\b(?:detergent\w*|wybielacz\w*|domestos|recznik\w*|serwetk\w*|gabka\w*|scierk\w*)\b/u,
      /\bplyn\w*\s+do\s+(?:naczyn\w*|plukani\w*|podlog\w*|szyb\w*)\b/u,
      /\b(?:proszek|kapsulk\w*|zel\w*)\s+do\s+prani\w*\b/u,
      /\b(?:tablet\w*|kapsulk\w*)\s+do\s+zmywark\w*\b/u,
      /\bpapier\w*\s+(?:toalet\w*|kuchenn\w*|do\s+pieczeni\w*)\b/u,
      /\bwork\w*\s+na\s+smiec\w*\b/u,
      /\b(?:folia\s+alumini\w*|srodek\w*\s+czyszcz\w*)\b/u,
    ],
    compact: ['recznikpapier', 'reczpap', 'serwetk', 'papiertoalet', 'paptoal', 'papierkuch', 'plyndonaczyn', 'plynnacz', 'plyndopluk', 'proszekdopran', 'kapsulkidopran', 'tabletkidozmywar', 'tablzmyw', 'kapszmyw', 'workinasmiec', 'worksmiec', 'domestos', 'srodekczyszcz'],
    fuzzy: ['detergent', 'wybielacz'],
    blocked: [/\bplyn\w*\s+do\s+plukani\w*\s+ust\b/u],
  },
  {
    kind: 'pet',
    strong: [
      /\bkarma\b/u,
      /\b(?:karma|przysmak\w*)\s+(?:dla\s+)?(?:psa|psow|kota|kotow|pies|kot)\b/u,
      /\bzwirek\w*\b/u,
      /\bzwirek\w*\s+(?:dla\s+)?kot\w*\b/u,
    ],
    compact: ['karmapies', 'karmadlapsa', 'karmakot', 'karmadlakota', 'karpies', 'karkot', 'zwirekdlakota', 'zwirkot', 'przysmakdlapsa', 'przysmakdlakota'],
  },
  {
    kind: 'drinks',
    strong: [/\b(?:woda|sok\w*|napoj\w*|nap\s+gaz\w*|napgaz\w*|n\s+gaz\w*|ngaz\w*|gazowan\w*|niegazowan\w*|cola|pepsi|fanta|sprite|lemoniad\w*|herbat\w*|kaw\w*|energet\w*|energy\w*|piwo|wino|cydr\w*)\b/u],
    compact: ['woda', 'sok', 'napener', 'energet', 'energydrink', 'napgaz', 'ngaz', 'niegazowan', 'gazowan', 'cola', 'pepsi', 'lemoniad', 'kawa', 'herbat'],
    fuzzy: ['napoj', 'woda', 'gazowana', 'niegazowana'],
  },
  {
    kind: 'food',
    strong: [
      /\b(?:mle(?:ko)?|jogurt\w*|kefir\w*|twarog\w*|smietan\w*|maslo|ser\b|serek\w*|sery\b|serki\w*|serow\w*|sernik\w*)\b/u,
      /\b(?:chleb\w*|bul(k|eczk)\w*|bagiet\w*|pieczyw\w*|tost\w*)\b/u,
      /\b(?:jaja|jajk\w*)\b/u,
      /\b(?:mieso|filet\w*|kurcz\w*|skrzyd\w*|schab\w*|wieprz\w*|wolow\w*|indyk\w*|piersi\w*|kielbas\w*|szynk\w*|boczek\w*|parowk\w*)\b/u,
      /\b(?:ryba|losos\w*|tunczyk\w*|sledz\w*)\b/u,
      /\b(?:makaron\w*|ryz\w*|kasz\w*|maka|cukier|pieprz\w*|sol|przypraw\w*|pesto)\b/u,
      /\b(?:banan\w*|arbuz\w*|jablk\w*|pomidor\w*|ogork\w*|ziemniak\w*|cebul\w*|czosn\w*|papryk\w*|sliwk\w*|owoc\w*|warzyw\w*)\b/u,
      /\b(?:fryt\w*|pierog\w*|pizza\w*|wafl\w*|czekolad\w*|orzech\w*|lody|lod(?:y|zik)\w*|lodow(?:y|a|e|i)\w*|rozek\w*|ciastk\w*|chips\w*|chrupk\w*|paluszk\w*|krakers\w*|baton\w*|cukierk\w*)\b/u,
      /\bgum\w*\s+do\s+zuci\w*\b/u,
      /\bprzy\w*\s+d(?:o)?\s+kur\w*\b/u,
      /\bkrem\w*\s+czekolad\w*\b/u,
      /\bolej\b/u,
    ],
    compact: ['fryt', 'pierog', 'banan', 'arbuz', 'jajaww', 'jajk', 'orzech', 'czekolad', 'sliwk', 'pesto', 'piersi', 'filet', 'filkur', 'kurcz', 'skrzydel', 'schab', 'wieprz', 'wolow', 'indyk', 'mieso', 'przyp', 'przyczos', 'wafl', 'pizza', 'pieprz', 'rozek', 'lody', 'lodiu', 'chips', 'chrupk', 'paluszk', 'krakers', 'baton', 'cukierk', 'jogurt', 'mleko', 'mlebezlakt', 'chleb', 'bulka', 'makaron', 'ryz', 'kremczekolad'],
    fuzzy: ['mleko', 'sliwka', 'pesto', 'orzech', 'czekolada', 'piersi'],
    blocked: [/\bolej\b.*\b(?:silnik\w*|motor\w*|przeklad\w*|hydraul\w*|samoch\w*|naped\w*|opal\w*|drew\w*|2t|4t|5w\s*\d{2}|\d{1,2}w\s*\d{2})\b/u],
  },
];

function compactHintMatches(signal: CategorySignalText, hint: string): boolean {
  if (hint.length >= 6) return signal.compact.includes(hint);
  if (signal.tokens.some((token) => token.includes(hint))) return true;

  // Short OCR words can be split after a confused character (`M1EKO` -> `ml eko`,
  // `W0DA...` -> `wo da...`). Rejoin only an adjacent pair with a very short
  // fragment; this keeps that recovery without creating accidental matches such
  // as `przewod audio` -> `...woda...`.
  for (let index = 0; index + 1 < signal.tokens.length; index += 1) {
    const left = signal.tokens[index]!;
    const right = signal.tokens[index + 1]!;
    if (left.length > 2 && right.length > 2) continue;
    if (`${left}${right}`.includes(hint)) return true;
  }
  return false;
}

function compactContainsWithSingleOcrError(haystack: string, needle: string): boolean {
  if (needle.length < 7 || haystack.length < needle.length - 1) return false;
  if (haystack.includes(needle)) return true;
  const minimumLength = Math.max(1, needle.length - 1);
  const maximumLength = Math.min(haystack.length, needle.length + 1);
  for (let length = minimumLength; length <= maximumLength; length += 1) {
    for (let start = 0; start + length <= haystack.length; start += 1) {
      if (editDistanceAtMostOne(haystack.slice(start, start + length), needle)) return true;
    }
  }
  return false;
}

function scoreBuiltInRule(signal: CategorySignalText, rule: BuiltInSignalRule): number {
  if (rule.blocked?.some((pattern) => pattern.test(signal.spaced))) return 0;
  let score = 0;
  for (const pattern of rule.strong) {
    if (pattern.test(signal.spaced)) score += 5;
  }
  if (rule.compact?.some((hint) => compactHintMatches(signal, hint))) score += 3;
  else if (rule.compact?.some((hint) => compactContainsWithSingleOcrError(signal.compact, hint))) score += 2;
  if (rule.fuzzy?.some((word) => word.length >= 5 && signal.tokens.some((token) => token.length >= 5 && editDistanceAtMostOne(token, word)))) score += 2;
  return score;
}

function contextualBuiltInSuggestion(signal: CategorySignalText, categories: ExpenseCategory[]): string | undefined {
  const matches = CONTEXTUAL_CATEGORY_RULES.flatMap((rule) => {
    const matched = rule.patterns.some((pattern) => pattern.test(signal.spaced))
      || rule.compact?.some((hint) => signal.compact.includes(hint));
    if (!matched) return [];
    const categoryId = categoryByKind(categories, rule.kind);
    return categoryId ? [{ categoryId, kind: rule.kind }] : [];
  });
  const uniqueCategoryIds = new Set(matches.map((match) => match.categoryId));
  if (uniqueCategoryIds.size !== 1) return undefined;
  return matches[0]?.categoryId;
}

function builtInSuggestion(name: string, categories: ExpenseCategory[]): string | undefined {
  const signal = categorySignalText(name);
  if (!signal.compact) return undefined;

  const contextual = contextualBuiltInSuggestion(signal, categories);
  if (contextual) return contextual;

  const scored = BUILT_IN_SIGNAL_RULES.flatMap((rule) => {
    const categoryId = categoryByKind(categories, rule.kind);
    if (!categoryId) return [];
    const score = scoreBuiltInRule(signal, rule);
    return score > 0 ? [{ categoryId, score, kind: rule.kind }] : [];
  }).sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind));

  if (!scored.length || scored[0]!.score < 2) return undefined;
  const best = scored[0]!;
  const competing = scored.find((entry) => entry.categoryId !== best.categoryId);
  if (competing && competing.score === best.score) return undefined;
  return best.categoryId;
}

function trigramSet(value: string): Set<string> {
  if (value.length < 3) return new Set(value ? [value] : []);
  const result = new Set<string>();
  for (let index = 0; index <= value.length - 3; index += 1) result.add(value.slice(index, index + 3));
  return result;
}

function trigramDice(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftSet = trigramSet(left);
  const rightSet = trigramSet(right);
  if (!leftSet.size || !rightSet.size) return 0;
  let overlap = 0;
  for (const gram of leftSet) if (rightSet.has(gram)) overlap += 1;
  return (2 * overlap) / (leftSet.size + rightSet.size);
}

const FAMILY_NOISE_TOKENS = new Set([
  'szt', 'sztuk', 'op', 'opak', 'opakowanie', 'opakowania', 'pus', 'pusz', 'puszka', 'puszki',
  'but', 'butelka', 'butelki', 'pet', 'kg', 'g', 'mg', 'l', 'ml', 'cl', 'dl', 'm', 'cm', 'mm', 'x',
]);

const FAMILY_GENERIC_TOKEN_STEMS = [
  'produkt', 'nap', 'ener', 'wod', 'sok', 'mle', 'fryt', 'jaj', 'karm', 'zwir', 'olej', 'bilet',
  'kabel', 'ladow', 'tablet', 'plyn', 'zel', 'szamp', 'papier', 'chleb', 'jog', 'ser', 'but', 'obuw', 'gra',
] as const;

interface ProductFamilyProfile {
  compact: string;
  tokens: string[];
  distinctiveTokens: string[];
}

function productFamilyProfile(value: string): ProductFamilyProfile {
  const signal = categorySignalText(value);
  const tokens = signal.tokens.filter((token) => {
    if (!token || /^\d+$/u.test(token)) return false;
    return !FAMILY_NOISE_TOKENS.has(token);
  });
  const distinctiveTokens = tokens.filter((token) =>
    token.length >= 3 && !FAMILY_GENERIC_TOKEN_STEMS.some((stem) => token.startsWith(stem)));
  return {
    compact: tokens.join(''),
    tokens,
    distinctiveTokens,
  };
}

function familyTokenEquivalent(left: string, right: string): boolean {
  if (left === right) return true;
  const shortest = Math.min(left.length, right.length);
  if (shortest >= 3 && (left.startsWith(right) || right.startsWith(left))) return true;
  return shortest >= 5 && editDistanceAtMostOne(left, right);
}

function familyTokenDice(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const used = new Set<number>();
  let matches = 0;
  for (const token of left) {
    const index = right.findIndex((candidate, candidateIndex) =>
      !used.has(candidateIndex) && familyTokenEquivalent(token, candidate));
    if (index < 0) continue;
    used.add(index);
    matches += 1;
  }
  return (2 * matches) / (left.length + right.length);
}

function hasSharedDistinctiveToken(left: ProductFamilyProfile, right: ProductFamilyProfile): boolean {
  return left.distinctiveTokens.some((token) =>
    right.distinctiveTokens.some((candidate) => familyTokenEquivalent(token, candidate)));
}

function productFamilySimilarity(leftName: string, rightName: string): number {
  const left = productFamilyProfile(leftName);
  const right = productFamilyProfile(rightName);
  if (!left.compact || !right.compact) return 0;
  if (left.compact === right.compact) return 1;

  const tokenScore = familyTokenDice(left.tokens, right.tokens);
  const trigramScore = trigramDice(left.compact, right.compact);
  if (left.distinctiveTokens.length && right.distinctiveTokens.length && !hasSharedDistinctiveToken(left, right)) return 0;

  // Token overlap dominates because receipt variants often differ only in package/quantity noise.
  // Character trigrams remain a guard against overly broad prefix matches.
  return Math.max(trigramScore, tokenScore * 0.9 + trigramScore * 0.1);
}

function builtInCategoryIds(categories: ExpenseCategory[]): Set<string> {
  const ids = new Set<string>();
  for (const kind of Object.keys(CATEGORY_IDENTITIES) as BuiltInCategoryKind[]) {
    const categoryId = categoryByKind(categories, kind);
    if (categoryId) ids.add(categoryId);
  }
  return ids;
}

function similarLearnedCategoryId(
  productName: string,
  products: ExpenseProduct[],
  categories: ExpenseCategory[],
  validCategoryIds: ReadonlySet<string>,
  otherCategoryId: string | undefined,
  targetBuiltInCategoryId: string | undefined,
): string | undefined {
  const query = productFamilyProfile(productName);
  if (query.compact.length < 5) return undefined;

  const builtInIds = builtInCategoryIds(categories);
  const bestByCategory = new Map<string, number>();
  for (const product of products) {
    if (!validCategoryIds.has(product.categoryId) || product.categoryId === otherCategoryId) continue;
    const isCustomCategory = !builtInIds.has(product.categoryId);
    if (!isCustomCategory && targetBuiltInCategoryId && targetBuiltInCategoryId !== product.categoryId) continue;

    const score = [product.originalName, product.name]
      .reduce((best, candidate) => Math.max(best, productFamilySimilarity(productName, candidate)), 0);
    const minimumScore = isCustomCategory ? 0.86 : 0.92;
    if (score < minimumScore) continue;
    bestByCategory.set(product.categoryId, Math.max(bestByCategory.get(product.categoryId) ?? 0, score));
  }

  const ranked = [...bestByCategory.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const best = ranked[0];
  if (!best) return undefined;
  const second = ranked[1];
  if (second && best[1] - second[1] < 0.08) return undefined;
  return best[0];
}

export function suggestCategoryId(
  productName: string,
  receipts: Receipt[],
  categories: ExpenseCategory[],
  products: ExpenseProduct[] = [],
): string {
  const normalizedName = normalizeReceiptProductName(productName);
  const normalizedProductKey = normalizeExpenseProductKey(productName);
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const otherCategoryId = categoryByName(categories, ['Inne']);
  const learnedProduct = products.find((product) => product.normalizedKey === normalizedProductKey && validCategoryIds.has(product.categoryId));
  if (learnedProduct && learnedProduct.categoryId !== otherCategoryId) return learnedProduct.categoryId;

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
  if (ranked.length && ranked[0]![0] !== otherCategoryId) return ranked[0]![0];

  const builtIn = builtInSuggestion(productName, categories);
  const learnedSimilar = similarLearnedCategoryId(productName, products, categories, validCategoryIds, otherCategoryId, builtIn);
  if (learnedSimilar) return learnedSimilar;

  if (builtIn) return builtIn;
  if (ranked.length) return ranked[0]![0];
  if (learnedProduct) return learnedProduct.categoryId;
  return otherCategoryId ?? categories[0]?.id ?? '';
}

export function applyCategorySuggestions(
  parsed: ParsedReceiptDraft,
  receipts: Receipt[],
  categories: ExpenseCategory[],
  products: ExpenseProduct[] = [],
): ParsedReceiptDraft {
  return {
    ...parsed,
    items: parsed.items.map((item) => ({
      ...item,
      suggestedCategoryId: suggestCategoryId(item.name, receipts, categories, products),
    })),
  };
}
