# Frauen-App Beta 0.1.8.6 (Cache- & Update-Fix)

Update von 0.1.8.5 auf 0.1.8.6 (Build 10):
- **Wichtigster Fix (Kein Zurückfallen mehr auf alte Versionen):**
  - `sw.js` nutzt ab sofort eine strikte **Network-First-Strategie** für HTML, Skripte und Stylesheets. Wenn online, holt der Browser immer die frischeste Version von GitHub statt veraltete Offline-Caches zu verwenden.
  - Automatisches Löschen aller alten Caches bei Versionssprung (`caches.delete`).
  - `SKIP_WAITING` aktiviert neue Service Worker sofort ohne Neustart-Warteschleife.
- **Enthält alle Neuerungen aus den letzten Updates:**
  - Redesign der **Neuen Beobachtung**: 4 strukturierte Sektionen, Schieberegler für Schmerz (0–10 mit Farbwechsel), 2 Spalten für Kriterien.
  - Neues Fotosystem: **Direkt Kamera öffnen** (`📷`) oder **Galerie** (`🖼️`) mit Kachel-Vorschau und individuellem Lösch-Button (`✕`).
  - Umfassende **Hebammen-Fachlektionen**: Vaginale Untersuchung (VU) mit Intimsphäre-Abdeckung, Spekulum-Anwendung bei Periode, Zervixschleim-Spinnbarkeit (NFP), Ausfluss-Unterscheidung.
  - 12 anklickbare medizinische Schautafeln mit Vollbild-Zoom (Lightbox).
- **Datenbankschutz:** Die verschlüsselte lokale Datenbank bleibt 100 % erhalten.
