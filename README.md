# SZZX BP Academic Resources Base

This repository hosts a static academic resource library for SZZX BP learning materials. The site reads `resources.json`, shows resources by subject, and links every preview/download action to files stored in this GitHub repository.

Live site after GitHub Pages deployment:

https://sma084545-pixel.github.io/bp-/

## Project Structure

```text
/
├── index.html
├── README.md
├── upload-report.md
├── resources.json
├── assets/
│   ├── icons/
│   ├── scripts/app.js
│   └── styles/main.css
├── scripts/
│   └── generate-resources-manifest.js
└── resources/
    ├── Biology/
    ├── Chemistry/
    ├── Economics/
    └── Physics/
```

## Updating Resources

1. Add or update files in the local source folder:

```bash
/Users/maxiao/Desktop/resources base
```

2. Regenerate the organized repository copy and manifest:

```bash
node scripts/generate-resources-manifest.js
```

If `node` is not available in your shell, use the bundled Codex runtime:

```bash
/Users/maxiao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/generate-resources-manifest.js
```

3. Review `upload-report.md` for skipped files, sensitive filename matches, and large-file warnings.

4. Commit and push:

```bash
git add .
git commit -m "Update academic resources"
git push origin main
```

## Manifest

`resources.json` is generated automatically. Each resource includes:

- `title`
- `category`
- `fileType`
- `fileSize`
- `originalFilename`
- `downloadUrl`
- `previewUrl`
- `description`

All URLs are GitHub-hosted URLs, not local desktop paths.

## GitHub Pages Deployment

This repo includes `.github/workflows/pages.yml`, which deploys the static site through GitHub Actions. After pushing to `main`, check the repository Actions tab. When the workflow completes, the site should be available at:

https://sma084545-pixel.github.io/bp-/

If GitHub Pages is not enabled yet, open the repository settings and set Pages to use GitHub Actions as the source.

## File Safety Rules

The generator skips hidden/system files such as `.DS_Store`, temporary files, dependency folders, and filenames that appear to contain secrets or private identity documents. It does not delete, move, or modify the original desktop source folder.
