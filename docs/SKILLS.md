# Dodawanie skilli do Startup 2.0

Platforma wczytuje definicje z `data/skills.json` przy każdym żądaniu katalogu. Dzięki temu zmiana treści skilla nie wymaga modyfikowania frontendu ani serwera.

## Minimalna definicja

```json
{
  "id": "unikalne-id",
  "title": "Nazwa widoczna dla użytkownika",
  "description": "Jednozdaniowy opis efektu",
  "category": "Kategoria",
  "icon": "✦",
  "featured": false,
  "status": "draft",
  "executor": "agent",
  "requiresReview": true,
  "fields": []
}
```

Status `draft` ukrywa skill przed managerami. Ustaw `published`, gdy definicja i wykonawca są gotowi. Status `archived` wycofuje skill bez kasowania definicji.

## Pola formularza

Obsługiwane typy: `text`, `textarea`, `emails` i `select`. Pole `select` wymaga tablicy `options`. Każde pole może mieć `required`, `default` i `placeholder`.

## Zasady

- Jeden skill powinien wykonywać jedno konkretne zadanie.
- Kreator targowy jest osobnym modułem i nie jest skillem.
- Operacje wysyłające wiadomości lub publikujące dane muszą mieć `requiresReview: true`.
- Sekretów, tokenów i haseł nie wolno umieszczać w definicjach.
- SharePoint pozostaje adapterem zaplecza i nie może być ujawniany w interfejsie managera.
