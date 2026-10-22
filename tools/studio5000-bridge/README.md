# Studio 5000 bridge

`Studio5000Bridge.exe` lets the ISA Auto Programmer desktop app put a Logix program into the user's **Studio 5000
Logix Designer** project through **Rockwell's Logix Designer SDK**: the "Send to Studio 5000" button on the PLC
program page (Logix projects). The SDK is the user's: it needs a Studio 5000 Professional licence or the SDK toolkit,
with FactoryTalk Linx, Services Platform and Activation (Rockwell's SDK release notes); projects v31 and newer.

- C#, .NET Framework 4.8, built by `node scripts/build-studio5000-bridge.cjs` into `resources/studio5000-bridge/`
  with the job script `scripts/isa_logix_job.py` next to the exe. It shares the protocol, JSON and log of the TIA
  bridge (`tools/tia-bridge/src`).
- It runs the job script with the **SDK's Python client** (`logix_designer_sdk`, Python 3.12 / 3.13): the virtual
  environment in the SDK folder (as Rockwell's SDK guide LDSDK-GR001 sets it up), else the `py` launcher, else the
  Python on the PATH, whichever can `import logix_designer_sdk`.
- **The user's project is never changed**: the bridge copies their `.ACD` to `<name>_ISA.ACD` next to it and the SDK
  opens the copy. The app's L5X (`buildL5x`) is imported part by part over what is there (`src/plc/studio5000/
  studioSend.ts`): the data types and Add-On Instructions it has, the controller tags, and MainProgram. The
  controller (its type, its I/O configuration, its tasks) stays the user's. Then it is saved.
- Where the SDK (or its Python client) is missing, the dialog says what to install and offers **Open the .L5X in
  Studio 5000** (Studio 5000 makes a new project from it): the free way, without the SDK.
- Every call, the Python command line, its progress and its answer are written to
  `<user data>\logs\studio5000-bridge.log`.

SDK names used (Rockwell's SDK guide LDSDK-GR001D, March 2026): `LogixProject.open_logix_project`, `save`,
`set_communications_path` / `get_communications_path`, `change_controller_mode` with `RequestedControllerMode`,
`download`. The partial import is the guide's C# `PartialImportFromXmlFileAsync(xpath, file,
ImportCollisionOptions.OverwriteOnColl)` in the Python client's naming (`partial_import_from_xml_file`); if an SDK
version names it differently, the run stops saying so and the log lists the names the SDK has.

## Protocol and commands

Same as the TIA bridge (`tools/tia-bridge/README.md`): one JSON object per line. `stop` is urgent.

| Command | Result |
|---|---|
| `detect` | `{ready, logix: [{name, version}], sdk, python, projectsDir, steps}`: Logix Designer from the installed programs, the SDK folder (Public Documents › Studio 5000 › Logix Designer SDK), the Python with its client; `steps` say what is missing. |
| `writeL5x` `{name, text}` | The app's L5X into `projectsDir` (Documents › ISA Auto Programmer › Studio 5000); `{path}`. |
| `import` `{acd, l5x, xpaths}` | The user's project copied to `<name>_ISA.ACD`, the parts imported (overwrite on collision), saved: `{project, imported}`. |
| `info` `{project}` | The project's communication path: `{commPath}` (for the download's confirm screen). |
| `download` `{confirmed: true, project, commPath, programAllowed: true, runAfter}` | **Refused without `confirmed: true`** (the app sends it only from its confirm screen), without `programAllowed` (a Logix download needs the controller in Program mode: it stops) and without a path. The app's project to the controller at `commPath`: `set_communications_path`, Program mode, `download`, Run mode only when `runAfter`. `{mode, commPath}`. |
| `open` `{file}` | An `.ACD` or `.L5X` opened with Studio 5000. |
| `stop` | Ends a running SDK job (the user's project is not changed). |

## Build and test

```bash
dotnet run --project tools/studio5000-bridge/tests      # the bridge's tests (.NET 8, a fake PC and SDK, any OS)
python3 tools/studio5000-bridge/tests/test_job.py        # the job script against a fake logix_designer_sdk
node scripts/build-studio5000-bridge.cjs                 # the shipped exe (Windows)
node e2e/studio5000Bridge.test.cjs                       # the app's client against a fake bridge
BASE_URL=http://localhost:5214 node e2e/send-to-studio5000.e2e.cjs   # the dialog, fake bridge
npx tsx src/plc/studio5000/studioSend.test.ts            # the parts imported
```

## Test card (a Windows PC with Studio 5000 and the Logix Designer SDK)

Before you start: Studio 5000 Logix Designer (v31 or newer) and the Logix Designer SDK with its Python client (the
SDK guide's `.venv` in the SDK's python folder); a Studio 5000 project (.ACD) with your controller; in ISA Auto
Programmer a project on the **Logix** PLC with its program.

1. PLC program page › **Send to PLC software**. It lists Logix Designer, the SDK and its Python client (green).
   Without the SDK: it says so and **Open the .L5X in Studio 5000** opens a new project from the app's L5X.
2. Close your project in Studio 5000. **Choose my project…**, then **Put the program in**. Your `.ACD` is unchanged
   (its date too); `<name>_ISA.ACD` next to it has the program: MainProgram with its rungs, the controller tags, the
   data types. Your controller, its I/O modules and its tasks are as they were.
3. **Open in Studio 5000**: the copy opens; Logic › Verify Controller: no errors (or the ones a rung of yours causes).
4. Run it again: the program and tags are replaced, not doubled.
5. **Stop** while it runs: it ends, your project is not changed.
6. **Download, confirm**: after the program is in, **Download to the controller…** shows the copy and its path to
   the controller (the project's, as in Who Active); **Download now** stays off until "I am at the machine…" and
   "The controller may be put in Program mode" are ticked. Cancel: nothing happens (no `download` in the log).
7. **Download**: the controller goes to Program mode, gets the program, stays in Program mode (Studio 5000 online:
   the copy's rungs); with "Put it in Run mode after" ticked it goes to Run.
8. If anything goes wrong: one sentence; **Open log folder** and send us `studio5000-bridge.log`. When it says the SDK
   has no `partial_import_from_xml_file`, the log lists the names your SDK has: send it, we fit the script.

Note your Logix Designer version, SDK version (its folder name or Help › About) and Python version with the result.

**From the web page**: the same items on the web page opened in the Claude desktop app, with the ISA PLC Helper
connected (Settings › Send from the web page): the steps run through the helper (tools/plc-helper, its test card);
send us `plc-helper.log` with `studio5000-bridge.log`.
