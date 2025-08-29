# TRLtoPGN 🏆

A comprehensive toolkit for bi-directional conversion between Ludii trial files (.trl) and Portable Game Notation (PGN) files for chess games, with specialized support for Kriegspiel.

## 🎯 Features

- **Bi-directional conversion** between TRL and PGN formats
- **Multi-variant support**: Standard Chess and Kriegspiel
- **Multi-file processing** with automatic round handling and player name swapping

## 🚀 Quick Start

### Prerequisites

**For TypeScript version (recommended for performance):**
- Node.js 16+ 
- TypeScript 4.5+
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

## 📖 Usage Guide

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

## 📄 License

GPL-3.0 – see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for chess and AI enthusiasts**
