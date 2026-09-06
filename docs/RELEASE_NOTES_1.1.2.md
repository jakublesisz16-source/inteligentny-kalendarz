# Inteligentny Kalendarz 1.1.2

`1.1.2` jest patchem bezpieczeństwa na bazie stabilnego 1.1.1. Nie zmienia schematu danych ani modelu przechowywania danych użytkownika.

## Zmiany

- importer `.xlsx` wykonuje fail-closed preflight katalogu centralnego ZIP przed przekazaniem danych do ExcelJS,
- odrzucane są m.in. archiwa ZIP64, zaszyfrowane wpisy, nadmierna liczba wpisów, zbyt duży rozmiar po rozpakowaniu i skrajny współczynnik kompresji,
- wymagane są podstawowe elementy struktury OOXML skoroszytu,
- `exceljs@4.4.0` pozostaje bez zmiany, a jego zależność `uuid` jest przypięta do zweryfikowanego `11.1.1`,
- release gate pilnuje dokładnej rezolucji `exceljs -> uuid@11.1.1`,
- Service Worker używa nowego cache `v1.1.2`, aby urządzenia pobrały poprawiony kod importu,
- `DATABASE_SCHEMA_VERSION` pozostaje `13`.

## Walidacja przed wydaniem

- test kandydata override: `exceljs@4.4.0 -> uuid@11.1.1`,
- smoke CommonJS `uuid.v4()` i roundtrip XLSX: PASS,
- regresje importu/eksportu arkuszy: 53/53 PASS,
- TypeScript, production build i release/security gates: PASS,
- `npm audit`: 0 podatności po zastosowaniu override.

Dane użytkownika nadal pozostają lokalnie; wydanie nie dodaje backendu, telemetrii ani zewnętrznego przetwarzania plików.
