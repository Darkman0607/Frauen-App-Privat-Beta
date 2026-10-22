# Frauen-App Beta 0.1.6 – Build 2, lokale Verschlüsselung

- Lokale Daten und Fotos: AES-256-GCM mit je neuem IV und datensatzgebundener Authentifizierung.
- Passwortableitung: PBKDF2/SHA-256, 350.000 Iterationen, zufälliges Salt.
- Verschlüsseltes Google-Drive-Backup bleibt erhalten.
- Kein Fingerabdruck, keine zusätzliche PIN. Ein **Datenpasswort bei jedem Start** ist für echte lokale Verschlüsselung erforderlich.
- Bei erstmaligem Start wandelt die App vorhandene unverschlüsselte IndexedDB-Einträge in **einer atomaren Transaktion** um. Sichere vorher eine Backup-Datei aus 0.1.5 / Build 1.
- Achtung: Ein verlorenes Datenpasswort kann nicht zurückgesetzt werden. Schon zuvor im Browser gespeicherte Daten können in alten Gerätebackups / Speicherbereichen verbleiben.
- Die Daten sind im entschlüsselten Zustand während der App-Nutzung im Arbeitsspeicher zugänglich. Kein Schutz gegen kompromittierte Geräte oder manipulierten App-Code auf GitHub.
- Teste mit Testdaten, prüfe Foto-Speicherung, App-Neustart, Backup, Wiederherstellung und Updates vor Einsatz mit echten Gesundheitsdaten.

Build 3: Bei zu kurzem/abweichendem Passwort oder fehlgeschlagenem Entsperren erscheint ein Wiederholen-Button statt einer unbedienbaren leeren Ansicht. Kein Löschen von Daten.

## Build 4 – Datenpasswort direkt in der App
Beim ersten Start erscheinen zwei Eingabefelder (Passwort erstellen und wiederholen). Bei späterem Start wird das bestehende Datenpasswort abgefragt. Die Datenbank und Verschlüsselungsparameter bleiben unverändert. Nach einem ungültigen Passwort kann die Eingabe erneut geöffnet werden. Kein Fingerabdruck. Vor der Migration bestehender Daten Backup anlegen; ausschließlich mit Testdaten erproben.
