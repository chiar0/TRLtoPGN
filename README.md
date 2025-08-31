# TRLtoPGN 🏆

A comprehensive toolkit for bi-directional conversion between Ludii trial files (.trl) and Portable Game Notation (PGN) files for chess games, with specialized support for Kriegspiel.

## 🎯 Features

- **Bi-directional conversion** between TRL and PGN formats
- **Multi-variant support**: Standard Chess and Kriegspiel
- **Multi-file processing** with automatic round handling and player name swapping

## 🚀 Quick Start

### Prerequisites

**For TypeScript version (recommended for performance):**
- Node.js 18+
- TypeScript 5+
- ts-node for direct execution

**For Python version (GUI support available):**
- Python 3.7+ (use `python3` command)
- tkinter (usually pre-installed on most systems)

### Installation

```bash
# Clone the repository
git clone https://github.com/chiar0/TRLtoPGN.git
cd TRLtoPGN

# Setup TypeScript environment (recommended)
npm install

# Python setup (no additional dependencies required)
# Built-in libraries are sufficient
```

### Clean Up

```bash
# Remove build outputs, logs, reports and roundtrip artifacts
npm run clean
```

## 📖 Usage Guide

### Web Viewer (Client-only)

The `web/` client is a single-page viewer for PGN ⇄ TRL conversion and replay. It runs entirely in the browser — no backend required.

Run locally (pick one):

```bash
# Option A: serve from repository root
python3 -m http.server 8080
# Open http://localhost:8080/web/index.html

# Option B: serve from inside web/
cd web
python3 -m http.server 8080
# Open http://localhost:8080/index.html
```

Key functionality:
- Converter: paste or open `.pgn`/`.trl`, auto-detects format, shows converted output.
- Replay: step, jump to start/end, auto-play forward/backward with speed boost on repeated clicks.
- Kriegspiel aids: illegal attempts overlay (fading arrows), umpire notes, try counters, raw move box.
- Board header: displays players and meta; click to open the inline header editor; edits apply live to PGN.
- Editor: toggle for original/converted PGN; or open the editor under the board header.
- Engine: optional Stockfish analysis via WebWorker with best-move highlight and status; respects autoplay wait at base speed.
- Share: generates a copyable link; format selectable (PGN/TRL); compression auto/none/gzip/deflate; live-updates when settings change.
- Reset: Clear returns to Auto-detect state, hides converted preview, settings, and share box; resets engine and overlays.

Structure overview:
- `web/index.html`: single entrypoint with clean markup and IDs.
- `web/src/js/main.js`: orchestrator — binds UI, calls modules.
- `web/src/js/modules/`:
	- `utils.js`: DOM helpers, type detection.
	- `game-state.js`: chess.js wrapper, move index, kriegspiel state.
	- `file-manager.js`: detect/convert PGN⇄TRL, update converted preview and info.
	- `header-manager.js`: parse/apply PGN headers; render meta bar.
	- `board-renderer.js`: board drawing and SVG overlay arrows (with drag-layer guard).
	- `engine-manager.js`: Stockfish worker loading, caching by FEN, UCI handling.
	- `compression.js`: base64url, gzip/deflate helpers for share links.
	- `ui-visibility.js`: centralized visibility rules for panels and controls.
	- `share-manager.js`: Share button UX, live URL building, auto-copy.
	- `clipboard-manager.js`: copy/download (original and converted), filename/extension handling.

Notes:
- Only one HTML entrypoint exists in the repo: `web/index.html`.
- Root landing `index.html` has been removed to avoid duplication; host should serve `web/index.html`.
- Build artifacts used by the browser live in `dist/` and `web/dist/` and are ignored by git.

Engine assets (Stockfish):
- Stockfish binaries are not committed to the repo. Populate them locally via npm after install:
	- `npm run web:vendor` to copy the vendored engine JS/WASM to `web/vendor/stockfish/`.
	- Or `npm run web:build` to compile TypeScript and vendor the engines, then copy app JS to `web/dist/`.
- The default engine is the single-thread lite build (no SharedArrayBuffer required). Other variants can be selected from the UI and will be loaded on demand.
- If you serve pages without cross-origin isolation (no COOP/COEP), avoid threaded builds; prefer the default single-thread variants.

### TypeScript Version (Recommended)

#### PGN to TRL Conversion
```bash
# Primary method with ts-node loader:
node --loader ts-node/esm pgn-to-trl.ts -f examples/TOURNAMENT_27082024-2.pgn

# Expected output:
# (node:646398) ExperimentalWarning: `--experimental-loader` may be removed in the future...
# Converting examples/TOURNAMENT_27082024-2.pgn...
# Successfully converted. TRL file saved as examples/TOURNAMENT_27082024-2.trl

# Alternative method without warnings (Node.js 18.19+):
node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' pgn-to-trl.ts -f examples/TOURNAMENT_27082024-2.pgn

# Using shell wrapper:
./pgn-to-trl.sh -f examples/TOURNAMENT_27082024-2.pgn
```

#### TRL to PGN Conversion
```bash
# Direct TypeScript execution:
node --loader ts-node/esm trl-to-pgn.ts -f examples/TOURNAMENT_27082024-1.trl --white "Magnus Carlsen" --black "Hikaru Nakamura"

# Using npm scripts:
npm run trl-to-pgn -- -f examples/TOURNAMENT_27082024-1.trl --white "Player1" --black "Player2"

# Using shell wrapper:
./trl-to-pgn.sh -f examples/TOURNAMENT_27082024-1.trl --white "Player 1" --black "Player 2"
```

**Note**: The experimental loader warning is harmless and can be safely ignored. Shell wrapper scripts provide automatic fallback compilation when direct execution fails.

### Python Version

#### GUI Mode (User-Friendly)
```bash
python3 TRLtoPGN.py
# Opens file selection dialogs and input prompts for easy operation
```

#### Command Line Interface
```bash
# Single file conversion:
python3 TRLtoPGN.py -f examples/TOURNAMENT_27082024-1.trl -o output.pgn -w "White Player" -b "Black Player"

# Multi-file tournament processing:
python3 TRLtoPGN.py -f round1.trl round2.trl round3.trl -w "Player A" -b "Player B"
# Automatically handles round numbering and player name swapping between rounds
```

### Analysis Tools

#### Semantic Comparison
```bash
# Compare TRL files for semantic accuracy:
python3 tools/semantic_compare.py new_file.trl reference_file.trl comparison_report.csv
```

#### Pattern Analysis
```bash
# Analyze move patterns and game structure:
python3 tools/analyze_patterns.py examples/TOURNAMENT_27082024-1.trl

# Compare differences between files:
python3 tools/analyze_differences.py file1.trl file2.trl
```

## 🎮 Supported Chess Variants

### Standard Chess
- Full support for all standard chess rules
- Castling, en passant, promotion
- Check and checkmate detection
- Standard algebraic notation (SAN)

### Kriegspiel (Invisible Chess)
- **Partial information** gameplay support
- **Umpire messages** for illegal moves and captures
- **Try counters** for pawn capture attempts
- **Hidden piece positions** and limited information rules

## 🤝 Contributing

Contributions are welcome! Open an issue or submit a pull request.

---

**Made with ❤️ for chess and AI enthusiasts**
