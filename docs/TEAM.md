# Parallel work plan

ISA Auto Programmer is developed by several Claude Code sessions in parallel.
The **coordinator** session owns the integration branch `claude/optimistic-maxwell-6nfcs6`
(PR #1): it merges the other branches, runs the full test and publishes the preview.

Every other session works on **its own branch** (below), started from the integration branch,
and never pushes to the integration branch or to `main`. Pull the integration branch into your
branch often (`git fetch origin claude/optimistic-maxwell-6nfcs6 && git merge FETCH_HEAD`) and
push your branch after each finished, tested step, so the coordinator can merge it.

| Session | Branch | Owns (edit freely) | Must not edit (owned elsewhere) |
|---|---|---|---|
| Dev 1 — labels & printing | `claude/isa-dev-labels-print` | `src/electrical/labels.ts`, new `src/electrical/labels/**`, `src/pages/LabelsPage.tsx`, full-package print code (new `src/deliverables/fullPackage.ts`), the Labels/Print entries in `ElectricalPage.tsx`, `ExportPage.tsx`, `App.tsx` | drawings, step, hmi, sim |
| Dev 2 — program & simulation | `claude/isa-dev-program-sim` | `src/preview/sampleProject.ts` (LADDER and the rest outside the HMI constant), `src/sim/**`, `src/lib/ai/ladderAI.ts`, `src/plc/**`, `src/components/program/**` | drawings, step, deliverables, labels |
| Debug 1 — app & workflow QA | `claude/isa-debug-app` | bug fixes anywhere in the UI flow (`src/pages/**`, `src/components/**`, `src/store/**`, `src/spec/**`), `e2e/**` | large rewrites of files another session owns: fix minimally and say so in the commit |
| Debug 2 — deliverables QA | `claude/isa-debug-outputs` | bug fixes in generated outputs: `src/deliverables/**`, `src/electrical/dxf.ts`, `src/electrical/derive.ts` (minimal, compatible fixes), new checker scripts under `tools/` | same rule: minimal fixes in other owners' files |
| Coordinator | `claude/optimistic-maxwell-6nfcs6` | drawings (`src/electrical/drawings/**`), 3D STEP (`src/electrical/step/**`), HMI (`src/hmi/**`), merges, preview, PR | — |

## Rules for every session
- `npx tsc -b`, `npx eslint src`, the unit tests and `node e2e/app.e2e.cjs` must pass before you push.
- Never kill processes by name (`pkill -f vite` kills your shell); use your own port: Dev 1 = 5201, Dev 2 = 5202, Debug 1 = 5203, Debug 2 = 5204.
- Commit messages end with the attribution lines the session is given; never put model names in code or docs.
- Small commits with clear messages; describe any edit to a file you don't own.
- The user is not an engineer: UI text is plain English; every generated number is either from the design data or labelled as an estimate.
- Brand: app name "ISA Auto Programmer"; Tailwind `brand-600` is lime `#EAFF46` with dark text (`text-brand-950`), `brand-800/900/950` are graphite; `steel-*` greys; resizable panels via `src/components/ResizablePane.tsx`.
- In the preview build (`VITE_PREVIEW=1`), AI runs through the viewer's Claude account (`src/preview/claudeAccount.ts`) and files save through `saveBlob` in `src/deliverables/files.ts` — always use `saveBlob` for downloads.

## Management protocol (the coordinator is the manager)
1. **Task board** — each session keeps `docs/status/<branch-name>.md` on its own branch: a checklist of its assigned tasks (`- [ ]` / `- [x]`), for each finished item how it was verified (commands run, screenshots/outputs and what they showed), open problems and questions for the manager. Update and push it with every milestone, at least every ~45 minutes of work.
2. **Acknowledge** — the first push of every session is its status file with the task list restated in its own words, the plan and any doubts.
3. **Cross-checks** — debug sessions also verify the dev branches: Debug 1 tests the UI of `claude/isa-dev-labels-print` and `claude/isa-dev-program-sim`; Debug 2 tests their generated files (labels PDF/CSV/Excel, full-package PDF, program listing, simulation results). Findings go into the debug session's status file under "Review of <branch>" with steps to reproduce; the manager forwards them.
4. **Control** — the manager reads the status files and transcripts, merges only work whose checks pass, re-runs the full test after each merge, and sends new instructions. A session that is blocked writes it at the top of its status file ("BLOCKED: …") and continues with another task.
5. Cloud sessions cannot message the manager back: the status file is the report.
