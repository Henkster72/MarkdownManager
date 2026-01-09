# GitHub Pages Export - Schnellstart

Du willst deine Notizen online ohne Stress? Hier ist der kurze Weg.

## Was du brauchst

- Ein GitHub Repo mit diesem Projekt
- GitHub Actions aktiv
- Die Workflow Datei: .github/workflows/pages.yml (ist schon dabei)

## Schritte

1) Push zu GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Check die Workflow env:
   - MDM_EXPORT_SRC=example-notes (oder dein Notizen Ordner)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (fuer Project Pages)
4) Push auf main und warte auf den Actions Run.
5) Aufrufen: https://<user>.github.io/<repo>/.

## Base Path Tipp

Project Pages liegen unter /<repo>/. Setze MDM_EXPORT_BASE passend, sonst sind Links zickig.

## Optional: nur Published in WPM

Wenn WPM an ist und du nur Published willst:
MDM_EXPORT_PUBLISHED_ONLY=1

## Kein PAT

Keine Personal Access Tokens und kein manuelles HTML pushen. Actions macht den Job.
