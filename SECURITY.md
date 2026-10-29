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
| Rollen                 | Administrator/-in für alles; sonst Leiter/-in oder Nur lesen, für alle Riegen oder pro Riege (siehe unten). Jede Server-Aktion prüft Sitzung und Rolle serverseitig.                                                                                    |

### Bewusste Abweichung: Anmeldelink per E-Mail

NIST 800-63B lässt E-Mail nicht als Authentisierungsmittel zu. Der Anmeldelink wurde trotzdem
aufgenommen, weil er für ehrenamtliche Leitende ohne Passkey die einfachste Anmeldung ist. Das
Risiko entspricht dem einer Passwort-Zurücksetzung per E-Mail (wer das Postfach kontrolliert,
kommt hinein). Massnahmen: kurze Gültigkeit, Einmalverwendung, Rate-Limit, kein Hinweis auf
existierende Konten, und die App drängt aktiv zu Passkeys.

## Rechte pro Riege

- Admins sehen und bearbeiten alles. Alle anderen haben entweder eine Rolle für alle Riegen
  (Leiter/-in oder Nur lesen, gilt auch für später angelegte Riegen) oder eine Rolle pro Riege.
  Riegen ohne Rolle sind für die Person unsichtbar: Lektionen, Programmblöcke und die
  Riegen-Auswahl.
- Bearbeiten, Löschen, Duplizieren und E-Mail-Versand einer Lektion verlangen die Rolle
  Leiter/-in in der Riege dieser Lektion; eine Lektion lässt sich nur in eigene Leiter-Riegen
  verschieben. Lektionen ohne Riege und vereinsweite Programmblöcke sehen alle Mitglieder;
  bearbeiten darf sie, wer mindestens eine Riege leitet.
- Programmblöcke bearbeitet, wer eine ihrer Riegen leitet. Riegen-Zuordnungen kann man nur für
  eigene Leiter-Riegen hinzufügen oder entfernen; die übrigen bleiben erhalten.
- Die Regeln liegen an einer Stelle ([src/lib/auth/team-access.ts](src/lib/auth/team-access.ts),
  [src/lib/lessons/visibility.ts](src/lib/lessons/visibility.ts)) und werden serverseitig bei
  jeder Abfrage und Aktion angewendet; Änderungen durch Admins gelten ab der nächsten Anfrage.
- Das PDF-Kontingent für Lesende gilt für Personen, die keine Riege leiten.

## Sichtbarkeit von Lektionen

- Jede Lektion merkt sich das Konto, das sie erstellt hat.
- Pro Riege können Admins festlegen, dass Entwürfe nur für die erstellende Person sichtbar sind,
  bis sie veröffentlicht werden. Admins sehen immer alles.
- Durchgesetzt wird das an einer Stelle ([src/lib/lessons/visibility.ts](src/lib/lessons/visibility.ts)),
  durch die jede Lektionsabfrage für eine Person läuft: Liste, Editor, Vorschau, Speichern,
  Duplizieren, Löschen, PDF, E-Mail und die Verwendungsliste der Programmblöcke. Eine fremde
  private Lektion ergibt 404, auch über ihre direkte Adresse.
- Mehrere Lektionen auf einmal löschen können nur Admins.

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

## Hochgeladene Bilder

- Erlaubt sind PNG, JPEG und HEIC (iPhone), höchstens 15 MB. Das Format wird am Dateiinhalt
  erkannt, nicht am Namen; SVG, HTML, PDF usw. werden abgelehnt.
- Die Anfrage wird beim Lesen abgebrochen, sobald sie die Grenze überschreitet.
- Jedes Bild wird neu kodiert, verkleinert und **ohne Metadaten** gespeichert (keine GPS-Position,
  keine Kameradaten). Schutz vor «Dekompressionsbomben» durch eine Pixelgrenze.
- Bilder werden nur angemeldeten Personen desselben Vereins ausgeliefert, mit
  `X-Content-Type-Options: nosniff` und einer restriktiven Content-Security-Policy.
- Gespeicherte Dateien werden nie überschrieben; Dateinamen erzeugt die App selbst.

## PDF-Export

- Die Druckseite `/print/lessons/:id` ist die einzige Seite ohne Session. Sie verlangt ein
  Token, das die PDF-Route erzeugt: HMAC-signiert (abgeleitet von `AUTH_SECRET`), an Verein und
  Lektion gebunden, 60 Sekunden gültig und nur einmal verwendbar. Ungültige Tokens ergeben 404.
- Der Renderer-Browser läuft ohne JavaScript, ohne Cookies der Person und darf nur die App
  selbst aufrufen; alle anderen Anfragen werden blockiert. Bilder werden als Data-URIs
  eingebettet, statt über die Asset-Route geladen.
- Text in der Fusszeilen-Vorlage (HTML) wird escaped.
- PDFs werden nur im Speicher erzeugt und gestreamt, nie auf die Festplatte geschrieben.
  Gleichzeitige Renderings sind begrenzt (`PDF_CONCURRENCY`), jedes hat ein Zeitlimit.
- Lesende haben ein serverseitig erzwungenes Tageskontingent (Sperre pro Person gegen parallele
  Anfragen); Leitende und Admins sind auf 200 pro Tag begrenzt.

## E-Mail

- Das SMTP-Passwort muss für den Versand wieder lesbar sein und kann deshalb nicht gehasht
  werden. Es wird mit AES-256-GCM verschlüsselt gespeichert; der Schlüssel wird per HKDF aus
  `AUTH_SECRET` abgeleitet und liegt nie in der Datenbank. Die Vereins-ID ist als zusätzliche
  authentisierte Angabe eingebunden, ein kopierter Wert lässt sich anderswo nicht entschlüsseln.
- Das Passwort ist nur schreibbar: Keine Seite und keine Aktion gibt es zurück, auch nicht an
  Admins. Die Oberfläche zeigt nur «gespeichert».
- Wer Server, Port, Verschlüsselung oder Benutzername ändert, muss das Passwort neu eingeben.
  Ein übernommenes Admin-Konto kann das gespeicherte Passwort so nicht an einen eigenen Server
  umleiten.
- Wird `AUTH_SECRET` gewechselt, lässt sich das Passwort nicht mehr entschlüsseln; die
  Einstellungsseite weist darauf hin, und es muss neu eingegeben werden.
- Erlaubt sind nur Mail-Ports (25, 465, 587, 2525, 1025) und reine Hostnamen bzw. IP-Adressen,
  damit die Einstellung nicht zum Abtasten anderer interner Dienste dient. Unverschlüsselte
  Verbindungen werden abgelehnt, solange `SMTP_REQUIRE_TLS` aktiv ist (Standard). Zertifikate
  werden geprüft.
- Betreff, Empfänger und Absender dürfen keine Zeilenumbrüche enthalten (kein Header-Injection).
  Die Nachricht wird als Text übernommen und im HTML-Teil vollständig escaped.
- Lektionen versenden nur Leitende und Admins (serverseitig geprüft), höchstens 20 Empfänger pro
  E-Mail und 30 E-Mails pro Person und Tag; auch fehlgeschlagene Versuche zählen. Das
  Versandprotokoll (wer, wann, an wen, Betreff) wird nach 180 Tagen gelöscht.

## HTTP-Header und Content Security Policy

- Jede Antwort trägt eine Content Security Policy mit einem neuen Nonce pro Anfrage
  ([src/proxy.ts](src/proxy.ts), [src/lib/server/security-headers.ts](src/lib/server/security-headers.ts)):
  Skripte nur von der App selbst und nur mit Nonce (`strict-dynamic`), keine fremden Quellen,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Inline-
  Style-Attribute bleiben erlaubt, weil Drag & Drop und Popovers Elemente damit positionieren.
- Dazu `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`,
  eine restriktive `Permissions-Policy` und bei https `Strict-Transport-Security`.
- Die E2E-Tests schlagen fehl, sobald der Browser in irgendeinem Test etwas wegen der CSP
  blockiert; die Policy wird so gegen die echte Nutzung geprüft.

## Betrieb

- Die App läuft im Container als unprivilegierter Benutzer `node` und lauscht nur auf
  `127.0.0.1`; von aussen erreichbar ist sie nur über nginx (HTTPS).
- Geheimnisse stehen nur in `.env` auf dem Server (nicht im Image: Build-Platzhalter gelten nur
  für den Build-Befehl). Das Docker-Image enthält keine Testdaten und keine `docs/`.
- Hochgeladene Bilder, die nach 24 Stunden an nichts hängen (z. B. Formular ohne Speichern
  geschlossen), werden beim nächsten Upload gelöscht. PDFs werden nie gespeichert.
- Datenbank und Upload-Ordner sind Docker-Volumes; Backup und Wiederherstellung: README.

## Löschen und Archivieren

Riegen, Leitende und Zusatzfelder, die in Lektionen oder Programmblöcken vorkommen, werden beim
Löschen archiviert statt gelöscht, damit alte Lektionsvorbereitungen unverändert bleiben. Wird eine
Person aus dem Verein entfernt, endet ihre Anmeldung sofort; ein Konto ohne Verein wird vollständig
gelöscht. Der Verein behält immer mindestens eine Administratorin bzw. einen Administrator.

## Fehler melden

Sicherheitsprobleme bitte nicht als öffentliches Issue, sondern direkt an die Betreiber melden.
