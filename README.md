# j-s_lektionsplanner

Planungswerkzeug für J+S-Lektionsvorbereitungen: Programmblöcke als Bibliothek pflegen, zu
Lektionen zusammenstellen, als PDF exportieren und per E-Mail versenden.

> Status: im Aufbau (Phase 6 – Programmblock-Bibliothek).

## Voraussetzungen

- Node.js 24 oder neuer
- Docker Desktop (oder Docker Engine mit Compose) – Entwicklung und Produktion nutzen dieselbe
  Postgres-Datenbank

## Lokal starten

```bash
cp .env.example .env          # Werte bei Bedarf anpassen
docker compose up -d          # Postgres + Mailpit
npm install                   # erzeugt auch den Prisma-Client
npm run db:migrate            # Datenbankschema anlegen
npm run db:seed               # Demodaten (Beispiel-Lektion "Spiele")
npm run invite -- --email du@example.ch --role ADMIN   # erste Administratorin einladen
npm run dev                   # http://localhost:3000
```

Den Einladungslink findest du in Mailpit (<http://localhost:8025>) oder in der Ausgabe von
`npm run invite`. Nach dem Annehmen bietet die App an, einen Passkey einzurichten.

Alle E-Mails werden in der Entwicklung von Mailpit abgefangen: <http://localhost:8025>.

Nach einem Update mit neuen Migrationen (`npm run db:migrate`) den Entwicklungsserver neu starten:
der laufende Server hält sonst den alten Datenbank-Client im Speicher.

## Befehle

| Befehl               | Zweck                                        |
| -------------------- | -------------------------------------------- |
| `npm run dev`        | Entwicklungsserver                           |
| `npm run build`      | Produktions-Build                            |
| `npm run typecheck`  | TypeScript-Prüfung (strict)                  |
| `npm run lint`       | ESLint                                       |
| `npm run format`     | Prettier                                     |
| `npm test`           | Unit-Tests (Vitest)                          |
| `npm run test:e2e`   | End-to-End-Tests (Playwright, baut die App)  |
| `npm run db:migrate` | Migrationen erstellen/anwenden (Entwicklung) |
| `npm run db:deploy`  | Migrationen anwenden (Produktion)            |
| `npm run db:seed`    | Demodaten laden (nur in leere Datenbank)     |
| `npm run db:reset`   | Datenbank leeren, migrieren, Demodaten laden |
| `npm run invite`     | Person einladen (`--email`, `--role`)        |

## Datenmodell

Schema: [prisma/schema.prisma](prisma/schema.prisma). Alle Daten hängen an einem Verein
(`clubId`), damit später mehrere Vereine pro Installation möglich sind. Programmblöcke werden beim
Einfügen in eine Lektion als Kopie (Snapshot) übernommen; spätere Änderungen in der Bibliothek
verändern alte Lektionen nicht. Die Volltextsuche nutzt Postgres mit deutscher Stammformbildung.

Für die E2E-Tests einmalig den Browser installieren: `npx playwright install chromium`. Die
E2E-Tests nutzen eine eigene Datenbank (`lektionsplaner_e2e`), die bei jedem Lauf neu angelegt
wird; deine Entwicklungsdaten bleiben unberührt. Docker (Postgres + Mailpit) muss laufen.

## Konfiguration

Alle Umgebungsvariablen sind in [.env.example](.env.example) dokumentiert und werden beim Start
validiert ([src/lib/env-schema.ts](src/lib/env-schema.ts)). Fehlt ein Wert oder ist er ungültig,
bricht die App mit einer verständlichen Meldung ab.

## Sicherheit

Anmeldung, Rollen und Eingabevalidierung sind in [SECURITY.md](SECURITY.md) beschrieben.

## Sprachen

Oberfläche auf Deutsch (Schweiz), Französisch, Italienisch, Rumantsch und Englisch. Die Sprache
wird pro Person gespeichert. Status der Übersetzungen und Anleitung für neue Sprachen:
[TRANSLATIONS.md](TRANSLATIONS.md).
