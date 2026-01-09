# Export GitHub Pages - guia rapida

Quieres tus notas online sin drama? Aqui la ruta corta.

## Lo que necesitas

- Un repo GitHub con este proyecto
- GitHub Actions activado
- El archivo workflow: .github/workflows/pages.yml (ya viene en este repo)

## Pasos

1) Push a GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Revisa las variables del workflow:
   - MDM_EXPORT_SRC=example-notes (o tu carpeta de notas)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (para Project Pages)
4) Push a main y espera el run de Actions.
5) Abre https://<user>.github.io/<repo>/.

## Tip base path

Project Pages vive bajo /<repo>/. Ajusta MDM_EXPORT_BASE o los links se rompen.

## Opcional: WPM solo Published

Si WPM esta activo y quieres solo Published:
MDM_EXPORT_PUBLISHED_ONLY=1

## Sin PAT

Sin tokens personales y sin subir HTML a mano. Actions lo hace.
