# AI quality harness

Runs the app's real generation pipeline (spec → equipment → I/O → electrical → HMI → program, the same
`organizeSpec` + `runUpdateAll` the app uses) on realistic machine descriptions written the way a
non-engineer would (`tools/machines/*.md`) and scores every stage with the deterministic design review
(`src/review/checks.ts`: program checker, electrical design warnings, calculations, I/O capacity,
spec coverage, safety gating, HMI ↔ program).

```bash
ANTHROPIC_API_KEY=sk-... npx tsx tools/ai-quality/run.ts        # real AI; records every reply
npx tsx tools/ai-quality/run.ts                                  # replays tools/ai-quality/recordings/
npx tsx tools/ai-quality/run.ts m5-mixing-tank --record          # one machine, re-record
tools/ai-quality/check-outputs.sh                                # + Debug 2's DXF/STEP/PDF/XLSX/consistency checkers (dev server on BASE_URL)
```

- The API key comes from the environment only; it is never written to a file. `AI_MODEL` / `AI_EFFORT` override the model and effort.
- Without a key, machines that have no recording are skipped (the report lists them).
- `m0-example-conveyor` replays the E2E mock answers (`record-from-e2e.ts`) to test the harness itself — it is not real AI output.
- Score per stage: 100 − 30 per critical − 12 per major − 3 per minor finding attributed to that stage (approval findings excluded); a failed stage scores 0.
- Output: `out/report.md`, `out/scores.json`, `out/<machine>/project.json` (git-ignored).
- Every prompt or check change made from the results is logged in `CHANGELOG.md`.
