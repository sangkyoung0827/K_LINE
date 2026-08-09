# K_LINE Repository Safety Rules

These rules are mandatory for Codex and other coding agents working in this repository.

## Production workflow

- Do not push routine feature or design work directly to `main`.
- Use a separate branch and pull request for non-emergency changes.
- Before merge, run `npm run check` and require the Browser Safety workflow to pass.
- Emergency hotfixes to `main` should be minimal, reversible, and followed by a normal PR that restores the standard workflow.

## Browser metadata is a protected surface

The following files and settings can affect the browser process, PWA installation metadata, OS icons, caches, and launch behavior. Treat them separately from normal visual design:

- `src/app/manifest.ts`
- the `metadata.icons`, `manifest`, and `appleWebApp` settings in `src/app/layout.tsx`
- `public/favicon.svg`
- `public/k-line-mark.svg`
- any future favicon, Apple touch icon, manifest icon, or maskable icon

Do not modify those files merely because the visible K_LINE logo or branding changes.

The visible site logo belongs in UI components/assets such as `src/components/Logo.tsx` and may change without changing browser/PWA metadata.

## Icon safety contract

- Keep `/favicon.svg` as the normal browser icon unless there is an explicit browser-metadata migration.
- Keep `/k-line-mark.svg` as the Apple/maskable app mark unless there is an explicit browser-metadata migration.
- Never declare a non-square raster image as a PWA or maskable icon.
- Raster manifest icons must declare their real pixel dimensions exactly.
- A `maskable` icon must be designed for maskable safe zones; do not add `purpose: "maskable"` to an arbitrary logo image.
- Do not use `/images/k-line-official-logo.png` as favicon, Apple icon, or manifest icon.

If an intentional browser icon migration is requested, update the validator in `scripts/verify-browser-metadata.mjs` in the same PR and document the browser tests performed.

## Required validation

Run all of the following before merge:

```bash
npm run verify:browser-metadata
npm test
npm run build
```

For any change touching browser metadata, also test the deployment preview in a clean Chrome profile and at least one second browser before production merge.
