# TRL ⇄ PGN Viewer — Web App

This is the single-page web client for viewing and converting PGN ⇄ TRL. The original monolithic file has been refactored into small, maintainable modules.

## Directory Structure

```
web/
├── index.html            # Single HTML entrypoint
├── build.sh              # Simple build helper (optional)
├── src/
│   ├── styles/           # Modular CSS
│   └── js/               # Modular JavaScript
│       ├── main.js       # App orchestrator
│       └── modules/      # Feature modules
│           ├── utils.js
│           ├── compression.js
│           ├── game-state.js
│           ├── header-manager.js
│           ├── board-renderer.js
│           ├── file-manager.js
│           ├── engine-manager.js
│           ├── ui-visibility.js
│           ├── share-manager.js
│           └── clipboard-manager.js
├── dist/                 # Optional combined assets (ignored by git)
├── vendor/stockfish/     # Vendored engine builds (ignored by git)
└── shims/                # Node shims (if needed)
```

## Run Locally

Serve the app with any static server. Two common options:

```bash
# From repo root
python3 -m http.server 8080
# Open http://localhost:8080/web/index.html

# Or from web/
cd web
python3 -m http.server 8080
# Open http://localhost:8080/index.html
```

## Stockfish Engines

- Engine binaries (JS/WASM) are not committed. Populate them locally:

```bash
npm install
npm run web:vendor   # copies Stockfish builds into web/vendor/stockfish/

# Optional full build
npm run web:build    # compile TS + vendor engines + copy dist to web/dist
```

- Default engine is the single-thread lite build (works without SharedArrayBuffer).
- You can switch variants from the UI; only the selected variant is fetched.
- If your server is not cross-origin isolated (no COOP/COEP), avoid threaded builds; keep single-thread variants.

## Build (Optional)

The app works with ES modules directly. If you prefer a combined HTML/CSS/JS:

```bash
cd web
./build.sh
# Use files in web/dist/
```

## Deploy (GitHub Pages)

- Pages is deployed by GitHub Actions (`.github/workflows/pages.yml`).
- It runs `npm run web:build`, then publishes the contents of `web/` as `docs/` artifact.
- `docs/` is git-ignored; you don't need to commit it.

## Developer Notes

- ES modules for JS and modular CSS for maintainability.
- No backend required; everything runs client-side.
- Designed to integrate with modern bundlers if desired (Vite/Webpack).