# j-s_lektionsplanner

Planungswerkzeug für J+S-Lektionsvorbereitungen: Programmblöcke als Bibliothek pflegen, zu
Lektionen zusammenstellen, als PDF exportieren und per E-Mail versenden.

## Auf einem Server installieren

Die App läuft auf dem Server in Docker: Datenbank, App und ein Hilfscontainer für einmalige
Befehle. Node.js oder npm braucht es dort nicht. Alles läuft im Hintergrund und startet nach
einem Neustart des Servers von selbst wieder. HTTPS übernimmt ein nginx vor der App.

```text
Browser ──https──▶ nginx (Port 443, Zertifikat) ──http──▶ 127.0.0.1:3000 App ──▶ Postgres
```

### 1. Voraussetzungen

- Linux-Server (z. B. Debian oder Ubuntu) mit mindestens 2 GB RAM (die PDF-Erstellung braucht
  einen Browser im Hintergrund)
- Eine Domain, die auf den Server zeigt, z. B. `lektionen.tv-muster.ch`
- Docker Engine mit Compose-Plugin, als Dienst aktiviert:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo systemctl enable --now docker
  ```
- nginx und certbot für das HTTPS-Zertifikat:
  ```bash
  sudo apt install nginx certbot python3-certbot-nginx
  ```

### 2. Eigenen Benutzer anlegen, Code holen und konfigurieren

Die App gehört einem eigenen Systembenutzer `lektionsplaner`. So liegen Dateien, die Geheimnisse
in `.env` und die Backups getrennt vom persönlichen Konto. Der Benutzer hat kein Passwort und kann
sich nicht per SSH anmelden; man wechselt mit `sudo` zu ihm.

```bash
sudo adduser --system --group --home /home/lektionsplaner --shell /bin/bash lektionsplaner
sudo usermod -aG docker lektionsplaner
sudo install -d -o lektionsplaner -g lektionsplaner -m 750 /opt/lektionsplaner
```

> Wer in der Gruppe `docker` ist, hat auf dem Server praktisch Root-Rechte. Der eigene Benutzer
> sorgt für Ordnung und Dateirechte, ist aber keine harte Sicherheitsgrenze: seine Shell nur
> Personen geben, denen man auch Root geben würde.

Ab hier als dieser Benutzer arbeiten (zurück mit `exit`):

```bash
sudo -iu lektionsplaner
git clone https://github.com/cysecer/j-s_lektionsplanner.git /opt/lektionsplaner
cd /opt/lektionsplaner
cp .env.production.example .env
chmod 600 .env        # Geheimnisse: nur der Benutzer lektionsplaner darf sie lesen
```

Auch alle späteren Befehle dieser Anleitung (`docker compose …`, Updates, Backup-Skript) laufen als
`lektionsplaner`: zuerst `sudo -iu lektionsplaner` und `cd /opt/lektionsplaner`.

In `.env` drei Werte setzen (Erklärungen stehen in der Datei):

| Variable            | Wert                                                        |
| ------------------- | ----------------------------------------------------------- |
| `APP_URL`           | Öffentliche Adresse, z. B. `https://lektionen.tv-muster.ch` |
| `AUTH_SECRET`       | Ausgabe von `openssl rand -base64 48`                       |
| `POSTGRES_PASSWORD` | Ausgabe von `openssl rand -base64 32`                       |

`APP_URL` muss genau die Adresse sein, die im Browser steht: Daraus entstehen die Links in
Einladungen und Anmelde-E-Mails, und Passkeys werden an diese Domain gebunden. Später die Domain zu
wechseln heisst, dass alle ihre Passkeys neu einrichten (Anmeldelink und Passwort gehen weiter).

`.env` enthält Geheimnisse und gehört nie ins Git.

**Berechtigungen im Überblick:**

| Pfad                             | Besitzer           | Rechte | Warum                                        |
| -------------------------------- | ------------------ | ------ | -------------------------------------------- |
| `/opt/lektionsplaner`            | lektionsplaner     | `750`  | Andere Benutzer des Servers sehen nicht rein |
| `/opt/lektionsplaner/.env`       | lektionsplaner     | `600`  | Geheimnisse: nur der Besitzer liest sie      |
| `/opt/lektionsplaner/backup.sh`  | lektionsplaner     | `700`  | Nur der Besitzer führt es aus oder ändert es |
| `/var/backups/lektionsplaner`    | lektionsplaner     | `700`  | Backups enthalten alle Daten                 |
| nginx-Konfiguration, Zertifikate | root (unverändert) |        | Verwaltet von nginx und certbot              |

Datenbank und hochgeladene Bilder liegen in Docker-Volumes unter `/var/lib/docker` und werden von
Docker verwaltet; im Container läuft die App als unprivilegierter Benutzer `node`. Dort ist nichts
einzustellen. Die Volumes nicht durch Host-Ordner (Bind-Mounts) ersetzen, sonst müssen die
Besitzrechte von Hand passen.

### 3. Starten

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Beim ersten Mal dauert der Build einige Minuten. Danach laufen `db` und `app` dauerhaft; vor
jedem Start aktualisiert ein kurzer `migrate`-Container die Datenbank. Kontrolle:

```bash
docker compose -f docker-compose.prod.yml ps        # app: "healthy"
curl -I http://127.0.0.1:3000/login                 # HTTP/1.1 200
```

### 4. Verein anlegen und erste Admin-Person einladen

```bash
docker compose -f docker-compose.prod.yml run --rm tools setup \
  --club "TV Muster" --admin du@tv-muster.ch --footer "J+S-Kindersport"
```

Das legt den (leeren) Verein mit den Abschnitten Einleitung, Hauptteil und Ausklang sowie den
Layouts «Standard» und «Kompakt» an und gibt einen **Einladungslink** aus (7 Tage gültig). Weil
noch kein Mailserver eingerichtet ist, wird keine E-Mail verschickt: den Link nach Schritt 5 im
Browser öffnen, Namen eingeben, fertig. Danach bietet die App an, einen Passkey einzurichten.

### 5. nginx und HTTPS

`/etc/nginx/sites-available/lektionsplaner` anlegen (Domain anpassen):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name lektionen.tv-muster.ch;

    location / {
        proxy_pass http://127.0.0.1:3000;

        # Ohne diese Zeile schlägt jedes Speichern fehl ("Invalid Server Actions request").
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Echte Client-IP für die Anmelde-Sperre (TRUSTED_PROXIES in .env).
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;

        # Bild-Uploads bis 15 MB (nginx erlaubt sonst nur 1 MB).
        client_max_body_size 20m;
        # PDF-Erstellung und E-Mail-Versand dauern einige Sekunden.
        proxy_read_timeout 90s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lektionsplaner /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lektionen.tv-muster.ch --redirect
```

certbot holt das Zertifikat bei Let's Encrypt, stellt nginx auf HTTPS um, leitet HTTP auf HTTPS
weiter und erneuert das Zertifikat automatisch. Jetzt den Einladungslink aus Schritt 4 öffnen.

Die App ist nur über `127.0.0.1` erreichbar, also nur über nginx. `TRUSTED_PROXIES=172.30.0.1` in
`.env` passt zum festen Docker-Netz aus `docker-compose.prod.yml` und muss nicht geändert werden.

### 6. In der App einrichten

1. **Einstellungen → E-Mail**: Mailserver des Hosting-Anbieters eintragen, «Testmail an mich
   senden». Ab jetzt gehen Einladungen und Anmeldelinks per E-Mail raus.
2. **Einstellungen → Verein**: Logo, Favicon (Symbol im Browser-Tab, auch auf der Login-Seite),
   Fusszeile, Startzeit, PDF-Kontingent für Lesende.
3. **Einstellungen → Riegen und Leitende** erfassen, dann unter **Personen** einladen (Rolle für
   alle Riegen oder pro Riege, Sprache der Einladung).

### Updates

```bash
sudo -iu lektionsplaner
cd /opt/lektionsplaner
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f        # alte Images aufräumen
```

Migrationen laufen dabei automatisch, Daten bleiben erhalten. Wer gerade eine Lektion bearbeitet,
muss nach dem Update eventuell einmal neu laden.

### Backup und Wiederherstellung

Zu sichern sind die Datenbank und der Upload-Ordner (Logo, Skizzen). PDFs werden nie gespeichert.

**Tägliches Backup einrichten (optional).** Das Skript sichert beides in `/var/backups/lektionsplaner`
und löscht Sicherungen, die älter als 14 Tage sind. Es läuft als Benutzer `lektionsplaner`, nicht
als root (ein Root-Job, der ein vom App-Benutzer änderbares Skript ausführt, wäre eine Hintertür).

Zuerst Backup-Ordner und Logdatei für den Benutzer anlegen (mit deinem eigenen Konto):

```bash
sudo install -d -o lektionsplaner -g lektionsplaner -m 700 /var/backups/lektionsplaner
sudo install -o lektionsplaner -g lektionsplaner -m 640 /dev/null /var/log/lektionsplaner-backup.log
```

Dann als `lektionsplaner` (`sudo -iu lektionsplaner`) dieses Skript als
`/opt/lektionsplaner/backup.sh` speichern:

```bash
#!/bin/sh
# Daily backup of the Lektionsplaner: database dump + uploaded images.
set -eu

APP_DIR=/opt/lektionsplaner
BACKUP_DIR=/var/backups/lektionsplaner
KEEP_DAYS=14
STAMP=$(date +%F_%H%M)

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
cd "$APP_DIR"

# Database (custom format, compressed; restore with pg_restore)
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U lektionsplaner -Fc lektionsplaner > "$BACKUP_DIR/db-$STAMP.dump.tmp"
mv "$BACKUP_DIR/db-$STAMP.dump.tmp" "$BACKUP_DIR/db-$STAMP.dump"

# Uploaded images (Docker volume)
docker run --rm -v lektionsplaner_storage:/data:ro -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/storage-$STAMP.tar.gz" -C /data .

# Remove old backups
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'storage-*.tar.gz' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "$(date -Iseconds) backup ok: db-$STAMP.dump, storage-$STAMP.tar.gz"
```

Ausführbar machen und einmal von Hand testen (weiterhin als `lektionsplaner`):

```bash
chmod 700 /opt/lektionsplaner/backup.sh
/opt/lektionsplaner/backup.sh && ls -lh /var/backups/lektionsplaner
exit
```

Dann mit deinem eigenen Konto den täglichen Lauf um 02:30 Uhr einrichten:

```bash
echo '30 2 * * * lektionsplaner /opt/lektionsplaner/backup.sh >> /var/log/lektionsplaner-backup.log 2>&1' \
  | sudo tee /etc/cron.d/lektionsplaner-backup
```

`backup.sh` erscheint in `git status` als unversionierte Datei; das ist harmlos und stört
`git pull` nicht.

Ob es läuft, zeigt `tail /var/log/lektionsplaner-backup.log`. Ein Backup auf demselben Server
schützt vor Bedienfehlern, aber nicht vor einem Plattenausfall: die Dateien zusätzlich regelmässig
auf einen anderen Rechner kopieren (z. B. `rsync` oder der Backup-Dienst des Hosting-Anbieters).

**Wiederherstellen** (z. B. auf einer frischen Installation nach Schritt 3; als `lektionsplaner`,
Dateinamen anpassen):

```bash
sudo -iu lektionsplaner
cd /opt/lektionsplaner
docker compose -f docker-compose.prod.yml stop app
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U lektionsplaner -d lektionsplaner --clean --if-exists \
  < /var/backups/lektionsplaner/db-2026-10-29_0230.dump
docker run --rm -v lektionsplaner_storage:/data -v /var/backups/lektionsplaner:/backup alpine \
  tar xzf /backup/storage-2026-10-29_0230.tar.gz -C /data
docker compose -f docker-compose.prod.yml start app
```

Dazu `.env` sicher aufbewahren: Ohne denselben `AUTH_SECRET` lässt sich das gespeicherte
SMTP-Passwort nicht mehr entschlüsseln (es muss dann neu eingegeben werden), und alle werden
abgemeldet.

### Nützliche Befehle

Als `lektionsplaner` im Ordner `/opt/lektionsplaner` (`sudo -iu lektionsplaner`, `cd /opt/lektionsplaner`):

| Befehl (`docker compose -f docker-compose.prod.yml …`) | Zweck                             |
| ------------------------------------------------------ | --------------------------------- |
| `logs -f app`                                          | Protokoll der App verfolgen       |
| `ps`                                                   | Zustand der Container             |
| `restart app`                                          | App neu starten                   |
| `run --rm tools invite --email x@y.ch --role ADMIN`    | Person per Kommandozeile einladen |
| `down`                                                 | Alles stoppen (Daten bleiben)     |

## Entwicklung

Voraussetzungen: Node.js 24 oder neuer und Docker Desktop (oder Docker Engine mit Compose).
Entwicklung und Produktion nutzen dieselbe Postgres-Version.

### Lokal starten

```bash
cp .env.example .env          # Werte bei Bedarf anpassen
docker compose up -d          # Postgres + Mailpit
npm install                   # erzeugt auch den Prisma-Client
npx playwright install chromium --only-shell   # Browser für den PDF-Export (einmalig)
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

### Befehle

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
| `npm run setup`      | Leeren Verein anlegen + erste Admin-Person   |

## Datenmodell

Schema: [prisma/schema.prisma](prisma/schema.prisma). Alle Daten hängen an einem Verein
(`clubId`), damit später mehrere Vereine pro Installation möglich sind. Programmblöcke werden beim
Einfügen in eine Lektion als Kopie (Snapshot) übernommen; spätere Änderungen in der Bibliothek
verändern alte Lektionen nicht. Die Volltextsuche nutzt Postgres mit deutscher Stammformbildung.

Für die E2E-Tests einmalig den Browser installieren: `npx playwright install chromium`. Die
E2E-Tests nutzen eine eigene Datenbank (`lektionsplaner_e2e`), die bei jedem Lauf neu angelegt
wird; deine Entwicklungsdaten bleiben unberührt. Docker (Postgres + Mailpit) muss laufen.

## Lektionen speichern

- **Neue Lektion:** «Neue Lektionsvorbereitung» öffnet eine leere Lektion, die erst mit
  **Entwurf speichern** angelegt wird. Wer vorher die Seite verlässt, wird gefragt (speichern,
  verwerfen oder weiter bearbeiten). Zusätzlich liegt eine Kopie im Browser: nach einem Neuladen,
  Absturz oder «Zurück» bietet die nächste neue Lektion an, sie wiederherzustellen.
- **Danach speichert der Editor automatisch**, kurz nach jeder Änderung – bei Entwürfen und bei
  fertigen Lektionen. Wer die Seite verlässt (Link, Zurück, Tab schliessen), speichert dabei noch
  ausstehende Änderungen sofort. Nur wenn das Speichern scheitert (Eingabefehler, keine Verbindung,
  gleichzeitige Änderung durch jemand anderen), fragt der Editor vor dem Verlassen nach.
- **Programmpunkt bearbeiten:** Ein Klick neben das Fenster schliesst es nicht. Escape oder ✕ mit
  Änderungen fragen, ob sie übernommen werden sollen.

## PDF-Export

PDFs erzeugt ein Headless-Chromium auf dem Server: Er öffnet eine interne Druckseite der App
(Zugang nur mit einem signierten Einmal-Token, eine Minute gültig) und druckt sie als A4. Das PDF
wird direkt an den Browser gestreamt und **nie gespeichert**, es kann also keine Festplatte
füllen. Programmpunkte werden nie über einen Seitenumbruch geteilt; die Spaltenköpfe wiederholen
sich, jede Seite trägt Fusszeile und Seitenzahl.

Lesende haben ein Tageskontingent (Standard 10, einstellbar unter Einstellungen → Verein).
Gezählt wird pro Kalendertag in Zürcher Zeit; das Protokoll (wer, wann, welche Lektion) wird
nach 90 Tagen gelöscht.

## E-Mail

Admins richten den Mailserver des Vereins unter **Einstellungen → E-Mail** ein (Server, Port,
Verschlüsselung, Benutzername, Passwort, Absender) und können eine Testmail an sich selbst
senden. Das Passwort wird verschlüsselt gespeichert und nie mehr angezeigt. Solange kein
Vereins-Mailserver eingerichtet ist, gelten die `SMTP_*`-Variablen des Servers (in der
Entwicklung: Mailpit).

Leitende und Admins verschicken eine Lektion im Editor oder in der Vorschau mit **Per E-Mail
senden**: Empfänger (mit Vorschlägen aus den Vereinsmitgliedern und früheren Empfängern),
Betreff und Nachricht, das PDF ist angehängt. Antworten gehen direkt an die Person, die
verschickt hat. Lesende können keine E-Mails senden. Pro Person sind 30 E-Mails pro Tag möglich;
das Versandprotokoll wird nach 180 Tagen gelöscht.

## Konfiguration

Alle Umgebungsvariablen sind in [.env.example](.env.example) (Entwicklung) und
[.env.production.example](.env.production.example) (Server) dokumentiert und werden beim Start
validiert ([src/lib/env-schema.ts](src/lib/env-schema.ts)). Fehlt ein Wert oder ist er ungültig,
bricht die App mit einer verständlichen Meldung ab.

## Sicherheit

Anmeldung, Rollen und Eingabevalidierung sind in [SECURITY.md](SECURITY.md) beschrieben.

## Sprachen

Oberfläche auf Deutsch (Schweiz), Französisch, Italienisch, Rumantsch und Englisch. Die Sprache
wird pro Person gespeichert. Neue Personen erhalten die Sprache, die bei der Einladung gewählt
wurde (Standard: Deutsch); die Einladungsseite erscheint bereits in dieser Sprache. Ändern kann
jede Person ihre Sprache jederzeit über die Sprachauswahl oben rechts. Status der Übersetzungen und Anleitung für neue Sprachen:
[TRANSLATIONS.md](TRANSLATIONS.md).
