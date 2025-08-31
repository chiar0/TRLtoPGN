#!/bin/bash
# Quick usage examples for TRLtoPGN

echo "🏆 TRLtoPGN - Quick Usage Examples"
echo "=================================="
echo

echo "📝 TypeScript Version (Recommended - Reliable Shell Wrappers):"
echo "  PGN → TRL: ./pgn-to-trl.sh -f examples/TOURNAMENT_27082024-1-REF_ORIGINAL.pgn"
echo "  TRL → PGN: ./trl-to-pgn.sh -f examples/TOURNAMENT_27082024-1-REF_ORIGINAL.trl"
echo "  OR Direct: node --loader ts-node/esm pgn-to-trl.ts -f examples/TOURNAMENT_27082024-1-REF_ORIGINAL.pgn"
echo "  OR via npm: npm run pgn-to-trl -- -f examples/TOURNAMENT_27082024-1-REF_ORIGINAL.pgn"
echo

echo "🐍 Python Version:"
echo "  GUI Mode:  python3 TRLtoPGN.py"
echo "  CLI Mode:  python3 TRLtoPGN.py -f examples/TOURNAMENT_27082024-1-REF_ORIGINAL.trl -w 'Player 1' -b 'Player 2'"
echo

echo "🔍 Analysis Tools:"
echo "  Semantic Compare: python3 tools/semantic_compare.py file1.trl file2.trl report.csv"
echo "  Pattern Analysis: python3 tools/analyze_patterns.py input.trl"
echo

echo "🚀 Quick Tests:"
echo "  Test Python:  npm run test:python"
echo "  Test Semantic: npm run test:semantic"
echo "  Full Test:    npm test"
echo

echo "📁 Project Structure:"
echo "  pgn-to-trl.ts     - Main TypeScript PGN→TRL converter"
echo "  trl-to-pgn.ts     - TypeScript TRL→PGN converter"
echo "  TRLtoPGN.py       - Python TRL→PGN converter (legacy)"
echo "  tools/            - Analysis utilities"
echo "  examples/         - Sample files for testing"
echo

echo "For more information, see README.md"