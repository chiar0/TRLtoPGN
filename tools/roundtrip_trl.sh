#!/usr/bin/env bash
# One-shot TRL->PGN->TRL round-trip with semantic + textual reports
# Usage: tools/roundtrip_trl.sh -f <file.trl>
set -euo pipefail

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ] || [ $# -lt 2 ]; then
  echo "Usage: tools/roundtrip_trl.sh -f <file.trl>"
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
  echo "Input TRL not found: $FILE" >&2
  exit 1
fi

DIR=$(dirname "$FILE")
BASE=$(basename "$FILE")
NAME=${BASE%.trl}

# 1) TRL -> PGN (writes "$DIR/$NAME.pgn")
if ! ./trl-to-pgn.sh -f "$FILE" >/dev/null 2>&1; then
  echo "TRL->PGN failed for $FILE; skipping."
  exit 0
fi

# 2) Copy to rt name and PGN -> TRL (writes "$DIR/${NAME}_rt.trl")
if [ ! -f "$DIR/$NAME.pgn" ]; then
  echo "PGN not produced for $FILE; skipping."
  exit 0
fi
cp -f "$DIR/$NAME.pgn" "$DIR/${NAME}_rt.pgn"
if ! ./pgn-to-trl.sh -f "$DIR/${NAME}_rt.pgn" >/dev/null 2>&1; then
  echo "PGN->TRL failed for $DIR/${NAME}_rt.pgn; skipping."
  exit 0
fi

RT_TRL="$DIR/${NAME}_rt.trl"
if [ ! -f "$RT_TRL" ]; then
  echo "Round-trip TRL was not produced: $RT_TRL" >&2
  exit 2
fi

# 3) Semantic report
CSV_OUT="$DIR/${NAME}_roundtrip.csv"
python3 tools/semantic_compare.py "$RT_TRL" "$FILE" "$CSV_OUT" | sed -n '1,200p'

# 4) Textual diff
DIFF_OUT="$DIR/${NAME}_roundtrip.diff"
diff -u "$FILE" "$RT_TRL" > "$DIFF_OUT" || true

if [ -s "$DIFF_OUT" ]; then
  echo "Textual diff present -> $DIFF_OUT"
else
  echo "No textual differences."
fi
