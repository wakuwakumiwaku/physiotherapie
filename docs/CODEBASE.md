# Codebasis

## Architektur

Vanilla ESM, Node >=22, keine npm-Abhängigkeiten und keine Laufzeit-Frameworks. Die statische Oberfläche lädt den vollständigen publizierten Katalog und seine Provenienz automatisch vom gleichen Origin. Suche durchsucht immer alle 13 Positionen; nur die DOM-Anzeige ist auf 6 weitere Treffer pro Schritt begrenzt.

| Datei | Verantwortung |
| --- | --- |
| `index.html` | Deutschsprachige zugängliche Oberfläche, drei Direktlinks und sechs eingeklappte Kataloglinks, ein Current-Marker, CSP, Dialoge, Formular- und Native-QA-Hooks |
| `src/app.js` | Aktivierung, Volltextsuche, Positionen/Details, lokale Sammlung, nichtmutierende Importvorschau, echte Downloads, aktuelle Druckprojektion, Fehlermeldungen |
| `src/domain.js` | Katalog-/Provenienz-/Workspace-Prüfung, exakte BigInt-Dezimalrechnung, Ganzzeilenrundung, CSV-Escaping, eigener Storage-Guard |
| `src/styles.css` | Dunkelviolette Kontrastoberfläche, 17px Formulare/Positionstitel, 18px Geldwerte, Reflow bis 320px, helle Druckansicht |
| `public/favicon.svg` | Eigenes einfaches Icon, kein amtliches Logo |
| `public/data/catalog.json` | Vollständige amtliche Struktur und Regeln |
| `public/data/provenance.json` | Quellen, Bytes, SHA-256, Gültigkeit, Herkunft und Nutzungsbefund |
| `public/data/import-report.json` | Datenzählung und Quellenabgleiche |
| `scripts/acquire_sources.py` | Tatsächlichen offiziellen Anhang ermitteln und Originalbytes vor Import sichern |
| `scripts/import_catalog.py` | Gepinnte PDF-Struktur vollständig und deterministisch importieren |
| `scripts/files.mjs` | **Exakte** Runtime-Allowlist, destination → source |
| `scripts/check.mjs` | Input-/Schema-/Quellen-/Berichts-/Navigations-/Pfad- und JavaScript-Prüfung |
| `scripts/build.mjs` | Alle Inputs erst einlesen/validieren, dann isoliert aus Allowlist bauen und gültiges Output ersetzen |
| `scripts/serve.mjs` | Export `createAppServer({root,basePath})`, nur GET/HEAD und erlaubte Dateien, Loopback-Host-Prüfung, CSP, kein Schreib-API |
| `tests/domain.test.mjs` | Fachlicher Bestand, Rundung, Suchumfang, strikte Imports, Speicherfehler/Fremdänderungen, CSV |
| `tests/runtime.test.mjs` | Canary-Ausschluss, unveränderter guter Build bei kaputten Inputs, echte HTTP-Bytes/Unterpfad/Privatpfade/Methoden/Host |
| `tests/test_import_catalog.py` | Public-Datenumfang, Quellpin/Taxonomie, fehlerhafte Quellen/Editionen, tatsächliche Link-Parserlogik |
| `tests/browser.mjs` | Registrierte native Headless-Abnahme: echte UI, Downloads, Import, Druckprojektion, Speicherfehler/Zwei-Tab-Konflikt, Navigation, 1440/768/390/320px und alle Browser-Fehlerkanäle; externe Testbrowser-Pfade nur über Umgebungsvariablen |
| `package.json`, `package-lock.json` | Registrierte Befehle, Node-Anforderung, leere Dependency-Closure |
| `.github/workflows/pages.yml` | Saubere Installation, Checks, Node/Python-Tests, Allowlist-Build und Pages-Artefakt |
| `.gitignore` | Rohquellen, Exporte, Backups, lokales QA, dist und Caches ausgeschlossen |
| `README.md`, `DATA.md`, `docs/CODEBASE.md` | Betrieb, Quellen/Semantik, vollständiges öffentliches Inventar |

Das ist der vollständige vorgesehene öffentliche Quelldateisatz (25 Dateien). Runtime: exakt 8 Dateien gemäss `runtimeFiles`. Es gibt keine implizit kopierten Verzeichnisse und keine ignorierten Build-Abhängigkeiten. `dist/`, `sources/`, `.local/`, `node_modules/` und `__pycache__/` sind nicht zu veröffentlichen.

## Hooks für unabhängige Browserprüfung

- `document.body.dataset.ready === 'true'` ausschliesslich nach echten erfolgreichen Datenfetches, Validierung und aktiver UI.
- `#search`, `#results`, Ergebnis-`article[data-id]`, `#result-count`, `#category`, `#reset`, `#more`.
- Ergebnisbuttons „Details & Regeln“ und „Hinzufügen“; `#details-dialog`, `#close-details`, `#details-add`.
- `#tpw`, `#workspace-label`, `#workspace-notes`, `#workspace-lines`, `data-workspace-id`, `data-line-amount`, zugängliche Inputs „Anzahl CODE“, „Notiz CODE“, „Materialbetrag 7361“.
- `#export-json`, natives `#import-json`, `#import-dialog`, `#import-preview`, `#cancel-import`, `#backup-before-import`, `#apply-import`.
- `#export-csv`, `#print`, `#print-area`, `#raw-storage`, `#storage-status`, `#action-status`.
- Fehleraktivierung zeigt expliziten Fehler, setzt Ready nicht auf `true`, lädt keine synthetischen Ersatzdaten.

Der Server kann unabhängig auf Port 0 mit `createAppServer({root: '<built-root>',basePath:'/physiotherapie/'})` gestartet werden. Browser-Automatisierung ist bewusst kein undeclared npm-Paket. Die vollständige native Interaktions-/Pixelprüfung ist ein gesondertes Abnahme-Gate; Node-HTTP-Tests sind keine Browserprüfung.

## Speicher und Wiederherstellung

Einziger eigener Schlüssel: `physiotherapie.workspace.v1`. Die Struktur enthält Schema 1, App-ID, Katalog-ID, Titel, eigene CHF/TP-Eingabe, Gesamtnotiz und eindeutige gültige Positionszeilen (Code, ganze Anzahl als String, optionalen Materialbetrag und Zeilennotiz). Alle Felder, primitiven Typen, Längen, Codes, Duplikate und Werte werden vor Preview und vor Schreiben geprüft; unbekannte Felder/Versionen/Codes werden abgelehnt statt stillschweigend entsorgt.

Keine Startup-Schreibvorgänge. Vor jedem Schreibvorgang wird der ursprünglich gelesene Rohwert verglichen. Speicherfehler und `storage`-Events sperren weitere Schreibvorgänge, nicht den Export des lokalen Entwurfs. Kein automatischer Reset, keine fremden Namespace-Writes. JSON-Preview pausiert Autospeichern erst mit der vollständig gelesenen und validierten modalen Vorschau; gültige Eingaben während des asynchronen Dateilesens werden weiterhin gespeichert. Die Speicherbasis der Übernahme wird erst beim Öffnen der Vorschau erfasst. Übernahme erfordert aktuellen Sicherungsdownload und expliziten Button, prüft den ursprünglichen Rohwert erneut und liest den neuen Zielschlüssel zur Bestätigung zurück. Ein unmittelbar anschliessender fremder Schreibvorgang bleibt eine dokumentierte Browser-Limitierung; keine atomare Mehr-Tab-Garantie.

CSV und Druck werden beim tatsächlichen Aufruf frisch aus dem aktuellen Modell berechnet, einschliesslich gerade geänderter oder gelöschter Notizen. CSV schützt Formelpräfixe auch nach führendem Whitespace. Alle Daten werden mit DOM/Textknoten gerendert, niemals als unkontrolliertes HTML. Dialoge sind native modale `dialog`-Elemente mit sichtbaren Schliessen-/Abbrechen-Aktionen und Escape-Unterstützung.
