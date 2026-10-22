# Meine Frauen-App – Beta 0.1.5

Eigenständige GitHub-Pages-PWA. Lade alle zehn Dateien direkt ins Repository-Hauptverzeichnis hoch; nicht die ZIP-Datei.

## Neu
- 10 ausführlichere Fach- und Praxislektionen (zusätzlich zu 50 bestehenden Grundlagenlektionen) mit Schrittfolgen, Quellen und lokaler Fortschrittsmarkierung.
- Unter **Akte**: „Backup für Google Drive teilen“ öffnet bei kompatiblen Android-Geräten das systemeigene Teilen-Menü. Dort **Google Drive** auswählen und Datei speichern. Als Fallback wird die Datei heruntergeladen.
- **Wiederherstellen:** In Google Drive das JSON-Backup herunterladen; in der App unter Akte die Datei auswählen. Vorher unbedingt ein weiteres Backup erstellen, denn der Import ersetzt lokale Daten.

## Wichtige Grenzen
- Keine direkte OAuth-Verbindung, kein Live-Sync und keine automatische Drive-Sicherung.
- Backup-Dateien sind **unverschlüsselt**; deshalb weiterhin nur Testdaten verwenden. Nicht in ein öffentliches GitHub-Repository hochladen.
- Die App ist keine medizinische Diagnostik oder Hebammenausbildung. Bei vermutetem Fruchtwasserverlust in einer Schwangerschaft sofort geburtshilfliche Abklärung.

## Versionsstand
0.1.5 Build 1. Die bisherige IndexedDB-Datenbank wurde nicht verändert. Vollständiger Android-Test ausstehend.
