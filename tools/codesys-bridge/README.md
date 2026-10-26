# CODESYS bridge

`CodesysBridge.exe` lets the ISA Auto Programmer desktop app put a Structured Text program into a **CODESYS** project
and build it, with the user's own CODESYS Development System: the "Send to CODESYS" button on the PLC program page
(projects on the Structured Text PLC).

It uses only what CODESYS documents: the **CODESYS ScriptEngine** (Python scripts) run from the command line,
`CODESYS.exe --profile="<profile>" --noUI --runscript="isa_job.py"`. Nothing is reverse-engineered.

- C#, .NET Framework 4.8, built by `node scripts/build-codesys-bridge.cjs` into `resources/codesys-bridge/` with the
  job script `scripts/isa_job.py` next to the exe. It shares the protocol, JSON and log of the TIA bridge
  (`tools/tia-bridge/src`).
- The app turns its Structured Text into CODESYS objects (`src/plc/codesys/codesysObjects.ts`): each POU
  (PROGRAM, FUNCTION_BLOCK, FUNCTION) with its declaration and implementation, each TYPE a DUT, each VAR_GLOBAL a GVL.
- The script (IronPython 2.7 or Python 3, as CODESYS runs it): opens the user's project and **saves it as the app's
  copy next to it** (`<name>_ISA.project`: the user's file is never changed), or creates a new project with the
  CODESYS Control Win V3 device; creates or replaces each object in the active application
  (`create_pou` / `create_dut` / `create_gvl`, `textual_declaration` / `textual_implementation`); puts the main
  program in the MainTask; saves; builds (`application.build()`); returns the build's errors and warnings
  (`system.get_message_objects`) with their object and line.
- Every call, the CODESYS command line, its progress and its answer are written to `<user data>\logs\codesys-bridge.log`.

## Protocol and commands

Same as the TIA bridge (`tools/tia-bridge/README.md`): one JSON object per line. `stop` is urgent.

| Command | Result |
|---|---|
| `detect` | `{ready, installs: [{name, version, exe, profile}], projectsDir, steps}`: the CODESYS folders under Program Files ("CODESYS 3.5.19.20") with `CODESYS\Common\CODESYS.exe` and a profile (`CODESYS\Profiles\*.profile.xml`), newest first. |
| `build` `{project?, name, objects, main, device?}` | The program into the user's project (its copy) or a new project in `projectsDir\<name>`, then a build: `{project, objects: [{name, kind, action}], errors, warnings, messages: [{severity, text, object, line}], notes}`. |
| `download` `{confirmed: true, project, ip, stopAllowed, startAfter, user?, password?}` | **Refused without `confirmed: true`** (the app sends it only from its confirm screen) and without a valid IPv4 address. The app's project to the PLC at `ip` through CODESYS's first gateway (`set_gateway_and_ip_address`): an **online change only** (`OnlineChangeOption.Force`: the program keeps running, and nothing changes when one is not possible), or, when `stopAllowed`, an online change else a full download (`Try`); other applications on the PLC are never deleted; the program is started only when `startAfter`. The password is never logged, and the job file holding it is deleted as soon as CODESYS ends. `{state, full, started, ip}`. |
| `open` `{project}` | Opens the project with the program Windows has for it (CODESYS). |
| `stop` | Closes the CODESYS of a running job (the user's project is not changed). |

## Build and test

```bash
dotnet run --project tools/codesys-bridge/tests        # the bridge's tests (.NET 8, a fake CODESYS, any OS)
python3 tools/codesys-bridge/tests/test_job.py          # the job script against a fake ScriptEngine
node scripts/build-codesys-bridge.cjs                   # the shipped exe (Windows)
node e2e/codesysBridge.test.cjs                         # the app's client against a fake bridge
BASE_URL=http://localhost:5214 node e2e/send-to-codesys.e2e.cjs   # the dialog, fake bridge
npx tsx src/plc/codesys/codesysObjects.test.ts          # the objects from the Structured Text
```

## Test card (a Windows PC with CODESYS)

Before you start: the CODESYS Development System V3.5 (SP16 or newer) installed, with CODESYS Control Win V3; a
project on the **Structured Text** PLC in ISA Auto Programmer, with its program generated.

1. PLC program page › **Send to PLC software**. It names the CODESYS found (none: how to get it).
2. **A new project** › **Put the program in and build**. No CODESYS window opens (it works in the background, about
   a minute). The dialog says how many objects were created and "Built: no errors" (or the errors, each with its
   object and line). **Open in CODESYS**: the project has the POUs, DUTs and GVL under Application, and the main
   program in the MainTask; Build › Build gives the same messages.
3. **My own project**: close it in CODESYS, **Choose my project…**, then **Put the program in and build**. Your file
   is unchanged (its date too); `<name>_ISA.project` next to it has the program. Run it again: the objects are
   replaced, not doubled.
4. **Stop** while it builds: CODESYS closes (Task Manager: no CODESYS.exe left), the dialog says your project was
   not changed.
5. **Download, confirm**: after a build without errors, **Download to the PLC…**: **Download now** stays off until
   the PLC's IP address is right and "I am at the machine…" is ticked. Cancel: nothing happens (the log has no
   `download` request).
6. **Online change**: change one rung, put the program in and build again, download with "The PLC may be stopped"
   unticked: the program keeps running and has the change. A change no online change can do (e.g. a new variable in
   a running FB, depending on the PLC): "No online change was possible (nothing was changed in the PLC)"; tick
   "The PLC may be stopped" and download again: a full download.
7. **Start**: with "Start the program after the download" ticked, the program runs afterwards; unticked, a stopped
   program stays stopped. A PLC with users: enter the user and password; the log shows "password given", never
   the password.
8. If anything goes wrong: the dialog says it in one sentence; **Open log folder** and send us `codesys-bridge.log`.

Note your CODESYS version (Help › Information) with the result.

**From the web page**: the same items on the web page opened in the Claude desktop app, with the ISA PLC Helper
connected (Settings › Send from the web page): the steps run through the helper (tools/plc-helper, its test card);
send us `plc-helper.log` with `codesys-bridge.log`.
