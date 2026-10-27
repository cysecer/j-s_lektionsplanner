# Sicherheit

## Anmeldung (angelehnt an NIST SP 800-63B, Rev. 4)

| Thema                  | Umsetzung                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zugang                 | Nur auf Einladung. Einladungslinks sind 7 Tage gültig, einmal verwendbar und nur als SHA-256-Hash gespeichert.                                                                                                                                          |
| Passkeys (empfohlen)   | WebAuthn mit Pflicht zur Benutzerverifikation (Face ID, Fingerabdruck, Windows Hello, PIN). Phishing-resistent und mehrstufig. Die App fordert nach der Einladung und auf der Startseite aktiv zum Einrichten auf.                                      |
| Anmeldelink per E-Mail | 15 Minuten gültig, einmal verwendbar, nur gehasht gespeichert. Unbekannte Adressen erhalten keine E-Mail, die Antwort ist identisch.                                                                                                                    |
| Passwort (Ersatz)      | 15–128 Zeichen, Unicode erlaubt, keine Zusammensetzungsregeln, kein Ablaufzwang. Abgelehnt werden bekannte Passwörter aus Datenlecks ([data/](data/README.md)), Wiederholungen, Folgen und Passwörter aus Name/E-Mail/Verein. Gespeichert mit argon2id. |
| Fehlversuche           | Nach `AUTH_MAX_FAILED_SIGNINS` (Standard 10) falschen Passwörtern wird die Passwort-Anmeldung für `AUTH_LOCKOUT_MINUTES` gesperrt. Passkey und Anmeldelink funktionieren weiter. Zusätzlich Rate-Limits pro IP.                                         |
| Sitzungen              | Abmeldung nach `SESSION_IDLE_MINUTES` Inaktivität (Standard 60) und spätestens nach `SESSION_MAX_HOURS` (Standard 12). Cookies HttpOnly, SameSite=Lax, in Produktion Secure. Passwortänderung meldet alle anderen Geräte ab.                            |
| Rollen                 | Administrator/-in, Leiter/-in, Nur lesen. Jede Server-Aktion prüft Sitzung und Rolle serverseitig.                                                                                                                                                      |

### Bewusste Abweichung: Anmeldelink per E-Mail

NIST 800-63B lässt E-Mail nicht als Authentisierungsmittel zu. Der Anmeldelink wurde trotzdem
aufgenommen, weil er für ehrenamtliche Leitende ohne Passkey die einfachste Anmeldung ist. Das
Risiko entspricht dem einer Passwort-Zurücksetzung per E-Mail (wer das Postfach kontrolliert,
kommt hinein). Massnahmen: kurze Gültigkeit, Einmalverwendung, Rate-Limit, kein Hinweis auf
existierende Konten, und die App drängt aktiv zu Passkeys.

## Eingabevalidierung

Keine Schnittstelle ohne Validierung:

- Server-Aktionen entstehen ausschliesslich über `action()` ([src/lib/server/action.ts](src/lib/server/action.ts)):
  zod-Schema für die gesamte Eingabe, Sitzungs- und Rollenprüfung, typisierte Fehler.
- API-Routen ausschliesslich über `route()` ([src/lib/server/route.ts](src/lib/server/route.ts)):
  Pfad-, Query- und JSON-Parameter werden validiert, Body-Grösse begrenzt.
- Seiten lesen `params`/`searchParams` nur über `parsePageInput()`.
- Ein Test ([src/lib/server/enforcement.test.ts](src/lib/server/enforcement.test.ts)) bricht ab,
  sobald Code diese Regeln umgeht.
- Formatierter Text ist auf ein strenges JSON-Format beschränkt (kein HTML), Layouts ebenfalls.
- Die Datenbank prüft zusätzlich Wertebereiche (CHECK-Constraints).

## Fehler melden

Sicherheitsprobleme bitte nicht als öffentliches Issue, sondern direkt an die Betreiber melden.
