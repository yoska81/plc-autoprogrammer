#!/usr/bin/env bash
# Regenerate every file of the cn-rollformer-01 fixture.
#   bash fixtures/import/cn-rollformer-01/_src/build.sh [work dir]
# The Python steps run isolated (python -I) from a copy of the scripts in the work dir,
# outside the fixture folder, using the repo's tools/.venv (ezdxf, Pillow, numpy).
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
FIX="$(dirname "$SRC")"
REPO="$(cd "$FIX/../../.." && pwd)"
WORK="${1:-$(mktemp -d)}"
PY="$REPO/tools/.venv/bin/python"
mkdir -p "$WORK/scripts"

# 1. sheets -> drawings.pdf, expected.json, geometry.json (Playwright + Chromium)
BUILD_DIR="$WORK" PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}" node "$SRC/build.mjs"

# 2. DXF and scanned copy
cp "$SRC/dxf.py" "$SRC/scan.py" "$WORK/scripts/"
(cd "$WORK/scripts" && "$PY" -I dxf.py "$WORK/geometry.json" "$FIX/drawings.dxf")
(cd "$WORK/scripts" && "$PY" -I scan.py "$FIX/drawings.pdf" "$FIX/drawings-scan.pdf" "$WORK/scan")

# 3. preview of one sheet
pdftoppm -r 100 -png -f 5 -l 5 -singlefile "$FIX/drawings.pdf" "$FIX/preview-sheet5"
echo "done: $FIX"
