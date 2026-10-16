#!/usr/bin/env bash
# Generate every deliverable for the example project and the test variants, then run all checkers.
# Needs the dev server: npm run dev -- --port 5204   (or set BASE_URL)
set -u
cd "$(dirname "$0")/.."
PY=tools/.venv/bin/python
if [ ! -x "$PY" ]; then
  python3 -m venv tools/.venv && tools/.venv/bin/pip install -q ezdxf openpyxl pypdf cadquery-ocp
fi
npx tsc -p tools/tsconfig.json || exit 1
node tools/gen-outputs.cjs "$@" || exit 1
rc=0
for c in layout_summary check_dxf check_step check_pdf check_xlsx check_consistency; do
  echo "== $c"
  $PY tools/$c.py "$@" || rc=1
done
exit $rc
