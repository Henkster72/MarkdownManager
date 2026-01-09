# Export GitHub Pages - guia rapido

Queres as tuas notas online sem drama? Aqui vai o caminho curto.

## O que precisas

- Um repo GitHub com este projeto
- GitHub Actions ativo
- O ficheiro workflow: .github/workflows/pages.yml (ja vem neste repo)

## Passos

1) Push para GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Verifica as variaveis do workflow:
   - MDM_EXPORT_SRC=example-notes (ou a tua pasta de notas)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (para Project Pages)
4) Push para main e espera o run do Actions.
5) Abre https://<user>.github.io/<repo>/.

## Dica base path

Project Pages fica em /<repo>/. Define MDM_EXPORT_BASE ou os links falham.

## Opcional: WPM so Published

Se WPM esta ativo e queres so Published:
MDM_EXPORT_PUBLISHED_ONLY=1

## Sem PAT

Sem token pessoal e sem push manual de HTML. Actions trata disso.
