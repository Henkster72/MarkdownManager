# Export GitHub Pages - guida rapida

Vuoi le tue note online senza stress? Ecco la strada corta.

## Cosa serve

- Un repo GitHub con questo progetto
- GitHub Actions attivo
- Il file workflow: .github/workflows/pages.yml (gia in questo repo)

## Passi

1) Push su GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Controlla le variabili del workflow:
   - MDM_EXPORT_SRC=example-notes (o la tua cartella note)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (per Project Pages)
4) Push su main e aspetta il run di Actions.
5) Apri https://<user>.github.io/<repo>/.

## Tip base path

Project Pages vive sotto /<repo>/. Imposta MDM_EXPORT_BASE o i link si rompono.

## Opzionale: WPM solo Published

Se WPM e attivo e vuoi solo Published:
MDM_EXPORT_PUBLISHED_ONLY=1

## Niente PAT

Nessun token personale e niente push HTML manuale. Actions fa il lavoro.
