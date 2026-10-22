# Daten, Quelle und fachliche Grenzen

## Amtlicher Umfang

Quelleinstieg: [BAG – Leistungen: Physiotherapie](https://www.bag.admin.ch/de/leistungen-physiotherapie).

Verwendet wird ausschliesslich der dort tatsächlich verlinkte [Anhang: Tarifstruktur für physiotherapeutische Leistungen, gültig ab 1.1.2026](https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/oce/2025/68/de/pdf-a/fedlex-data-admin-ch-eli-oce-2025-68-de-pdf-a.pdf), 7 PDF-Seiten, 139930 Bytes, SHA-256 `d10462e61e5aa6594660dfa6e04d5085aa417caa7f2a54d0c8781e87278936a9`.

Die BAG-Seite erläutert: Die Totalrevision regelt ab 1. Januar 2026 nur noch die Physiotherapie, neu nach Artikel 2. Diese **formale Revision verändert die am 1. Januar 2018 in Kraft getretene Tarifstruktur inhaltlich nicht**. Die App behauptet weder neue Preise noch einen einheitlichen aktuellen kantonalen CHF-Satz. Der PDF-Verweis auf die Verordnung vom 30. April 2025 ist kein gesondert belegtes Publikationsdatum des PDF; dieses bleibt unbekannt. Abrufzeit, Gültigkeitsdatum und Publikationsdatum sind getrennte Metadaten.

| Quellbereich | Codes | Basis |
| --- | --- | --- |
| 1.1 / Detail 2: Sitzungspauschalen | 7301, 7311, 7313, 7330, 7340 | 48, 77, 77, 25, 22 TP |
| 1.2 / Detail 3: Zuschlagspositionen | 7350, 7351, 7352, 7353, 7354 | 24, 30, 19, 67, 34 TP |
| 1.2 / Detail 3: Behandlungsmaterial | 7361 | Einkaufspreis, keine numerische TP-Vorgabe |
| 1.3 / abschliessende Tabelle: Inkontinenzmaterial | 7362, 7363 | fixe CHF 50.00 und CHF 90.00 |

Vollständigkeit bezieht sich auf diese gesamte amtliche KVG-Struktur, nicht auf andere Versicherungsbereiche (UV/MV/IV), kantonale Verträge oder weitergehende Anspruchsregeln. Kein Herstellerkatalog oder geschütztes Einstufungsinstrument wurde übernommen.

## Vollständige Regeln statt Kuratierung

- PDF S. 2: alle vier einleitenden Bemerkungen; eine Sitzungspauschale pro Therapiesitzung, zweimal pro Tag nur unter den ausdrücklich genannten Voraussetzungen, aufgeteilte Behandlung, Kombinationsregeln.
- PDF S. 3: komplette Übersicht und Quelltaxonomie.
- PDF S. 4–7: sämtliche 13 Detailpositionen mit vollständigen Originalregeln, einschliesslich Fortsetzungen 7311 (S. 4–5) und 7350 (S. 5–6).
- Der gemeinsame Regelblock für 7362/7363 wird bei beiden Positionen angezeigt. Einmaligkeit pro Kalenderjahr und Nichtkumulierbarkeit sind nicht verloren gegangen.
- Erlaubte Zuschläge werden aus der rechten Quellspalte übernommen; die umgekehrte Zuordnung zu Sitzungspauschalen ist ausdrücklich als abgeleitet benannt. Referenzen im Fliesstext werden nicht als zusätzliche Erlaubnis interpretiert.

`catalog.json` bewahrt literale Codes, Originaltitel, Quellhierarchie, Typen, Seiten und vollständige Texte. Layoutbedingte Zeilenumbrüche und Trennstriche aus dem PDF bleiben erhalten; es handelt sich nicht um redaktionell verkürzte Texte. `import-report.json` verzeichnet 13 Positionen, 10 TP-Werte, 2 Fixbeträge, 1 offenen Einkaufspreis, 0 fehlende Regeltexte, 0 Übersicht-/Detailpreisabweichungen und 0 ungelöste Kombinationsreferenzen.

## Rechenbasis

Kantonale Taxpunktwerte werden von Tarifpartnern verhandelt und zuständigen kantonalen Behörden genehmigt. Hier wurde keine vollständige aktuelle amtliche kantonale Wertetabelle verifiziert: **alle Werte sind standardmässig unbekannt**. Der CHF/TP-Wert ist ausschliesslich eine eigene Szenarioeingabe (bis 6 Dezimalstellen).

Anzahlen sind ganze Zahlen 1–999999, Dezimaleingaben bis 9 Vorkommastellen; Materialbeträge höchstens 2 Nachkommastellen. Interne Rechnung über BigInt, keine binäre Gleitkomma-Geldrechnung. Bei TP-Zeilen wird `Anzahl × TP × CHF/TP` pro kompletter Zeile kaufmännisch auf 0.01 CHF gerundet; erst danach summiert. Fixe CHF-Pauschalen und selbst erfasste Einkaufspreise werden ohne TPW berechnet. Keine 5-Rappen-Barrundung. Unbekannt, fehlend und ausdrücklich eingegebene Null sind verschieden.

Die Oberfläche prüft keine vollständige Fallkombination, Frequenz, Anzahl verschriebener Sitzungen, Alter, Kalenderjahre, Rezidive, Zeit seit letzter Behandlung, Kostengutsprache oder medizinische Indikation. Mengen können bewusst Rechenvergleiche mehrerer Fälle darstellen. Vollständige Regeln sind daher sichtbar verfügbar; eine Warnung ist keine automatische Freigabe.

## Herkunft und Nutzungsbefund

Der veröffentlichte Datenbestand stammt aus einem amtlichen Verordnungsanhang nach Art. 2 der Verordnung über die Festlegung von Tarifstrukturen in der Krankenversicherung (SR 832.102.5). [Art. 5 Abs. 1 Bst. a URG](https://www.fedlex.admin.ch/eli/cc/1993/1798_1798_1798/de#art_5) nimmt Gesetze, Verordnungen und andere amtliche Erlasse vom urheberrechtlichen Schutz aus. Auf dieser Grundlage werden die normativen Tarifdaten und Regeln abgeleitet veröffentlicht. Dies ist keine allgemeine Weiterverwendungslizenz für BAG-Webseiten, Logos, andere Kataloge oder Drittanbieterprogramme. Die App ist nicht amtlich und enthält keine amtlichen Logos. Der zusätzliche Abruf der allgemeinen admin.ch-Rechtliches-Seite war technisch blockiert (403); daraus wurde keine Lizenz abgeleitet.

Roh-PDF und rohe BAG-Seite bleiben ausschliesslich in ignoriertem `sources/`; öffentlich sind nur `catalog.json`, `provenance.json`, `import-report.json` und die App-Dateien. Keine privaten Sammlungen, Roh-HTML-Kopien, Exporte oder Patientendaten gehören zum Build. Vollständige URLs, Bytezahlen, SHA-256 und tatsächliche Abrufzeit stehen in `provenance.json`.

## Reproduzierbarkeit

`scripts/acquire_sources.py` archiviert zuerst die tatsächlichen Originalbytes und ihren Quellenmanifest. `scripts/import_catalog.py` prüft alle Manifest-Hashes sowie den fest gepinnten PDF-Hash, extrahiert alle Seiten mit `pdftotext -layout`, prüft Übersichts- und Detailcodes/-werte und erzeugt die drei JSON-Dateien deterministisch aus diesem Capture. Die erneute Beschaffung ist kein deterministischer Snapshot der veränderlichen BAG-Webseite; der Reimport aus dem **gleichen** gesicherten Manifest ist reproduzierbar.
