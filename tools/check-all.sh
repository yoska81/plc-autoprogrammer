#!/usr/bin/env bash
# Generate every deliverable for the example project and the test variants, then run all checkers.
# Needs the dev server: npm run dev -- --port 5204   (or set BASE_URL)
set -u
cd "$(dirname "$0")/.."
PY=tools/.venv/bin/python
ok312() { "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)' 2>/dev/null; }
if [ ! -x "$PY" ]; then
  # the checkers need Python 3.12+ and the versions pinned in tools/requirements.txt
  BASE=''
  for p in python3.13 python3.12 python3; do command -v "$p" >/dev/null && ok312 "$p" && { BASE=$p; break; }; done
  [ -n "$BASE" ] || { echo "check-all: needs Python 3.12 or newer (python3.12 / python3.13 on PATH)" >&2; exit 1; }
  "$BASE" -m venv tools/.venv && "$PY" -m pip install -q -r tools/requirements.txt || exit 1
fi
ok312 "$PY" || { echo "check-all: tools/.venv is Python $("$PY" -c 'import sys; print(*sys.version_info[:2], sep=".")') — the checkers need 3.12+: remove tools/.venv and run again" >&2; exit 1; }
"$PY" -c 'import ezdxf, openpyxl, pypdf, OCP, lxml' 2>/dev/null || "$PY" -m pip install -q -r tools/requirements.txt || exit 1
npx tsc -p tools/tsconfig.json || exit 1
node tools/gen-outputs.cjs "$@" || exit 1
rc=0
for c in layout_summary check_dxf check_step check_pdf check_xlsx check_consistency check_cad; do
  echo "== $c"
  $PY tools/$c.py "$@" || rc=1
done
echo "== check_overlap"
node tools/check_overlap.cjs "$@" || rc=1
exit $rc
