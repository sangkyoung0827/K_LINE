## What changed

Describe the change and why it is needed.

## Required checks

- [ ] `npm run verify:browser-metadata`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Browser Safety GitHub Action passes

## Browser metadata safety

- [ ] This PR does **not** unintentionally modify `src/app/manifest.ts`, favicon/PWA/Apple icons, or `metadata.icons`.
- [ ] If browser metadata is intentionally changed, all icon dimensions/MIME types/purposes match the real files.
- [ ] Any `maskable` raster icon is square and designed for the maskable safe zone.
- [ ] Browser-metadata changes were tested on a deployment preview using a clean Chrome profile and a second browser.

## Production safety

- [ ] This PR was developed outside `main`.
- [ ] The change is reversible and does not combine unrelated production-risk changes.
