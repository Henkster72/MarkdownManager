# GitHub Pages export - snelle handleiding

Wil je je notities online zonder gedoe? Dit is de korte route.

## Wat je nodig hebt

- Een GitHub repo met dit project
- GitHub Actions aan
- Het workflow bestand: .github/workflows/pages.yml (staat al in deze repo)

## Stappen

1) Push naar GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Check de workflow env:
   - MDM_EXPORT_SRC=example-notes (of jouw notities map)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (voor project pages)
4) Push naar main en wacht op de Actions run.
5) Open https://<user>.github.io/<repo>/ en klaar.

## Base path tip

Project Pages draaien onder /<repo>/. Zet MDM_EXPORT_BASE goed, anders werken links minder leuk.

## Optioneel: alleen Published in WPM

Als WPM aan staat en je alleen Published wil:
MDM_EXPORT_PUBLISHED_ONLY=1

## Geen PAT

Geen personal access tokens en geen handmatig HTML pushen. Actions doet het werk.
