# Export GitHub Pages - guide rapide

Tu veux tes notes en ligne sans tracas? Voici le chemin court.

## Ce qu il faut

- Un repo GitHub avec ce projet
- GitHub Actions active
- Le fichier workflow: .github/workflows/pages.yml (deja dans ce repo)

## Etapes

1) Push vers GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Verifie les variables du workflow:
   - MDM_EXPORT_SRC=example-notes (ou ton dossier de notes)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (pour Project Pages)
4) Push sur main et attends le run Actions.
5) Ouvre https://<user>.github.io/<repo>/.

## Astuce base path

Project Pages vit sous /<repo>/. Regle MDM_EXPORT_BASE sinon les liens sont bizarres.

## Option: WPM uniquement Published

Si WPM est active et tu veux seulement Published:
MDM_EXPORT_PUBLISHED_ONLY=1

## Pas de PAT

Pas de token perso, pas de push HTML a la main. Actions s en occupe.
