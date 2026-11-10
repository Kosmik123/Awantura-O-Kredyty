# Awantura o Kredyty: licytacja

Strona do prowadzenia licytacji pytań w konkursie „Awantura o Kredyty" (teleturniej fantastyczny). Każda drużyna licytuje pytanie, a drużyna, która wygra licytację, odpowiada na pytanie i dostaje całą pulę.

Projekt jest jednym z dwóch folderów w `Awantura o Kredyty/`:
- `AoK-licytacja`: ten folder, czyli strona licytacji,
- `AoK-pytania`: osobne repozytorium z bazą pytań zadawanych w konkursie.

## Uruchamianie

- Aplikacja jest statyczna (HTML + JS + CSS, bez bibliotek i bez budowania). Użytkownik odpala ją po prostu jako plik (`index.html` otwarty w przeglądarce).
- `server.js` (Node, port 4173, `.claude/launch.json`) istnieje **tylko po to, żeby Claude Code mógł testować aplikację** w przeglądarce. Nie jest częścią gry i nie wolno od niego uzależniać kodu (żadnych `fetch` do API, ścieżek bezwzględnych, modułów ES wymagających serwera).

## Pliki

- `index.html`: dwa ekrany, `#setup-screen` (ustawienia) i `#game-screen` (gra), przełączane klasą `hidden`.
- `app.js`: cała logika w jednej IIFE, bez frameworków.
- `style.css`: wygląd.

## Zasady gry (jak działa aplikacja)

Ekran startowy: liczba drużyn (1–10), nazwy drużyn (domyślnie „Drużyna N"), kapitał początkowy każdej drużyny (domyślnie 10000) i **wpisowe** (domyślnie 500). Każda drużyna ma kolor z `PALETTE` i klawisz: drużyny 1–9 to klawisze `1`–`9`, dziesiąta to `0`.

**Wpisowe** (`state.ante`, `collectAnte()`): na początku każdej rundy prowadzący naciska **spację** i dopiero wtedy każda drużyna, która jeszcze gra, wpłaca do puli wpisowe (niezależnie od tego, czy chce). Wpisowe jest też **częścią wkładu** drużyny (`contributions`), więc wyświetlany nad drużyną wkład po jego pobraniu wynosi np. 500, a przebicie liczy się od niego (pierwsze przebicie daje 600).

**Przegrana drużyna** (`team.eliminated`, `eliminateBrokeTeams()`): przy wejściu w każdą rundę (przed pobraniem wpisowego) drużyna z kapitałem mniejszym niż wpisowe + `BID_STEP` (np. poniżej 600 przy wpisowym 500) przegrywa na stałe, bo po wpłaceniu wpisowego nie mogłaby już nic dać do licytacji. Nie płaci wpisowego, jej klawisz jest ignorowany, a jej ramka i kapitał są wyszarzone. Pozostały jej kapitał zostaje na ekranie.

Gra ma trzy fazy (`state.phase`):

0. **`waiting` (początek rundy)**: `enterWaitingRound()` zeruje wkłady, ogłasza ewentualne przegrane. Gra czeka na **spację**, która pobiera wpisowe (`startBidding()`) i otwiera licytację. Klawisze drużyn są w tej fazie ignorowane. Tak zaczyna się też pierwsza runda po starcie gry.
1. **`bidding` (licytacja)**
   - Krótkie naciśnięcie klawisza drużyny to **przebicie**: wkład drużyny staje się o `BID_STEP` (100) większy od najwyższego wkładu w puli, także jej własnego (drużyna może przebijać samą siebie wielokrotnie). Do puli trafia tylko brakująca różnica, np. po wpisowym 500 pierwsze przebicie daje 600, kolejne kliknięcie tej samej drużyny 700. Liczy się przy puszczeniu klawisza.
   - Nic się nie dzieje, gdy drużyny nie stać na przebicie (wtedy zostaje va bank). Przy jednej drużynie przebijanie też działa.
   - Przytrzymanie klawisza dłużej niż `HOLD_MS` (450 ms) to **va bank**: cały kapitał drużyny idzie do puli i licytacja **kończy się od razu**, a drużyna z va bankiem odpowiada. Va bank jest niedozwolony (nic się nie dzieje), jeśli wkład drużyny po wrzuceniu całego kapitału nie byłby ściśle wyższy od najwyższego wkładu innej drużyny. Dlatego remis ani przegrana va banku nie występują.
   - **Spacja** kończy licytację. Nic się nie stanie, jeśli nikt jeszcze nie licytował.
   - Zwycięzca licytacji to `leaderIdx`, czyli drużyna, która ostatnio ściśle przebiła wszystkich pozostałych (zwykłym przebiciem albo va bankiem).
2. **`answering` (odpowiedź)**
   - Wyłoniona drużyna (`answeringTeamId`) odpowiada na pytanie, które prowadzący zadaje poza aplikacją.
   - Odpowiedź dobra: prowadzący naciska **klawisz tej drużyny**. Drużyna dostaje całą pulę, a zaczyna się nowa runda w fazie `waiting` (wpisowe dopiero po spacji). Klawisze innych drużyn są w tej fazie ignorowane.
   - Odpowiedź błędna: **spacja**. Pula zostaje nietknięta, a ta sama spacja od razu otwiera nową rundę i pobiera wpisowe (bez dodatkowej spacji), więc pula przechodzi na następne pytanie.

Wkłady (`contributions`) i `leaderIdx` zerują się przy wejściu w każdą nową rundę, a pula (`pool`) tylko po wygranej. Gra nie kończy się sama, gdy zostanie jedna drużyna.

## Płatność (kara / podpowiedź) i sterowanie myszą

- **Płatność** (w kodzie `penalty*`): jeden mechanizm do dwóch zastosowań, **kary** nałożonej przez prowadzącego i **zakupu podpowiedzi** przez odpowiadającą drużynę. W interfejsie nazywa się „Płatność"; prowadzący sam decyduje, czy to kara, czy podpowiedź. Klawisz `K` albo przycisk „Płatność (K)" włącza tryb płatności (`penalty.active`) i otwiera panel boczny z polem kwoty (domyślnie 500) i przyciskiem „Pobierz płatność". Przycisk jest nieaktywny, dopóki nie wybrano drużyny (i kwoty > 0). Drużynę wybiera się klawiszem cyfry albo kliknięciem w jej ramkę (w tym trybie klik/klawisz drużyny **wybiera**, a nie licytuje). Po wyborze fokus trafia do pola kwoty; `Enter` pobiera płatność, `Esc` albo „Anuluj" anulują. Działa w każdej fazie, zabiera pieniądze z konta drużyny (nie więcej, niż drużyna ma), a pieniądze **znikają z gry** (nie trafiają do puli ani do innej drużyny). Przegrana po płatności sprawdzana jest dopiero przy wejściu w następną rundę. W tym trybie spacja jest ignorowana.
- **Mysz**: wszystko da się robić myszą. Klik w ramkę drużyny (kolumnę ze stanem albo pole wkładu) działa jak klawisz tej drużyny (`pressTeam`/`releaseTeam`, wspólne dla klawiatury i myszy): krótki klik to przebicie, przytrzymanie to va bank, a w fazie odpowiedzi klik odpowiadającej drużyny to dobra odpowiedź. Przycisk pod pulą (`#action-btn`) działa jak spacja i zmienia podpis zależnie od fazy.

## Szczegóły implementacji, o które łatwo się potknąć

- Obsługa klawiszy i myszy zapamiętuje fazę gry z momentu naciśnięcia (`pressed`), bo nagroda na `keydown` od razu zmienia fazę na `waiting` i `keyup` tego samego klawisza nie może wtedy wrzucić 100 kredytów do nowej puli.
- Ramki są odtwarzane przy każdym `render()`, więc mysz obsługują delegowane listenery na `#teams-row` i `#contributions-row` (po `data-team-index`), a zwolnienie nasłuchuje `window`. Przyciski tracą fokus po kliknięciu, żeby późniejsza spacja ich nie aktywowała.
- `e.repeat` jest ignorowane, żeby przytrzymanie nie spamowało licytacji.
- Stan gry jest tylko w pamięci (`state`), bez zapisu. Przycisk „Nowa gra" czyści go i wraca do ekranu startowego. `?` pokazuje panel z zasadami klawiatury.
- Styl kolumn drużyn (`.team-box`, `.contribution-box`): razem tworzą jedną tabelę (bez odstępów, sąsiednie ramki współdzielą brzeg, wiersz wkładów styka się z wierszem drużyn), prostokąty bez zaokrągleń, biała ramka i biały tekst z ciemnym cieniem (`text-shadow`, dla czytelności na jasnych kolorach), wypełnienie to pionowy gradient: kolor drużyny w środku, o 40% ciemniejszy u góry i u dołu (`color-mix` ze zmienną CSS `--team-color` ustawianą w `render()`). Przegrana drużyna jest wyszarzona filtrem CSS (`.eliminated`).
- Bounce liczb (`@keyframes bounce`, klasa `.bump`, ok. 0,5 s): pula (`bumpPool()` restartuje animację) i wkład drużyny, który wzrósł od poprzedniego renderu (`lastContributions` w `render()`).
- Odpowiadająca drużyna (`.team-box.answering`): dodatkowy wewnętrzny biały brzeg (`inset box-shadow`, żeby nie przesuwać układu) i pulsowanie jasności tła (`@keyframes answering-pulse`) przez całą fazę odpowiedzi.
- Teksty w interfejsie są po polsku, a liczby formatowane przez `toLocaleString('pl-PL')`.
