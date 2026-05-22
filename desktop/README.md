# AEGIS Desktop (Beta)

Native shell around the AEGIS web app. Loads `https://aegis-v1-0.onrender.com`
inside a chrome-less Electron window with a custom splash screen, single-instance
guarding, friendly offline error page and external link handling.

## Run from source

```bash
cd desktop
npm install
npm start                       # connects to production
npm run dev                     # connects to http://localhost:3000
```

## Build installers

```bash
npm install
npm run build:win               # → dist/AEGIS-Setup-1.0.0-beta.1-x64.exe
npm run build:linux             # → dist/AEGIS-1.0.0-beta.1-x64.AppImage
                                #   dist/AEGIS-1.0.0-beta.1-x64.deb
npm run build                   # everything that can be built on the host OS
```

> Note: cross-building Windows installers from Linux requires Wine; cross-
> building macOS DMGs requires a Mac. The simplest path is to run each
> target on its native OS, or use a CI matrix.

## Files

- `main.js` — main process (window, menu, splash, error fallback)
- `preload.js` — empty isolated preload
- `splash.html` — boot screen shown while the remote URL loads
- `electron-builder.yml` — packaging configuration
- `icons/` — app icons (`.svg` source, `.png` 512px, `.ico` Windows)

## Customise

- `AEGIS_URL` env var picks the URL the shell loads.
- `electron-builder.yml` controls installer metadata, file associations,
  shortcut names.
- `icons/icon.svg` is the source — regenerate the PNG/ICO with
  `convert -background none -resize 512x512 icon.svg icon.png`.
