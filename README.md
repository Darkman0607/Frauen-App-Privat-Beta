# Meine Frauen-App – Beta 0.1

Eigenständige private PWA zum Testen von Navigation, gynäkologischem Tagebuch, Fotoarchiv, Kalender und ersten Lernlektionen.

## WICHTIG: medizinische und Datenschutz-Grenzen
- **Testversion, keine Medizin-App.** Keine Diagnosen, keine zuverlässige Früherkennung eines Blasensprungs oder einer Frühgeburt.
- **Noch keine zusätzliche Verschlüsselung und keine PIN.** **Bitte keine echten intimen Gesundheitsbilder/Befunde speichern**, bis Schutzmechanismen implementiert und getestet sind.
- Daten bleiben im jeweiligen Browserprofil auf dem Gerät (`IndexedDB`). Kein automatischer Upload an GitHub. Dennoch können lokale Daten bei Löschung der Browserdaten verloren gehen.
- Exportierte JSON-Backups enthalten Fotos und Texte im Klartext. **Niemals Backups in ein GitHub-Repository hochladen.**
- Bei vermutetem Fruchtwasserverlust, Blutung oder Frühgeburtsanzeichen während einer Schwangerschaft unmittelbar die geburtshilfliche Ambulanz kontaktieren.

## Veröffentlichen mit GitHub Pages
1. Neues Repository erstellen (z. B. `Frauen-App-Privat-Beta`).
2. Dateien aus diesem Ordner **einzeln** in das Repository-Hauptverzeichnis hochladen; nicht den umgebenden Ordner und nicht die ZIP-Datei als einzige Datei.
3. `Settings` → `Pages` → `Build and deployment` → `Deploy from a branch` → `main` → `/(root)` → `Save`.
4. Öffnen: `https://DEIN-BENUTZERNAME.github.io/Frauen-App-Privat-Beta/`.
5. Auf Android über Chrome öffnen → Menü `⋮` → `Zum Startbildschirm hinzufügen` / `App installieren` (je nach Chrome-Version).

**Achtung:** GitHub Pages ist öffentlich erreichbar. Daher weder echte Gesundheitsdaten noch private Fotos/Backups ins Repository hochladen. Die Website sollte nur den Programmcode enthalten.

## Updates
- Oben rechts befindet sich die Updateprüfung.
- Die App lädt beim Start, wenn sie wieder in den Vordergrund kommt und während aktiver Nutzung alle fünf Minuten `version.json` neu.
- Bei neuer Version wird der Service Worker überprüft und die Seite automatisch neu geladen, sofern kein Eingabeformular geöffnet ist. In einem geöffneten Formular wird das Update zurückgestellt, um ungespeicherte Eingaben nicht zu verlieren.
- Für jedes neue Release **alle drei Versionsstellen identisch erhöhen**: `app.js` (`APP_VERSION`), `sw.js` (`CACHE`) und `version.json` (`version`). Beispiel `0.1.2`.
- GitHub muss die neuen Dateien erst via GitHub Pages veröffentlichen. Das Betriebssystem kann eine PWA nicht garantiert in einer geschlossenen App sofort aktualisieren; die Prüfung funktioniert online bei geöffneter/wiedergeöffneter App.

## Umfang der Beta
- 18 Dokumentationskategorien, Texte, Datum/Uhrzeit, Quelle, Menge, Farbe, Konsistenz, Schmerzstärke.
- Mehrere Fotos je Eintrag (bis 12 MB pro Bild), Bilder ansehen/löschen, Einträge bearbeiten/löschen.
- Monatskalender mit dokumentierten Einträgen.
- Acht kurze **Musterlektionen**, jeweils einfache und fachliche Erklärung.
- JSON-Backup Export/Import.
- Updateprüfung und installierbare PWA.

## Noch NICHT enthalten
PIN/Verschlüsselung, echte med. Quellenprüfung je Lektion, medizinisches Volllehrbuch, PDF-Befunde, Langzeit-Diagramme, automatisierte medizinische Voreinschätzung, Cloud-Synchronisierung, zuverlässige medizinische Warnlogik, automatisierte Browser-Tests.


### Prüfung und Korrektur 0.1.2
Schnellzugriff auf Formulare, Kalender-Details und Update-Start korrigiert. Keine Verschlüsselung: ausschließlich Testdaten verwenden.

## Neu in 0.1.2
- Eigene Start-Kacheln „Selbstkontrolle“ und „Krankheiten“ mit direkter Erfassung.
- Erweiterte Eingabefelder, die nur bei entsprechender Kategorie erscheinen, inklusive Temperatur/Messmethode, Krankheitsverlauf und Selbstbeobachtungs-Methode.
- Vorhandene IndexedDB-Daten bleiben erhalten (unveränderter Datenbankname und Schema).
- Keine PIN und keine Verschlüsselung; nur erfundene Testdaten verwenden.
- Keine diagnostische Bewertung oder invasive Selbstuntersuchung.
