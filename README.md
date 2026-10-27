# j-s_lektionsplanner

Planungswerkzeug für J+S-Lektionsvorbereitungen: Programmblöcke als Bibliothek pflegen, zu
Lektionen zusammenstellen, als PDF exportieren und per E-Mail versenden.

> Status: im Aufbau (Phase 1 – Projektgrundlage).

## Voraussetzungen

- Node.js 24 oder neuer
- Docker Desktop (oder Docker Engine mit Compose) – Entwicklung und Produktion nutzen dieselbe
  Postgres-Datenbank

## Lokal starten

```bash
cp .env.example .env          # Werte bei Bedarf anpassen
docker compose up -d          # Postgres + Mailpit
npm install
npm run dev                   # http://localhost:3000
```

Alle E-Mails werden in der Entwicklung von Mailpit abgefangen: <http://localhost:8025>.

## Befehle

| Befehl              | Zweck                                       |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Entwicklungsserver                          |
| `npm run build`     | Produktions-Build                           |
| `npm run typecheck` | TypeScript-Prüfung (strict)                 |
| `npm run lint`      | ESLint                                      |
| `npm run format`    | Prettier                                    |
| `npm test`          | Unit-Tests (Vitest)                         |
| `npm run test:e2e`  | End-to-End-Tests (Playwright, baut die App) |

Für die E2E-Tests einmalig den Browser installieren: `npx playwright install chromium`.

## Konfiguration

Alle Umgebungsvariablen sind in [.env.example](.env.example) dokumentiert und werden beim Start
validiert ([src/lib/env-schema.ts](src/lib/env-schema.ts)). Fehlt ein Wert oder ist er ungültig,
bricht die App mit einer verständlichen Meldung ab.
