#!/usr/bin/env bash
# Run Debug 2's deliverable checkers on the projects the AI quality harness generated.
# Needs the dev server (BASE_URL, default http://localhost:5204) and tools/ai-quality/out/<machine>/project.json.
set -u
cd "$(dirname "$0")/../.."
PY=tools/.venv/bin/python
[ -x "$PY" ] || { python3 -m venv tools/.venv && tools/.venv/bin/pip install -q ezdxf openpyxl pypdf cadquery-ocp; }
machines=("$@")
[ ${#machines[@]} -eq 0 ] && machines=($(ls tools/ai-quality/out 2>/dev/null | grep -v '\.' ))
variants=(); for m in "${machines[@]}"; do variants+=("ai-$m"); done
node tools/gen-outputs.cjs "${variants[@]}" || exit 1
rc=0
for c in check_dxf check_step check_pdf check_xlsx check_consistency; do
  echo "== $c"; $PY tools/$c.py "${variants[@]}" || rc=1
done
exit $rc
