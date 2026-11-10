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

Ekran startowy: liczba drużyn (1–10), nazwy drużyn (domyślnie „Drużyna N"), kapitał początkowy każdej drużyny (domyślnie 1000). Każda drużyna ma kolor z `PALETTE` i klawisz: drużyny 1–9 to klawisze `1`–`9`, dziesiąta to `0`.

Gra ma dwie fazy (`state.phase`):

1. **`bidding` (licytacja)**
   - Krótkie naciśnięcie klawisza drużyny wrzuca do puli `BID_STEP` (100) kredytów, ale nie więcej niż ma drużyna. Liczy się przy puszczeniu klawisza.
   - Przytrzymanie klawisza dłużej niż `HOLD_MS` (450 ms) to **va bank**: cały kapitał drużyny idzie do puli, a drużyna dostaje flagę `allIn`.
   - **Spacja** kończy licytację. Nic się nie stanie, jeśli nikt jeszcze nie licytował.
   - Zwycięzca licytacji: spośród drużyn z va bankiem wygrywa ta z największym wkładem. Jeśli nikt nie dał va banku, wygrywa drużyna z największym wkładem (przy remisie ta z niższym numerem).
2. **`answering` (odpowiedź)**
   - Wyłoniona drużyna (`answeringTeamId`) odpowiada na pytanie, które prowadzący zadaje poza aplikacją.
   - Odpowiedź dobra: prowadzący naciska **klawisz tej drużyny**. Drużyna dostaje całą pulę, a zaczyna się nowa licytacja. Klawisze innych drużyn są w tej fazie ignorowane.
   - Odpowiedź błędna: **spacja**. Pula zostaje nietknięta i zaczyna się nowa licytacja, więc pula przechodzi na następne pytanie.

Wkłady (`contributions`) i flagi `allIn` zerują się przy każdej nowej licytacji, a pula (`pool`) tylko po wygranej. Drużyna z kapitałem 0 dostaje klasę `eliminated` (tylko wizualnie, gra jej nie blokuje).

## Szczegóły implementacji, o które łatwo się potknąć

- Obsługa klawiszy zapamiętuje fazę gry z momentu `keydown` (`keyRecords`), bo nagroda na `keydown` od razu zmienia fazę na licytację i `keyup` tego samego klawisza nie może wtedy wrzucić 100 kredytów do nowej puli.
- `e.repeat` jest ignorowane, żeby przytrzymanie nie spamowało licytacji.
- Stan gry jest tylko w pamięci (`state`), bez zapisu. Przycisk „Nowa gra" czyści go i wraca do ekranu startowego. `?` pokazuje panel z zasadami klawiatury.
- Teksty w interfejsie są po polsku, a liczby formatowane przez `toLocaleString('pl-PL')`.
