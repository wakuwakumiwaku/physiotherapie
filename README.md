# Physiotherapie

Vollständiger Browser der amtlichen Schweizer KVG-Tarifstruktur für ambulante Physiotherapie, gültig ab **1. Januar 2026**, mit lokaler Rechensammlung. Kein Abrechnungssystem und keine Vergütungszusage.

## Enthalten

- Alle **13** offiziellen Positionen, nicht nur Beispiele: 5 Sitzungspauschalen, 6 Zuschlagspositionen und 2 Inkontinenzmaterial-Pauschalen. Davon 10 mit Taxpunkten, 2 mit festen CHF-Beträgen und 1 mit offenem Einkaufspreis.
- Volltextsuche über den gesamten Katalog einschliesslich Regeln, Quellhierarchie, Filter, paginierte Anzeige, vollständige Details, Originalregeln und Links auf die tatsächlichen PDF-Seiten.
- Exakter BigInt-Rechner: Anzahl × TP × selbst eingegebener CHF/TP; fixe CHF-Beträge werden niemals mit dem Taxpunktwert multipliziert. Ganze Zeile erst auf Rappen runden, dann summieren.
- Lokale Sammlung, JSON-Download und strikt geprüfte JSON-Vorschau mit Abbrechen/Sicherung vor Übernahme, CSV mit Formelinjektionsschutz, helle Druckansicht.
- Eigener Speicherbereich `physiotherapie.workspace.v1`; keine Konten, Upload- oder Schreib-API, Tracker, externen Schriften oder Frontend-Abhängigkeiten.

**Kein kantonaler Taxpunktwert wird vorgegeben.** Ein leerer Wert bleibt unbekannt. Vertragsbereich, Kanton, Gültigkeit, Verordnung und Anspruch sind eigenständig abzuklären. Sitzungs-/Frequenz-/Alters-/Indikationsregeln werden nicht automatisch geprüft. Die Kombination 7362 + 7363 erzeugt einen ausdrücklichen Hinweis, ersetzt aber ebenfalls keine Fallprüfung. Keine Patienten- oder Personendaten erfassen.

## Lokal ausführen

Voraussetzungen: Node.js >=22 und Python 3 für die registrierten Tests. Keine npm-Abhängigkeiten.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm start
```

Der Server bindet ausschliesslich an `127.0.0.1:3015`. `PORT` ist konfigurierbar; `BASE_PATH=/physiotherapie/` prüft den späteren Pages-Unterpfad. Ein geänderter Origin (Hostname/Port/Protokoll) hat einen anderen lokalen Browser-Speicher; das ist keine Datenmigration.

Die Oberfläche wird aus `dist/` bereitgestellt. `createAppServer({root, basePath})` wird von `scripts/serve.mjs` für isolierte Prüfungen exportiert; `root` ist der gebaute Dateibaum. Alle Daten werden beim Start automatisch geladen; `document.body.dataset.ready` wird erst danach `true`. Die Navigation verweist auf die vorgesehenen kanonischen Katalogadressen; deren Veröffentlichung ist ein separater Schritt.

## Registrierte native Browserabnahme

Nach `npm run build` separat ausführen; zusätzlich zum unabhängigen Node-/Python-Gate. Ein kompatibles natives Firefox-/Camoufox-Binary und Playwright Core werden ausschliesslich extern bereitgestellt, nicht als versteckte Build-/Runtime-Abhängigkeit:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
BROWSER_EXECUTABLE=/path/to/camoufox \
npm run test:browser
```

Der Test startet und beendet nur seinen eigenen Loopback-Server auf Port 0 und seinen isolierten Headless-Browser. Jedes Ausführen erhält ein neues ignoriertes `.local/native-…/` mit `report.json`, echten JSON-/CSV-/Rohstand-Downloads, Drucktexten und Screenshots. Fehlgeschlagene Versuche bleiben getrennt erhalten. Szenarien prüfen den vollständigen Katalog, Suche/Regeln/Quellen, echte Eingaben, Dezimalrechnung, Persistenz, Dateiauswahl/Vorschau/Abbrechen/Sicherung/Übernahme, ungültige Imports, geschützten Speicher, Zwei-Tab-Drafts, getrennte Namespaces, Tastaturnavigation und 1440/768/390/320px. Alle Seiten werden auf JS-/Konsole-/HTTP-Fehler sowie externe oder schreibende Requests überwacht. `window.print` wird nur an der nativen API-Grenze beobachtet; die echte App erzeugt die aktuelle Druckprojektion, deren helle Druck-CSS geprüft wird. Kein OS-Druckdialog und kein tatsächlicher Papier-/PDF-Spool werden behauptet. Es werden keine entfernten Kataloglinks geöffnet; unabhängige SPEC-/QUALITY-Prüfung und Veröffentlichung bleiben getrennte Gates.

## Quellen aktualisieren

Die Rohquellen bleiben in ignoriertem `sources/`. Für die Quellenbeschaffung wird `curl`, für den PDF-Import `pdftotext` benötigt; keine Python-Pakete nötig.

```sh
npm run acquire
npm run import
npm run check
npm test
npm run build
```

Die Beschaffung folgt dem tatsächlich auf der BAG-Seite verlinkten 2026-Anhang. Bestehende abweichende Capture-Dateien werden nicht überschrieben: dafür ein neues Verzeichnis mit `--output` wählen. Der Import akzeptiert nur den dokumentierten PDF-SHA-256. Eine neue Edition verlangt bewusste Prüfung und Anpassung, keine automatische Übernahme unbekannter Quellen.

Saubere Public-Checkouts benötigen **weder** Rohquellen **noch** `.local/` oder ein altes `dist/`; die geprüften abgeleiteten Daten liegen bereits in `public/data/`. Fachliche Herkunft und Nutzungsbefund: [DATA.md](DATA.md). Dateisatz und Grenzen: [docs/CODEBASE.md](docs/CODEBASE.md).

## Lokale Datensicherheit

Ungültige Eingaben bleiben als sichtbarer, ungespeicherter Entwurf erhalten. Beschädigter/blockierter Speicher wird nicht überschrieben. Änderungen aus anderen Tabs sperren weitere Schreibvorgänge; Entwurf und gelesener Rohstand lassen sich getrennt sichern. Nach Abklärung neu laden. Der unmittelbare Rohwertvergleich vor einem einzelnen Schreibvorgang ist kein browserübergreifend atomarer Compare-and-swap; zwei exakt gleichzeitig schreibende Tabs können nicht vollständig ausgeschlossen werden. Deshalb Sicherungsdateien behalten und Sammlungen möglichst nur in einem Tab bearbeiten.

JSON-Übernahme ersetzt nur den eigenen Schlüssel, nach vollständiger Validierung, vollständiger Vorschau, Sicherungsdownload und expliziter Übernahme. Es gibt keinen versteckten Speicherreset. Downloads bleiben privat und sind nicht Bestandteil des öffentlichen Builds.
