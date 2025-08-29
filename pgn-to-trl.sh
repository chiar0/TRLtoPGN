#!/bin/bash
# Wrapper script for pgn-to-trl.ts with better error handling

set -e

if [ "$#" -eq 0 ]; then
    echo "Usage: ./pgn-to-trl.sh -f input.pgn [--white \"Player Name\"] [--black \"Player Name\"]"
    echo ""
    echo "Examples:"
    echo "  ./pgn-to-trl.sh -f examples/TOURNAMENT_27082024-1.pgn"
    echo "  ./pgn-to-trl.sh -f game.pgn --white \"Magnus Carlsen\" --black \"Garry Kasparov\""
    exit 1
fi

echo "🔄 Converting PGN to TRL using TypeScript..."
echo "⚠️  Note: This may show experimental loader warnings (they can be ignored)"
echo ""

# Try the newer import syntax first
if node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' pgn-to-trl.ts "$@" 2>/dev/null; then
    echo "✅ Conversion completed successfully!"
else
    echo "🔄 Trying alternative execution method..."
    # Fallback to older method
    if node --loader ts-node/esm pgn-to-trl.ts "$@"; then
        echo "✅ Conversion completed successfully!"
    else
        echo "❌ TypeScript execution failed. Trying compilation approach..."
        echo "🔧 Compiling TypeScript to JavaScript..."
        if npx tsc pgn-to-trl.ts --target ES2020 --module ESNext --moduleResolution node --outDir ./temp; then
            echo "🚀 Running compiled JavaScript..."
            node ./temp/pgn-to-trl.js "$@"
            rm -rf ./temp
            echo "✅ Conversion completed successfully!"
        else
            echo "❌ All TypeScript execution methods failed."
            echo ""
            echo "💡 Alternative: Use the Python version instead:"
            echo "   python3 TRLtoPGN.py --help"
            echo ""
            echo "   For TRL → PGN conversion:"
            echo "   python3 TRLtoPGN.py -f input.trl -w \"White Player\" -b \"Black Player\""
            exit 1
        fi
    fi
fi