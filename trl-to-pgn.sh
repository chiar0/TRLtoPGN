#!/bin/bash
# Wrapper script for trl-to-pgn.ts with better error handling

set -e

if [ "$#" -eq 0 ]; then
    echo "Usage: ./trl-to-pgn.sh -f input.trl [--white \"Player Name\"] [--black \"Player Name\"] [--debug]"
    echo ""
    echo "Examples:"
    echo "  ./trl-to-pgn.sh -f examples/TOURNAMENT_27082024-1-REF_ORIGINAL.trl"
    echo "  ./trl-to-pgn.sh -f game.trl --white \"Player 1\" --black \"Player 2\" --debug"
    exit 1
fi

echo "🔄 Converting TRL to PGN using TypeScript..."
echo "⚠️  Note: This may show experimental loader warnings (they can be ignored)"
echo ""

# Try the newer import syntax first
if node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' trl-to-pgn.ts "$@" 2>/dev/null; then
    echo "✅ Conversion completed successfully!"
else
    echo "🔄 Trying alternative execution method..."
    # Fallback to older method
    if node --loader ts-node/esm trl-to-pgn.ts "$@"; then
        echo "✅ Conversion completed successfully!"
    else
        echo "❌ TypeScript execution failed. Trying compilation approach..."
        echo "🔧 Compiling TypeScript to JavaScript..."
        if npx tsc trl-to-pgn.ts --target ES2020 --module ESNext --moduleResolution node --outDir ./temp; then
            echo "🚀 Running compiled JavaScript..."
            node ./temp/trl-to-pgn.js "$@"
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