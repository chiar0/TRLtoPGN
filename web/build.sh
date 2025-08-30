#!/bin/bash
# Build script per combinare i file CSS e JS modulari nell'HTML monolitico originale

echo "Building TRL Viewer..."

# Directory paths
SRC_DIR="./src"
STYLES_DIR="$SRC_DIR/styles"
JS_DIR="$SRC_DIR/js"
DIST_DIR="./dist"

# Create dist directory if it doesn't exist
mkdir -p "$DIST_DIR"

# Combine all CSS files
echo "Combining CSS files..."
cat "$STYLES_DIR/variables.css" \
    "$STYLES_DIR/base.css" \
    "$STYLES_DIR/header.css" \
    "$STYLES_DIR/layout.css" \
    "$STYLES_DIR/panels.css" \
    "$STYLES_DIR/forms.css" \
    "$STYLES_DIR/controls.css" \
    "$STYLES_DIR/board.css" \
    "$STYLES_DIR/moves.css" \
    "$STYLES_DIR/ui-elements.css" \
    "$STYLES_DIR/meta.css" > "$DIST_DIR/combined.css"

# Copy the canonical HTML to dist (placeholder step)
echo "Copying HTML entrypoint..."
cp "index.html" "$DIST_DIR/index.html"

# Note: Per ricostruire il file originale monolitico, sarebbe necessario:
# 1. Inline tutto il CSS combinato nel tag <style>
# 2. Inline tutto il JavaScript nel tag <script type="module">
# 3. Rimuovere i riferimenti ai file esterni

echo "Build complete! Files created in $DIST_DIR/"
echo ""
echo "Entrypoint: index.html (modularizzato)"
echo "Per produzione, usa: $DIST_DIR/index.html"
echo ""
echo "Nota: l'entrypoint modulare è web/index.html."

# Backup del file originale se non esiste già
if [ ! -f "index-original.html" ]; then
    echo "Creating backup of original index.html..."
    cp "index.html" "index-original.html"
fi