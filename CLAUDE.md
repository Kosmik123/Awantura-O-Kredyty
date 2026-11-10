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
   - Krótkie naciśnięcie klawisza drużyny to **przebicie**: wkład drużyny staje się o `BID_STEP` (100) większy od najwyższego wkładu *innej* drużyny (np. drużyna 1 ma 500, więc `2` daje drużynie 2 wkład 600, a do puli trafia tylko brakująca różnica). Liczy się przy puszczeniu klawisza.
   - Nic się nie dzieje, gdy drużyna już prowadzi (nie można przebijać samego siebie) albo nie stać jej na przebicie (wtedy zostaje va bank). Przy jednej drużynie też nie da się przebić ponad pierwsze 100.
   - Przytrzymanie klawisza dłużej niż `HOLD_MS` (450 ms) to **va bank**: cały kapitał drużyny idzie do puli i licytacja **kończy się od razu**, a drużyna z va bankiem odpowiada. Va bank jest niedozwolony (nic się nie dzieje), jeśli wkład drużyny po wrzuceniu całego kapitału nie byłby ściśle wyższy od najwyższego wkładu innej drużyny. Dlatego remis ani przegrana va banku nie występują.
   - **Spacja** kończy licytację. Nic się nie stanie, jeśli nikt jeszcze nie licytował.
   - Zwycięzca licytacji to `leaderIdx`, czyli drużyna, która ostatnio ściśle przebiła wszystkich pozostałych (zwykłym przebiciem albo va bankiem).
2. **`answering` (odpowiedź)**
   - Wyłoniona drużyna (`answeringTeamId`) odpowiada na pytanie, które prowadzący zadaje poza aplikacją.
   - Odpowiedź dobra: prowadzący naciska **klawisz tej drużyny**. Drużyna dostaje całą pulę, a zaczyna się nowa runda w fazie `waiting` (wpisowe dopiero po spacji). Klawisze innych drużyn są w tej fazie ignorowane.
   - Odpowiedź błędna: **spacja**. Pula zostaje nietknięta, a ta sama spacja od razu otwiera nową rundę i pobiera wpisowe (bez dodatkowej spacji), więc pula przechodzi na następne pytanie.

Wkłady (`contributions`) i `leaderIdx` zerują się przy wejściu w każdą nową rundę, a pula (`pool`) tylko po wygranej. Gra nie kończy się sama, gdy zostanie jedna drużyna.

## Szczegóły implementacji, o które łatwo się potknąć

- Obsługa klawiszy zapamiętuje fazę gry z momentu `keydown` (`keyRecords`), bo nagroda na `keydown` od razu zmienia fazę na `waiting` i `keyup` tego samego klawisza nie może wtedy wrzucić 100 kredytów do nowej puli.
- `e.repeat` jest ignorowane, żeby przytrzymanie nie spamowało licytacji.
- Stan gry jest tylko w pamięci (`state`), bez zapisu. Przycisk „Nowa gra" czyści go i wraca do ekranu startowego. `?` pokazuje panel z zasadami klawiatury.
- Teksty w interfejsie są po polsku, a liczby formatowane przez `toLocaleString('pl-PL')`.
