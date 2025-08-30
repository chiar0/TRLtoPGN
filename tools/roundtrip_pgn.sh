#!/usr/bin/env bash
# One-shot PGN->TRL->PGN round-trip with textual report
# Usage: tools/roundtrip_pgn.sh -f <file.pgn>
set -euo pipefail

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] || [ $# -lt 2 ]; then
  echo "Usage: tools/roundtrip_pgn.sh -f <file.pgn>"
  exit 1
fi

FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -f|--file) FILE="$2"; shift 2; ;;
    *) echo "Unknown arg: $1"; exit 1; ;;
  esac
done

if [ ! -f "$FILE" ]; then
  echo "Input PGN not found: $FILE" >&2
  exit 1
fi

DIR=$(dirname "$FILE")
BASE=$(basename "$FILE")
NAME=${BASE%.pgn}

# 1) PGN -> TRL (writes "$DIR/$NAME.trl")
./pgn-to-trl.sh -f "$FILE" >/dev/null

# 2) Copy to rt name and TRL -> PGN (writes "$DIR/${NAME}_rt.pgn")
cp -f "$DIR/$NAME.trl" "$DIR/${NAME}_rt.trl"
./trl-to-pgn.sh -f "$DIR/${NAME}_rt.trl" >/dev/null

RT_PGN="$DIR/${NAME}_rt.pgn"
DIFF_OUT="$DIR/${NAME}_roundtrip_pgn.diff"

diff -u "$FILE" "$RT_PGN" > "$DIFF_OUT" || true

if [ -s "$DIFF_OUT" ]; then
  echo "Textual diff present -> $DIFF_OUT"
else
  echo "No textual differences."
fi
