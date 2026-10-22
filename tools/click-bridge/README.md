# CLICK bridge

`ClickBridge.exe` lets the ISA Auto Programmer desktop app work **CLICK Programming Software**
(AutomationDirect) for the user, while the user watches: the "Send to CLICK" button on the PLC program page.

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
  controls the bridge records on the user's PC ("Record CLICK's windows for us").
- Every step and every UI action is written to `<user data>\logs\click-bridge.log`.

## Safety rules (the bridge enforces them, whatever the plan says)

- **Never saves.** A step that would (Ctrl+S, F12, a Save menu or button) is refused before the run starts.
  The user saves in CLICK when happy with the result.
- **Pauses** before any step that touches CLICK when another window is in front (the user clicked elsewhere),
  and goes on when CLICK is in front again.
- **Stop** in the app, or the **Pause** key anywhere on the desktop, ends the run before its next step.
- A step that does not work stops the run and names the step and the windows open; the controls of the window
  go to the log.

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
| `run` `{steps}` | Runs a plan: `window`, `menu`, `click`, `doubleClick`, `setText`, `select`, `check`, `keys`, `wait`, `note`, `waitGone` (the user's turn: until a window is closed), `waitUser` (the user's turn: until Continue); `optional` steps are skipped when their window does not come. `{steps}`. |
| `stop` | Ends the run before its next step. |
| `resume` | The user's turn is done (Continue): the run goes on. Urgent, like `stop`. |
| `dump` | Writes the controls of CLICK's windows to a file (and the log); `{file, lines}`. |

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

Before you start: CLICK Programming Software installed; no unsaved project open in it; the example project
(or yours) open in ISA Auto Programmer on a **CLICK** PLC.

1. PLC program page › **Send to CLICK**. It says which CLICK version it found. (No CLICK: it says how to get it.)
2. **Start CLICK** (or "Use the open CLICK"). CLICK opens; the dialog says "CLICK 3.x started".
3. **Record CLICK's windows for us**. Note the file it names.
4. **Check the keys first** (once per CLICK version): **Try three sample rungs**. CLICK starts a new, empty
   project and the three sample rungs go in (a contact and a coil, a seal-in with a parallel row, a timer); then
   Print opens: choose "Microsoft Print to PDF", the file name is filled in, press **Save**. The dialog says "All 3
   sample rungs … fit your CLICK" or names the sample rung that went wrong. Either way it names the report file
   (`click_calibration.txt`): send it to us with the log when it does not fit. Close that test project without saving.
5. **Set up the project in CLICK**. Hands off the mouse and keyboard; watch CLICK:
   - File › New Project opens, the CPU of your project is picked, OK.
   - With expansion modules: System Configuration opens and the dialog says which module goes in which slot.
     Add them, press OK there; the run goes on by itself.
   - The Address Picker opens and imports the nicknames.
   - The dialog says the project is set up. Nothing was saved: check, then save in CLICK yourself if you want.
6. **Pause**: run step 5 again and click on another window while it runs: the dialog says "Paused"; click on CLICK:
   it goes on.
7. **Stop**: run step 5 again and press **Stop** (then once more with the **Pause** key on the keyboard): it
   stops at once and says nothing was saved.
8. **Rungs**: after the set-up, **Enter the rungs in CLICK**. Watch the first rungs closely: each instruction
   should land in its row and column with its address, parallel rows joined, outputs at the right rail. A rung the
   app cannot enter (a retentive timer's reset input, an instruction kept from an old program) is your turn: the
   dialog says which rung; type it from the entry sheet (Load into PLC), then **Continue**. If a rung goes wrong,
   **Stop** at once and send us the log.
9. **Check what CLICK has**: CLICK's Address Picker exports the nicknames, then CLICK's Print goes to
   "Microsoft Print to PDF". In both Save dialogs the file name is filled in: press **Save** yourself. The dialog
   then says how many rungs match the project and names any rung with an address not where it should be (change
   one address in CLICK first to see it named), and any nickname missing or different.
10. If any step does not work: the dialog names the step. Press **Record CLICK's windows for us** with that
   window still open, then send us the log and the recorded file (both paths are in the dialog). With them we fit
   the steps to your CLICK version.

Note your CLICK version, Windows version and screen scaling (Settings › Display) with the result.
