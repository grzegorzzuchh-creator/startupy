# Startup 2.0

Techniczne MVP platformy, w której manager uruchamia wyspecjalizowane skille, a Kreator targowy prowadzi pełny proces budowy wydarzenia. SharePoint i Outlook są adapterami zaplecza i nie są widoczne w interfejsie managera.

## Uruchomienie

Wymagany jest Node.js 20 lub nowszy. Projekt nie ma zewnętrznych zależności.

```bash
npm start
```

Aplikacja domyślnie nasłuchuje na `0.0.0.0:4173` i respektuje zmienną `PORT` dostarczaną przez hosting. Lokalna kontrola gotowości:

```bash
curl --fail http://127.0.0.1:4173/api/health
```

Testy:

```bash
npm test
```

## Struktura

- `server.js` — API, statyczny frontend i nagłówki bezpieczeństwa.
- `data/skills.json` — katalog niezależnych definicji skilli.
- `lib/` — walidacja, role, trwałość danych i adaptery integracji.
- `index.html`, `styles.css`, `app.js` — interfejs managera.
- `docs/SKILLS.md` — instrukcja dodawania skilli.
- `var/state.json` — lokalny stan uruchomień i projektów, automatycznie tworzony i ignorowany przez Git.

## Uwierzytelnianie

Domyślny tryb demonstracyjny udostępnia użytkownika managera. W środowisku za zaufaną bramą ustaw `AUTH_MODE=trusted-header`; brama musi wtedy przekazywać `X-User-Id`, `X-User-Email`, `X-User-Name` oraz rolę `X-User-Role` (`manager` albo `admin`). Nie wystawiaj aplikacji publicznie w trybie demonstracyjnym.

## Integracje

Adaptery są domyślnie wyłączone. API zwraca ten stan jawnie i nie symuluje wysyłki. Docelowe wiązania używają zmiennych `STARTUP_OUTLOOK_ENDPOINT`, `STARTUP_OUTLOOK_TOKEN`, `STARTUP_SHAREPOINT_ENDPOINT` i `STARTUP_SHAREPOINT_TOKEN`. Wartości sekretów muszą być dostarczane przez bezpieczną konfigurację środowiska, nigdy przez repozytorium.
