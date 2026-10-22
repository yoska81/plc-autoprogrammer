# CLICK bridge

`ClickBridge.exe` lets the ISA Auto Programmer desktop app work **CLICK Programming Software**
(AutomationDirect) for the user, while the user watches: the "Send to CLICK" button on the PLC program page.
**One click** ("Put the project into CLICK"): the open CLICK is used (else started), restored and maximized; a new
project with the CPU, the nicknames into the Address Picker, every rung in order. What the app cannot do (the
modules, added in System Configuration; a rung it cannot enter) is listed at the end, never asked in the middle.

AutomationDirect publishes no API, command line or ladder import for CLICK (only the Address Picker's nickname
CSV import), and the project file (.ckp) is not documented. So the bridge does what a person would do, through
**Windows UI Automation**: it opens menus, picks items, presses buttons and types into CLICK's windows. Nothing
is reverse-engineered and no file of CLICK's is written by the app.

- C#, .NET Framework 4.8, built by `node scripts/build-click-bridge.cjs` into `resources/click-bridge/`.
  It shares the protocol, JSON and log of the TIA bridge (`tools/tia-bridge/src`).
- The **steps** are not in the exe: the app sends them (`src/plc/click/clickPlan.ts` for the project set-up,
  `src/plc/click/clickRungs.ts` for the rungs: the entry sheet's cells and dialog fields, entered through the
  keymap: cursor keys, the Instruction List entry that opens each instruction, its dialog's fields;
  `src/plc/click/clickVerify.ts` for the check: the nickname export and the printed ladder against the project;
  `src/plc/click/clickCalibrate.ts` for the calibration: three sample rungs entered and read back). They name CLICK's windows,
  menus and controls; when a CLICK version names them differently, the plan is corrected in the app, from the
  controls the bridge records in its log on the user's PC (by itself: below).
- **CLICK 4 and CLICK 3.** CLICK 4 has a ribbon UI Automation cannot see into (no menus), a Navigation tree
  (Program tab: Address Picker, Ladder Program › Main Program …) and an Instruction List whose entries are named
  ("Contact (NO)", "Out", "Timer" …); CLICK 3 has classic menus. Each action is a `oneOf`: the ways to do it, tried
  in turn, CLICK 4's first (New project: Ctrl+N, the File menu, the ribbon key tips Alt › F › N; the Address Picker:
  the tree, the View menu; Print: Ctrl+P, the File menu). When none works the run stops with one sentence: "CLICK
  4.00: could not find New project (tried: Ctrl+N, the File menu, the ribbon key tips (Alt, F, N))."
- **Records itself.** Every window a step opens is written to the log with its controls the first time in a run,
  and every window of CLICK (dialogs too) on any failure: the log alone is enough to fit the steps. The user only
  sends the log ("Open folder" next to the message).
- Every step and every UI action is written to `<user data>\logs\click-bridge.log`.

## Safety rules (the bridge enforces them, whatever the plan says)

- **Never saves.** A step that would (Ctrl+S, F12, a Save menu or button) is refused before the run starts.
  The user saves in CLICK when happy with the result.
- **Pauses** before any step that touches CLICK when another window is in front (the user clicked elsewhere),
  and goes on when CLICK is in front again.
- **Stop** in the app, or the **Pause** key anywhere on the desktop, ends the run before its next step.
- A step that does not work stops the run with one plain sentence (what it could not do; nothing saved); the
  windows open and their controls go to the log.

## Protocol and commands

Same as the TIA bridge (`tools/tia-bridge/README.md`): one JSON object per line. `stop` is urgent: it is answered
while a run goes.

| Command | Result |
|---|---|
| `detect` | `{ready, installs: [{name, version, exe}], running, steps}` from the Windows programs list. |
| `start` | Uses the CLICK that is open, else starts it; `{version, processId, windows, attached}`. |
| `writeFile` `{name, text}` | Writes a file the plan imports (the nickname CSV) into the bridge's folder; `{path}`. |
| `folder` | The bridge's folder (the files CLICK exports there); `{path}`. |
| `readFile` `{name}` | A file in the bridge's folder (only there), for the check; `{base64}`. |
| `run` `{steps}` | Restores and maximizes CLICK, then runs a plan: `window`, `menu`, `click`, `doubleClick`, `setText`, `select`, `check`, `keys`, `wait`, `note`, `waitGone` (the user's turn: until a window is closed), `waitUser` (the user's turn: until Continue), `oneOf` (`{what, options: [{label, steps}]}`: the ways tried in turn); `optional` steps are skipped when their window does not come. `{steps}`. |
| `stop` | Ends the run before its next step. |
| `resume` | The user's turn is done (Continue): the run goes on. Urgent, like `stop`. |
| `dump` | Writes the controls of every window of CLICK, dialogs included, to a file (and the log); `{file, lines}`. Support only: the runs record by themselves. |

## Build and test

```bash
dotnet run --project tools/click-bridge/tests          # the bridge's tests (.NET 8, a fake CLICK, any OS)
node scripts/build-click-bridge.cjs                    # the shipped exe (Windows)
node e2e/clickBridge.test.cjs                          # the app's client against a fake bridge
CLICK_BRIDGE_EXE=resources/click-bridge/ClickBridge.exe node e2e/clickBridge.test.cjs   # … and the real exe
BASE_URL=http://localhost:5215 node e2e/send-to-click.e2e.cjs                            # the dialog, fake bridge
npx tsx src/plc/click/clickPlan.test.ts                # the step plans
npx tsx src/plc/click/clickVerify.test.ts              # the check (nicknames, rungs against a printout)
npx tsx src/plc/click/clickCalibrate.test.ts           # the calibration (three sample rungs, read back, the report)
```

Only the user's PC can show whether the steps fit their CLICK version and screen: the test card below.

## Test card (the user's PC, once per CLICK version)

Before you start: CLICK Programming Software installed (open or not); no unsaved project in it; the example project
(or yours) open in ISA Auto Programmer on a **CLICK** PLC.

1. PLC program page › **Send to CLICK**. It says which CLICK it found (no CLICK: how to get it).
2. **Put the project into CLICK**. Hands off the mouse and keyboard; watch CLICK:
   - CLICK comes to the front, maximized (also when it was minimized);
   - a new project opens (CLICK 4: Ctrl+N) and the project's CPU is chosen;
   - the Address Picker opens (CLICK 4: from the Navigation tree) and imports the nicknames;
   - the rungs go in one by one, in order: each instruction in its row and column with its address, parallel rows
     joined, outputs at the right rail.
3. The dialog says "Done in CLICK x.xx: …, 39 of 42 rungs entered" and lists what is left: the modules to add in
   System Configuration, the rungs to type (each "after rung N"). Nothing was saved: save in CLICK (Ctrl+S).
4. If it stops: one sentence says what it could not do. Press **Open folder** and send us `click-bridge.log`: it has
   every CLICK window the app opened, with its controls. Nothing else is needed from you.
5. **Pause**: run it again and click on another window: the dialog says "Paused"; click on CLICK: it goes on.
6. **Stop**: run it again and press **Stop** (then once more with the **Pause** key): it stops at once and says
   nothing was saved.
7. **Support** (folded away under the dialog): **Check what CLICK has** (CLICK exports its nicknames and prints the
   ladder to "Microsoft Print to PDF"; you press Save in the two dialogs, the file names are filled in; the dialog
   names any rung whose addresses differ), **Try three sample rungs** (a new test project, printed and read back;
   don't save it; a report file for us), **Record** (open the CLICK window you want recorded first).

Note your CLICK version, Windows version and screen scaling (Settings › Display) with the result.
