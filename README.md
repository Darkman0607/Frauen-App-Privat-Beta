# Frauen-App Beta 0.1.8.5 (Redesign Neue Beobachtung)

Update von 0.1.8.4 auf 0.1.8.5 (Build 9):
- **Komplettes Redesign des Formulars „Neue Beobachtung / Eintrag bearbeiten“:**
  - `Klare 4-Sektionen-Struktur:`
    1. Kategorie & Zeitpunkt (übersichtliches 2-Spalten-Raster).
    2. Körperliche Kriterien (Quelle, Menge, Farbe, Konsistenz) plus interaktiver Schieberegler für Schmerz/Spannung mit dynamischem Farbwechsel.
    3. Ausführliche Notizen & Beobachtungen.
    4. Fotos & Befundbilder.
  - `Optimiertes Foto-System:`
    - Getrennter Button **„📷 Direkt Foto aufnehmen“** (öffnet direkt die Smartphone-Kamera über `capture="environment"`).
    - Getrennter Button **„🖼️ Aus Galerie wählen“** für mehrere Fotos gleichzeitig.
    - Kachel-Vorschau mit rotem **✕-Löschbutton** pro Bild vor dem Speichern.
    - Mehrfachauswahl bleibt erhalten (akkumulativ).
- **Interne Qualitätskontrolle:** Alle Tags, CSS, SVGs und JS-Klammern geprüft. Datenbank und bestehende Einträge bleiben zu 100 % erhalten.
