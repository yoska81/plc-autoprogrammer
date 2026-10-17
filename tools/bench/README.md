# Update-all benchmark

`npx tsx tools/bench-update.ts` runs the app's own pipeline (organizeSpec + runUpdateAll) from a
machine description to a complete design with recorded AI replies, and reports, per machine:

- the modelled time from description to design with the old configuration (Speed thorough, every request
  at max effort, no cache, the old stage order) and the new one (Speed fast, cache, pipelined, Quick first
  then AI), plus a rebuild of the same description (everything from the answer cache);
- the measured non-AI time (what the app itself spends), which CI can bound with `--max-non-ai-ms=`;
- per stage and per AI request: effort, prompt and answer size, modelled latency.

The AI latency is a model (see the top of `tools/bench-update.ts`): replace its constants with numbers
measured with a key (the Update dialog and the console show each real request's time).

`recordings/<machine>/` holds replies for machines that have none in `tools/ai-quality/recordings/`.
`m1-case-erector` (24 I/O) was written by hand in the shape and size of real answers: it measures speed,
not AI quality (the quality harness skips it).

Output: `tools/bench/out/report.md` (git-ignored).
