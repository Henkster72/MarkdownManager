# GitHub Pages export - quick tutorial

Want your notes online with zero drama? Here is the short path.

## What you need

- A GitHub repo with this project
- GitHub Actions enabled
- The workflow file: .github/workflows/pages.yml (already in this repo)

## Steps

1) Push to GitHub.
2) Settings -> Pages -> Source = GitHub Actions.
3) Check the workflow env:
   - MDM_EXPORT_SRC=example-notes (or your notes folder)
   - MDM_EXPORT_DIR=dist
   - MDM_EXPORT_BASE=/YourRepoName/ (for project pages)
4) Push to main and wait for the Actions run.
5) Open https://<user>.github.io/<repo>/ and enjoy.

## Base path tip

Project Pages live under /<repo>/. Set MDM_EXPORT_BASE to match or your links will look sad.

## Optional: WPM only

If WPM is on and you want only Published pages:
MDM_EXPORT_PUBLISHED_ONLY=1

## No PAT

No personal access tokens and no manual HTML commits. Actions does the lifting.
