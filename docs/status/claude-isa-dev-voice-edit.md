# Dev 3 — voice and hand edits (`claude/isa-dev-voice-edit`)

Draft PR → `claude/optimistic-maxwell-6nfcs6`.

## Task list (restated)

### 1. Voice
- [x] One reusable microphone: `src/voice/MicButton.tsx` (any text box) and `src/voice/VoiceTextarea.tsx` (drop-in multi-line box with the mic, optional speaker). Used on: machine description ("Add to the spec" and every spec section), question answers, program Change box and extra notes (ladder and Structured Text), electrical "Other requirements", import notes, review finding notes and the resolve/ignore reason, machine spec text, I/O descriptions (mic shows on hover), Settings "Try the microphone".
- [x] Speech to text, picked automatically (`pickEngine`, Settings can force one):
  - browser `SpeechRecognition` when there is one (not in Electron), live words while speaking; a "network" failure switches to recording from then on;
  - recording (`MediaRecorder`) + OpenAI transcription with the user's OpenAI key (`gpt-4o-transcribe`, falls back to `whisper-1`), language sent;
  - otherwise the on-device Whisper model (`@huggingface/transformers` 4.2.0, tiny or base), loaded lazily on the first press (download starts while you speak), progress in MB in the mic popover and in Settings, "Download now" button; plain error when it cannot be downloaded.
  - Live text: browser engine word by word; recording engines re-transcribe the clip every 4 s (on-device) / 8 s (OpenAI, first 2 min only) while recording, final pass on Done.
  - Add to the text / Replace the text (default in Settings, switchable while speaking), Done, Cancel (puts the text back); loudness meter; 5 min limit; leaving the page keeps what was said.
- [x] Language option (16 languages incl. English, Hebrew, Russian, Spanish) in Settings → Voice, also under Options → "Voice (microphone, language, read aloud)…".
- [x] Read aloud (`speechSynthesis`): speaker buttons on questions (question + answer), AI answers (program chat, electrical design summary, HMI explanation, review verdict), review findings, spec sections and the machine specification. Stop by pressing again; Markdown is read as plain text; long texts are split (Chromium cuts long utterances). Voice picker (voices of the language first, a hint on how to add a Windows voice when none), speed 0.5–2×, "Test the voice".
- [x] Hands-free answers: "Answer by voice" on every question list — reads each open question, listens (stops after a pause), reads the answer back, "yes" saves, "no" answers again, "skip", "stop" (English words work in every language; Hebrew, Russian, Spanish, French, German, Italian, Portuguese too). Every step also has a button, and the heard text can be corrected before saving.

### 2. Edit every field
Hand edits live in one project store, `src/edits/useEditsStore.ts` (registered in `PROJECT_STORES` as `edits`: saved per project, in backups, in .isap files, change-tracked like other user data; "Start clean" clears it). Every entry is keyed by something regeneration keeps (part number, label id, cable tag, wire, finding id, rung id, I/O id, generated alarm text) and remembers the generated value. UI: `src/edits/EditedMark.tsx` — `EditableCell` (Enter/blur saves, Escape cancels) and the blue "✎ edited by you / entered by you" chip with ↺ back to the generated value.
- [x] Order list (Deliverables): part number, description, order quantity and unit price editable on every panel line. Typed prices count in the subtotals/total ("total of known prices"), the CSV/Excel price source says "entered by you", the purchase summary PDF marks them `*`, the price-basis line counts them; the supplier order file uses the typed part number and quantity. Kept by generated part number across regeneration (checked in e2e after "Update design"). Spares keep their own quantities.
- [x] Labels: number and description of every label (Labels tab); used by the preview, PDFs, CSV/Excel and the ZIP (`listLabels` applies them).
- [x] Cable and wire list notes: new Electrical tab "Cable & wire lists" (also in the project tree) with a Note on every cable and wire; Note column in the cable schedule / wire list CSVs (Electrical page, Deliverables, ZIP) and the Excel report.
- [x] Review findings: a note under each finding (with mic), "✎ note" chip when collapsed, printed in the engineering package / Excel "Review Findings" resolution column.
- [x] Machine specification text: "Show / edit" makes it editable (mic + speaker); Copy, Save (.md) and the ZIP's spec.md use the user's version; a notice when the project changed after the edit, with "Use the new generated text".
- [x] I/O descriptions: marked when the user rewrote a generated description, ↺ back; dropped/replaced points drop their edits.
- [x] Rung comments: marked in the ladder; kept when the program is generated again or an AI change is approved (`keepRungComments` in `useProgramStore`); ↺ back.
- [x] HMI texts: alarm messages editable on the HMI Alarms tab, kept through regeneration (`keepAlarmTexts` in `useHmiStore.setDesign`). Screen texts were already editable in the HMI editor and kept via the screen `edited` flag.
- [x] Project data: already a form of editable fields (nothing generated there).

## Verification
- `npx tsc -b` clean, `npx eslint src --quiet` clean.
- All 48 `src/**/*.test.ts` pass with `npx tsx` (new: `src/edits/edits.test.ts`, `src/voice/text.test.ts`).
- E2E on `npx vite --port 5205`: new `e2e/voice-edit.e2e.cjs` (40 checks, all pass; screenshots in `e2e/out-voice-edit/`), `app.e2e.cjs`, `persist`, `start-clean`, `old-data`, `hmi-editor`, `sweep` (now includes the new tab: 0 pages with problems) all pass; preview build + `preview.e2e.cjs` pass, and the preview bundle contains no transformers/onnxruntime code (the on-device model is replaced by `src/preview/localWhisperStub.ts` in `vite.preview.config.ts`).
- On-device model checked for real in Chromium (model files from Hugging Face): the default 8-bit files failed in this ONNX runtime ("TransposeDQWeightsForMatMulNBits Missing required scale"); fixed with an fp32 encoder + 8-bit decoder and basic graph optimisation; then it loaded and transcribed through the app's own path (WAV clip, Hebrew settings).

## Notes for the manager
- Desktop build size: Vite now ships the ONNX runtime wasm (`ort-wasm-simd-threaded.asyncify.wasm`, 23.5 MB, ~5.8 MB gzip) next to the lazy `localWhisperModel` chunk (517 kB). It is only fetched when the on-device engine is used; the speech model itself (~70/140 MB) is downloaded once on first use and cached by the browser cache.
- Electron: microphone needs Windows Settings → Privacy → Microphone → "Let desktop apps access your microphone"; the app says so in plain words when access is blocked. No permission handler change was needed (Electron grants media by default).
- Files owned by others, changed minimally: `src/plc/ui/ladder/LadderView.tsx` (comment edit recorded + chip), `src/plc/ui/program/*` (VoiceTextarea, speaker on AI answers), `src/store/useProgramStore.ts` (keepRungComments), `src/pages/HmiPage.tsx` / `src/store/useHmiStore.ts` (alarm texts, speaker), `src/deliverables/*` (order list edits, notes columns, spec text), `e2e/sweep.e2e.cjs` (new tab in the page list).
