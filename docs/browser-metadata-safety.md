# Browser Metadata Safety

## Why this exists

On 2026-08-09, K_LINE recovered from a Chrome browser-process crash after reverting a browser/PWA icon metadata change. The visual site logo had been reused as favicon, Apple icon, and a `maskable` manifest icon even though the raster asset was not square.

Browser-facing metadata is therefore treated as a production-sensitive surface, separate from normal UI branding.

## Protected files

- `src/app/manifest.ts`
- browser icon settings in `src/app/layout.tsx`
- `public/favicon.svg`
- `public/k-line-mark.svg`

## Default safe configuration

- Browser/favicon: `/favicon.svg`
- Apple/maskable mark: `/k-line-mark.svg`
- Both SVG assets use a square viewBox.
- `/images/k-line-official-logo.png` is a visual brand asset only and is not browser/PWA metadata.

## Change procedure

1. Make the change on a branch, never as routine direct work on `main`.
2. Keep visual branding changes separate from browser metadata changes.
3. For raster manifest icons, use square files and declare the exact real pixel dimensions.
4. Only mark an icon `maskable` when it was designed for the maskable safe zone.
5. Run `npm run check`.
6. Test a deployment preview with a clean Chrome profile and a second browser.
7. Merge only after the Browser Safety status check passes.

If the browser icon contract intentionally changes, update `scripts/verify-browser-metadata.mjs` in the same reviewed PR.
