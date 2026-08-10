export interface ReleaseNote {
  version: string;
  title: string;
  date?: string;
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.0-rc.7',
    title: 'Release Candidate - deterministyczny Change Journal',
    changes: [
      'Change Journal nadaje nowym operacjom ściśle rosnące timestampy w tej samej transakcji IndexedDB, eliminując remis dwóch zmian wykonanych w jednej milisekundzie.',
      'Dodano deterministyczne regresje Undo dla Dziennika Cyklu i Zakupów bez zmiany semantyki cofania, schema ani funkcji użytkowych.',
      'PDF.js pozostaje przypięty do 6.2.108; finalna lokalna bramka wymaga kilku kolejnych pełnych checków bez pojedynczego FAIL.',
    ],
  },
  {
    version: '1.0.0-rc.6',
    title: 'Release Candidate - zgodność PDF.js 6 cleanup',
    changes: [
      'Dostosowano wyłącznie cleanup dokumentu PDF do API PDF.js 6 przez PDFDocumentLoadingTask.destroy(), bez zmiany sposobu odczytu i parsera Pracy.',
      'pdfjs-dist pozostaje przypięty dokładnie do 6.2.108, a schema nadal wynosi 12; brak nowych funkcji, migracji i store.',
      'RC.6 wymaga stabilnej lokalnej bramki: czyste npm ci oraz dwa kolejne pełne npm run check bez zmian plików.',
    ],
  },
  {
    version: '1.0.0-rc.5',
    title: 'Release Candidate - bezpieczeństwo PDF.js',
    changes: [
      'Przypięto pdfjs-dist dokładnie do 6.2.108, czyli wersji naprawiającej znany problem bezpieczeństwa przy otwieraniu złośliwych PDF.',
      'Nie zmieniono sposobu importu grafików PDF, OCR ani parsera Pracy; RC.5 nie dodaje nowych funkcji.',
      'RC.4 ma potwierdzone npm ci, 336/336 testów frontendu, 5/5 testów Workera i production build PASS; RC.5 wymaga ponownego lokalnego check po aktualizacji dependency.',
    ],
  },
  {
    version: '1.0.0-rc.4',
    title: 'Release Candidate - zgodność PDF.js',
    changes: [
      'Usunięto nieobsługiwaną już właściwość isEvalSupported z wywołania PDF.js, bez zmiany sposobu odczytu tekstu z PDF.',
      'RC.4 służy wyłącznie finalizacji lokalnego npm check po udanym npm install i npm ci na Windows; bez nowych funkcji.',
      'Schema nadal wynosi 12, zależności produktu pozostają bez zmian, a pełny local check wymaga rzeczywistego potwierdzenia po npm run check.',
    ],
  },
  {
    version: '1.0.0-rc.3',
    title: 'Release Candidate - naprawa test-suite',
    changes: [
      'Zaktualizowano historyczne testy migracji i backupu do aktualnego schema 12 bez zmiany produkcyjnej logiki IndexedDB.',
      'Test powiadomień sprawdza brak przeterminowanego reminderu Kalendarza bez błędnego wykluczania niezależnego reminderu Kopii danych.',
      'Naprawiono izolację testów planowania przez wspólny deleteDatabaseForTests(); nie dodano funkcji, migracji ani nowych zależności.',
      'RC.2 lokalnie osiągnął npm ci, typecheck i worker:typecheck PASS oraz 326/336 testów; pełny RC.3 check wymaga ponownego potwierdzenia lokalnie.',
    ],
  },
  {
    version: '1.0.0-rc.2',
    title: 'Release Candidate - naprawa lokalnego check',
    changes: [
      'Naprawiono zgodność Cloudflare workers-types z Wranglerem oraz dodano typy Node wymagane przez testy źródłowe.',
      'Usunięto cztery błędy TypeScript fixtures Global Search oraz problemy typowania Web Crypto i klucza VAPID bez zmiany zachowania funkcji produktu.',
      'Service Worker otrzymał wersję cache RC.2; schema nadal wynosi 12 i nie dodano żadnych funkcji ani migracji.',
      'Lokalny Windows potwierdził npm ci, typecheck i worker:typecheck PASS; Vitest ujawnił 10 historycznych problemów test-suite przy 326/336 testów PASS.',
    ],
  },
  {
    version: '1.0.0-rc.1',
    title: 'Release Candidate - stabilizacja przed 1.0.0',
    changes: [
      'Zamknięto rozwój funkcjonalny i wykonano pierwszy finalny audit wydania bez dodawania nowych funkcji.',
      'Nowe instalacje zaczynają z pustą listą Miejsc zamiast konkretnych domyślnych adresów; istniejące dane aktualizowanych instalacji nie są usuwane.',
      'Service Worker otrzymał nową wersję cache dla RC, a workflow GitHub Pages zastąpiono CI opartym o npm ci i npm run check.',
      'To nadal Release Candidate: finalne 1.0.0 wymaga pełnego npm ci/check/build, deploymentu Cloudflare oraz realnych testów PWA i Web Push na urządzeniach.',
    ],
  },
  {
    version: '0.7.0',
    title: 'Globalne wyszukiwanie',
    changes: [
      'Dodano jedną szybką wyszukiwarkę dla wydarzeń, Studiów, Pracy i Miejsc bez dokładania nowej zakładki do nawigacji.',
      'Wyszukiwanie obejmuje nazwy, opisy wydarzeń, nazwy i adresy powiązanych Miejsc oraz notatki Miejsc, z normalizacją polskich znaków.',
      'Dane Cyklu i Dziennika Cyklu są celowo wykluczone z globalnych wyników, a zapytania nie są zapisywane ani wysyłane do sieci.',
      'Wyniki są liczone lokalnie w pamięci, maksymalnie 12 naraz; schema pozostaje 12, bez migracji i nowych zależności.',
    ],
  },
  {
    version: '0.6.3',
    title: 'Szacowane okno owulacji',
    changes: [
      'Przy stabilnej prognozie Cyklu aplikacja może pokazać szerokie możliwe okno owulacji jako prosty szacunek kalendarzowy.',
      'Wynik jest zawsze zakresem dat i pojawia się tylko przy statusie READY oraz umiarkowanej lub wyższej wiarygodności.',
      'Nie dodano dni płodnych, bezpiecznych dni, prawdopodobieństwa ciąży ani zastosowania antykoncepcyjnego.',
      'Szacunek jest derived data liczonym lokalnie; schema pozostaje 12, bez nowych zależności, danych trwałych i powiadomień.',
    ],
  },
  {
    version: '0.6.2',
    title: 'Dziennik Cyklu - lek przeciwbólowy',
    changes: [
      'Dziennik dnia pozwala opcjonalnie zapisać prostą odpowiedź Tak / Nie, czy tego dnia przyjęto lek przeciwbólowy.',
      'Brak odpowiedzi, Nie i Tak pozostają trzema różnymi stanami; odpowiedź Nie nie jest gubiona przez logikę boolean.',
      'Nie dodano nazwy leku, dawki, godzin, przypomnień ani porad medycznych - pole zapisuje wyłącznie fakt podany przez użytkowniczkę.',
      'Schema pozostaje 12, a Własne wzorce, cycle-v1 i Web Push nie korzystają z nowego pola.',
    ],
  },
  {
    version: '0.6.1',
    title: 'Własne wzorce Cyklu',
    changes: [
      'Dodano lekkie podsumowanie własnych zapisów bez nowej zakładki, dashboardu ani wykresów.',
      'Historia może pokazać typową długość miesiączki oraz najczęściej zapisane krwawienie, ból i samopoczucie dopiero po osiągnięciu prostych progów danych.',
      'Wzorce są liczone lokalnie i wyłącznie w pamięci z CyclePeriod oraz CycleJournalEntry; notatki nie są analizowane ani eksportowane jako osobne statystyki.',
      'Schema pozostaje 12, bez migracji, nowych zależności, zmian modelu cycle-v1 i zmian Web Push.',
    ],
  },
  {
    version: '0.6.0',
    title: 'Dziennik Cyklu',
    changes: [
      'Dodano szybki lokalny wpis dnia: krwawienie, ból, samopoczucie i krótka opcjonalna notatka.',
      'Dziennik działa niezależnie od historii miesiączek i jest dostępny z Dzisiaj oraz Kalendarza bez dodawania nowej głównej zakładki.',
      'Wpisy są objęte Cofnij, backupem, punktami przywracania i ręcznym transferem danych; schema bazy wzrosła do 12.',
      'Dziennik nie diagnozuje, nie wpływa na model cycle-v1 i nie tworzy nowych powiadomień.',
    ],
  },
  {
    version: '0.5.4',
    title: 'Kwiatowy motyw przewodni UI',
    changes: [
      'Motyw kwiatowy jest teraz wyraźną, ale nadal spokojną tożsamością całej aplikacji, a nie tylko delikatnym tłem.',
      'Dodano wspólne statyczne akcenty roślinne w brandingu, górnej części głównego widoku i pustych stanach bez ozdabiania kart ani formularzy.',
      'Jedno ustawienie nadal steruje wszystkim: Wyłączone usuwa cały floral design, Statyczne pokazuje pełny nieruchomy motyw, a Delikatnie animowane porusza tylko wybrane elementy tła.',
      'Zachowano prefers-reduced-motion, brak nowych zależności i brak zmian funkcjonalnych.',
    ],
  },
  {
    version: '0.5.3',
    title: 'Czytelniejsza nawigacja',
    changes: [
      'Dodano spójne, lekkie ikony SVG do wszystkich ośmiu pozycji głównej nawigacji, bez usuwania tekstowych nazw.',
      'Desktop i mobile korzystają z tego samego mapowania ikon, a mobilny pasek nadal pozostaje prosty i przewijalny poziomo.',
      'Usunięto nieinformatywne kropki nawigacyjne oraz historyczne założenie siedmiu pozycji w CSS.',
      'Zmiana jest wyłącznie nawigacyjno-wizualna: schema 11, bez nowych zależności, bez zmian tła kwiatowego i Web Push.',
    ],
  },
  {
    version: '0.5.2',
    title: 'Dopracowanie tła kwiatowego',
    changes: [
      'Rozwinięto tło do siedmiu organicznie rozmieszczonych grup dekoracyjnych na desktopie, bez efektu gęstej tapety.',
      'Tylko trzy wybrane motywy są animowane i mają różne, bardzo wolne cykle; większość dekoracji pozostaje statyczna.',
      'Na tabletach i telefonach kompozycja jest automatycznie upraszczana, a prefers-reduced-motion nadal zatrzymuje cały ruch.',
      'Zmiana pozostaje czysto wizualna: schema 11, bez nowych zależności i bez wpływu na Web Push ani dane użytkownika.',
    ],
  },
  {
    version: '0.5.1',
    title: 'Subtelne tło kwiatowe',
    changes: [
      'Dodano lekką dekorację kwiatową jako nieinteraktywną warstwę za treścią aplikacji.',
      'W Ustawieniach można wybrać: Wyłączone, Statyczne albo Delikatnie animowane; domyślny pozostaje tryb statyczny.',
      'Animacja używa wyłącznie transform i opacity, a prefers-reduced-motion automatycznie zatrzymuje ruch.',
      'Zmiana jest czysto wizualna: schema pozostaje 11, bez nowych zależności i bez wpływu na logikę powiadomień.',
    ],
  },
  {
    version: '0.5.0',
    title: 'Fundament powiadomień',
    changes: [
      'Dodano prywatny system Web Push z globalnym wyłącznikiem całego systemu i osobnymi kategoriami Kalendarz, Studia, Praca, Cykl oraz Kopia danych.',
      'Treść przypomnień pozostaje lokalnie w IndexedDB; serwer otrzymuje tylko anonimowy identyfikator harmonogramu i termin obudzenia urządzenia.',
      'Tryb Dyskretny jest domyślny, a Cykl przypomina wyłącznie o przewidywanym oknie przy statusie READY - bez sugerowania pewnej daty.',
      'Dodano przygotowaną warstwę Cloudflare Worker + D1 + Cron. Rzeczywisty Web Push wymaga jeszcze deploymentu, VAPID i testu na docelowych urządzeniach.',
    ],
  },
  {
    version: '0.4.1',
    title: 'Trasa do zapisanych miejsc',
    changes: [
      'Dodano lekką akcję Trasa otwierającą zapisane miejsce w Mapach Google z Dzisiaj, Kalendarza i Miejsc.',
      'Integracja nie używa Google Maps API, GPS ani połączeń w tle - adres trafia do Map dopiero po świadomym kliknięciu.',
      'Dodano stały PROJECT_HANDOFF ułatwiający bezpieczne kontynuowanie projektu w nowej rozmowie.',
    ],
  },
  {
    version: '0.4.0',
    title: 'Cykl',
    changes: [
      'Nowy, osobny i prywatny moduł Cykl pozwala rozpocząć historię od dziś albo opcjonalnie uzupełnić wcześniejsze miesiączki.',
      'Lokalny model cycle-v1 korzysta wyłącznie z zapisanej historii, pokazuje zakres zamiast jednej pewnej daty i potrafi świadomie wstrzymać zbyt niepewny szacunek.',
      'Model rozpoznaje nietypowo długie luki, nie zgaduje brakujących miesiączek i pozwala oznaczyć odstęp jako przerwę w obserwacji bez utraty prawdziwych dat.',
      'Historia cyklu jest objęta backupem, punktami przywracania i przenoszeniem danych, a sam Cykl nie wpływa na Pracę, Studia ani Dyspozycyjność.',
    ],
  },
  {
    version: '0.3.7',
    title: 'Domknięcie UX i stabilności',
    changes: [
      'Zablokowane akcje wyjaśniają, czego brakuje i prowadzą do właściwego ustawienia zamiast pozostawać bez kontekstu.',
      'Przenoszenie danych jest widoczne jako osobna sekcja Ustawień, a backup, Kosz, historia i trwałość danych pozostają w Centrum bezpieczeństwa.',
      'Poprawiono mobilną nawigację, zakładki Pracy oraz układy ważnych paneli na małych ekranach.',
      'Dodano obsługę trwałego przechowywania przeglądarki oraz spokojną instalację PWA tylko wtedy, gdy platforma ją udostępnia.',
      'Wykonano końcowy audit głównych przepływów serii 0.3.x bez dodawania nowej domeny danych.',
    ],
  },
  {
    version: '0.3.6',
    title: 'Przenoszenie danych',
    changes: [
      'Cały logiczny stan aplikacji można wyeksportować do jednego lokalnego pliku JSON i przenieść na inne urządzenie.',
      'Przed importem aplikacja sprawdza format i checksum oraz pokazuje podsumowanie zawartości bez ujawniania prywatnej treści.',
      'Import działa w trybie zastąpienia danych i przed zapisem automatycznie tworzy punkt przywracania stanu urządzenia docelowego.',
      'Transfer działa offline, bez konta, chmury i synchronizacji na żywo.',
    ],
  },
  {
    version: '0.3.5',
    title: 'Lista zakupów',
    changes: [
      'Nowy lekki moduł Zakupy pozwala szybko dodawać, edytować i odhaczać rzeczy do kupienia.',
      'Produkty oraz opcjonalne ilości są zapisywane lokalnie i uwzględniane w backupie oraz punktach przywracania.',
      'Zakupy pozostają całkowicie niezależne od Kalendarza, Pracy, Studiów i optimizera dyspozycyjności.',
    ],
  },
  {
    version: '0.3.4',
    title: 'Podsumowanie pracy',
    changes: [
      'Nowa zakładka Podsumowanie pokazuje miesięczną liczbę przepracowanych godzin, zmian i dni pracy.',
      'Aplikacja liczy średnią i najdłuższą zmianę oraz pokazuje lekki rozkład godzin między tygodniami.',
      'Podsumowanie wykorzystuje istniejące porównanie grafiku z wysłaną dyspozycyjnością bez zapisywania nowych statystyk do bazy.',
      'Identyczna ręczna zmiana i zmiana z WORK_PDF nie są liczone podwójnie w statystykach.',
    ],
  },
  {
    version: '0.3.3-hotfix.4',
    title: 'Czytelniejsze zmiany i zespół',
    changes: [
      'Własna zmiana jest wyraźnie oddzielona od listy współpracowników i pokazuje czas trwania.',
      'Każda osoba ma osobny wiersz z pełną zmianą i dokładnym zakresem Razem z Tobą.',
      'Współpracownicy są sortowani według długości wspólnego czasu, a długie listy można zwinąć.',
      'Uproszczono podsumowanie zgodności grafiku z wysłaną dyspozycyjnością.',
    ],
  },
  {
    version: '0.3.3-hotfix.3',
    title: 'Dyspozycyjność liczona z kalendarza',
    changes: [
      'Nie trzeba wpisywać godzin rozpoczęcia i zakończenia dla każdego dnia przed uruchomieniem optimizera.',
      'Brak wyjątku dnia oznacza automatyczne wyliczenie bezpiecznych okien z planu zajęć, pracy i blokujących wydarzeń.',
      'Pola od/do są dostępne dopiero jako opcjonalny wyjątek konkretnego dnia, a własny dokładny blok nadal można wpisać ręcznie.',
      'Standardowe ramy pracy są jednorazowym ustawieniem technicznym dla całkowicie wolnych części dnia.',
    ],
  },
  {
    version: '0.3.3-hotfix.2',
    title: 'Podgląd planu w kalendarzu',
    changes: [
      'Plan innej grupy można oglądać w lekkim miesięcznym kalendarzu, bez zmiany własnego planu.',
      'Kliknięcie dnia pokazuje uporządkowane godzinowo szczegóły zajęć, a widok Lista pozostaje dostępny jednym przełączeniem.',
      'Zmiana grupy i miesiąca dotyczy wyłącznie podglądu i nie wpływa na Kalendarz, Dziś ani optimizer dyspozycyjności.',
      'Wpisy bez pewnej daty nie są przypisywane do sztucznego dnia i pozostają dostępne w widoku Lista.',
    ],
  },
  {
    version: '0.3.3-hotfix.1',
    title: 'Dyspozycyjność pod pełną kontrolą',
    changes: [
      'Kalendarz sam wylicza możliwe okna wokół zajęć, pracy i blokujących wydarzeń.',
      'Dla konkretnego dnia możesz ustawić od kiedy, do kiedy albo w jakich godzinach nie jesteś dostępna.',
      'Własną dyspozycyjność można wpisać i edytować bezpośrednio w Kalendarzu.',
      'Ręczne decyzje są zachowywane, a optimizer szuka tylko brakujących godzin.',
      'Blok, który po zmianie planu zajęć zaczyna kolidować, pozostaje widoczny i wymaga ręcznej poprawy.',
    ],
  },
  {
    version: '0.3.3',
    title: 'Prostsza Praca',
    changes: [
      'Moduł Praca ma prosty podział na Grafik i Dyspozycyjność, a ustawienia pracy są dostępne bezpośrednio przy tej funkcji.',
      'Ciężki Planer dnia zniknął z globalnych Ustawień; zaawansowane ograniczenia są domyślnie schowane.',
      'Wysłaną dyspozycyjność można porównać z rzeczywistym grafikiem PDF i zobaczyć dokładne godziny przydzielone poza dostępnością.',
      'Porównanie jest tylko informacyjne: nie zmienia grafiku, wysłanego snapshotu ani kalendarza.',
      'Główne Ustawienia są lżejsze, a grupy studiów zostały przeniesione bliżej modułu Studia.',
    ],
  },
  {
    version: '0.3.2',
    title: 'Automatyczna dyspozycyjność',
    changes: [
      'Aplikacja układa jeden rekomendowany plan dyspozycyjności na podstawie celu godzin, zajęć, pracy i blokujących wydarzeń.',
      'Krótkie 1-2 godzinne okna są normalnymi kandydatami, jeśli nie ustawiono własnego minimum zmiany.',
      'Każdy blok można zaakceptować, edytować, odrzucić albo sprawdzić przez Dlaczego?.',
      'Dyspozycyjność jest osobną warstwą kalendarza i nie jest mylona z potwierdzoną pracą.',
      'Można skopiować zaakceptowaną dyspozycyjność i zachować prosty snapshot wersji oznaczonej jako wysłana.',
    ],
  },
  {
    version: '0.3.1',
    title: 'Spójny plan dnia',
    changes: [
      'Kalendarz wykrywa nakładające się wydarzenia, brak buforu i niespójności planu zajęć bez automatycznego zmieniania danych.',
      'Centrum niespójności pozwala szybko poprawić pojedynczy termin, zaakceptować znany konflikt albo bezpiecznie skorygować godziny powiązanej serii.',
      'Model dnia przechowuje tygodniowy cel pracy, preferencje godzinowe, soboty, ręcznie oznaczone niedziele handlowe i codzienne czynności.',
      'Kategorie STUDY, WORK, PERSONAL i OTHER mają osobne kolory oraz oddzielne liczniki w każdej komórce kalendarza.',
      'Tło widoku kalendarza ma bardzo delikatną minimalistyczną teksturę bez dodatkowych plików graficznych.',
    ],
  },
  {
    version: '0.3.0',
    title: 'Grafik pracy',
    changes: [
      'Możesz lokalnie zaimportować rzeczywisty grafik pracy z PDF z warstwą tekstową.',
      'Profil pracy łączy zmianę z zapisanym miejscem i pozwala bezpiecznie dopasować właściwy wiersz w grafiku.',
      'Zmiany pracy trafiają do kalendarza, a aplikacja podsumowuje godziny i wykrywa kolizje z innymi wydarzeniami.',
      'Nowa wersja grafiku jest porównywana z aktywną wersją zamiast tworzyć duplikaty.',
      'Opcjonalnie aplikacja lokalnie pokazuje, kto pracuje w tym samym czasie i przez jaki przedział zmiany.',
      'Potwierdzona praca z PDF i wpisy ręczne mają wspólne API przygotowane pod przyszły optymalizator dyspozycyjności.',
    ],
  },
  {
    version: '0.2.4',
    title: 'Bezpieczniejsze dane',
    changes: [
      'Usunięte wydarzenia trafiają do Kosza i można je przywrócić.',
      'Historia zmian oraz szybkie Cofnij chronią przed przypadkową edycją i usunięciem.',
      'Punkty przywracania zabezpieczają większe operacje, takie jak aktualizacja planu lub zmiana grup.',
      'Możesz wyeksportować pełny lokalny backup i sprawdzić go przed przywróceniem.',
      'Konkretny dzień można oznaczyć jako niewykorzystywany przez przyszły optymalizator dyspozycyjności.',
      'Nowy bezpieczny podgląd pozwala sprawdzić plan innych grup bez zmiany aktywnego planu i wydarzeń.',
    ],
  },
  {
    version: '0.2.3',
    title: 'Więcej możliwości planowania',
    changes: [
      'Możesz tworzyć wydarzenia całodniowe i obejmujące kilka dni.',
      'Tryb Wybierz dni pozwala zaznaczyć kilka dat bez klikania każdego formularza osobno.',
      'Niekolejne daty tworzą bezpieczną ręczną serię z możliwością edycji jednego terminu albo całej serii.',
      'Wydarzenia wielodniowe są widoczne na każdym dniu swojego zakresu, także między miesiącami i latami.',
      'Poprawiono układ wyboru zakresu w oknie Uzupełnij dane zajęcia.',
    ],
  },
  {
    version: '0.2.2',
    title: 'Stabilniejszy import planu',
    changes: [
      'Parser lepiej znosi przesunięte bloki dni i zmienioną kolejność kolumn.',
      'Rozpoznaje więcej bezpiecznych formatów dat, godzin, grup i klinik.',
      'Siatka czasu nie zakłada już stałego interwału 15 minut i obsługuje również sobotę.',
      'Diagnostyka nierozpoznanego planu pokazuje, czego zabrakło do bezpiecznego importu.',
      'Tożsamość serii pozostaje stabilna przy kosmetycznych wariantach zapisu kliniki.',
    ],
  },
  {
    version: '0.2.1',
    title: 'Aktualizacje planu bez utraty własnych poprawek',
    changes: [
      'Porównanie nowego planu XLSX z aktywnym planem przed zapisaniem zmian.',
      'Widok nowych, zmienionych, usuniętych zajęć i konfliktów z ręcznymi poprawkami.',
      'Stały profil grup studiów i możliwość zmiany grup w Ustawieniach.',
      'Uzupełnianie brakujących danych raz dla bezpiecznie powiązanej serii zajęć.',
      'Historia planów z oznaczeniem aktywnej i historycznych wersji.',
    ],
  },
  {
    version: '0.2.0-hotfix.1',
    title: 'Wygodniejsza kontrola importu',
    changes: [
      'Całe karty wpisów są klikalne.',
      'Bezpieczne wpisy do sprawdzenia są zaznaczane automatycznie.',
      'Aplikacja pokazuje konkretnie, czego brakuje.',
      'Braki krytyczne są oddzielone od zwykłych ostrzeżeń.',
    ],
  },
  {
    version: '0.2.0',
    title: 'Pierwszy import planu studiów',
    changes: [
      'Lokalny import XLSX bez wysyłania pliku na serwer.',
      'Wykrywanie grup i wybór wielu przypisań.',
      'Podgląd i korekta zajęć przed dodaniem do kalendarza.',
      'Ochrona przed ponownym importem identycznego pliku.',
    ],
  },
  {
    version: '0.1.0',
    title: 'Fundament kalendarza',
    changes: [
      'Widok Dzisiaj i kalendarz miesięczny.',
      'Ręczne wydarzenia, miejsca i ustawienia.',
      'Lokalna baza danych i podstawowe działanie offline.',
    ],
  },
];
