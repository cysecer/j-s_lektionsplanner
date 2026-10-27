# Übersetzungen

Die Oberfläche ist vollständig übersetzbar. Alle Texte liegen in [messages/](messages/), eine
Datei pro Sprache. Inhalte der Benutzer/-innen (Spiele, Notizen usw.) werden nicht übersetzt.

| Sprache            | Datei                             | Status                                                            |
| ------------------ | --------------------------------- | ----------------------------------------------------------------- |
| Deutsch (Schweiz)  | [de-CH.json](messages/de-CH.json) | Referenz, vollständig                                             |
| Französisch (CH)   | [fr-CH.json](messages/fr-CH.json) | ⚠️ Entwurf – **Prüfung durch Muttersprachler/-in nötig**          |
| Italienisch (CH)   | [it-CH.json](messages/it-CH.json) | ⚠️ Entwurf – **Prüfung durch Muttersprachler/-in nötig**          |
| Rumantsch Grischun | [rm.json](messages/rm.json)       | ⚠️ Entwurf – **Prüfung durch Muttersprachler/-in dringend nötig** |
| Englisch           | [en.json](messages/en.json)       | ⚠️ Entwurf – **Prüfung durch Muttersprachler/-in nötig**          |

Die Entwürfe wurden maschinell erstellt. Besonders Rumantsch ist unsicher (z. B. «s'annunziar» für
«anmelden», «pled-clav» für «Passwort», «manader/-a» für «Leiter/-in»).

## Begriffe

Die J+S-Fachbegriffe sollten den offiziellen Bezeichnungen von Jugend+Sport entsprechen:

| Deutsch              | Français             | Italiano                   | Rumantsch              | English       |
| -------------------- | -------------------- | -------------------------- | ---------------------- | ------------- |
| J+S                  | J+S                  | G+S                        | G+S                    | J+S           |
| Lektion              | leçon                | lezione                    | lecziun                | lesson        |
| Lektionsvorbereitung | préparation de leçon | preparazione della lezione | preparaziun da lecziun | lesson plan   |
| Leiter/-in           | moniteur/-trice      | monitore/-trice            | manader/-a             | coach         |
| Riege                | groupe               | gruppo                     | gruppa                 | group         |
| Programmblock        | bloc de programme    | blocco di programma        | bloc da program        | program block |
| Verein               | société              | società                    | uniun                  | club          |

## Regeln

- **Deutsch:** Schweizer Rechtschreibung – immer «ss», nie «ß» (ein Test prüft das).
- Platzhalter wie `{name}` oder `{count, plural, …}` nicht übersetzen und nicht entfernen.
- Alle Dateien müssen genau dieselben Schlüssel haben wie `de-CH.json`. Der Test
  [src/i18n/messages.test.ts](src/i18n/messages.test.ts) prüft fehlende oder zusätzliche Schlüssel,
  abweichende Platzhalter und leere Texte.
- Fehlt ein Text trotzdem, zeigt die App den deutschen Text an.

## Neue Sprache hinzufügen

1. `messages/de-CH.json` kopieren, z. B. nach `messages/es.json`, und übersetzen.
2. In [src/i18n/config.ts](src/i18n/config.ts) den Code in `LOCALES` ergänzen und in
   `LANGUAGE_NAMES` (Name in der Sprache selbst) sowie `FORMAT_LOCALE` (Datums-/Zahlenformat,
   z. B. `es-CH`) eintragen.
3. `npm test` ausführen.
