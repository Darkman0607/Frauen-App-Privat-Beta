# Frauen-App Beta 0.1.9.6 (Render- & Cache-Fix)

Update auf 0.1.9.6 (Build 20):
- **Behebung des weißen Bildschirms / alter Version:**
  - `index.html` wird ab sofort vom Service Worker **niemals mehr gecached** (`no-store`), sondern immer direkt frisch von GitHub geladen.
  - Automatisches Bereinigen und Neu-Registrieren des Service Workers beim App-Start.
- **Enthält alle 69 Fachlektionen**, Schautafeln, Themen-Kacheln, Tagebuch-Redesign und Kalender-Icons.
