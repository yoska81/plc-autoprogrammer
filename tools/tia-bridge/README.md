# TIA Portal bridge

`TiaBridge.exe` lets the ISA Auto Programmer desktop app drive the user's own **Siemens TIA Portal**
(V16–V20) through **TIA Openness**: the "Send to TIA Portal" button on the PLC program page.

- C#, .NET Framework 4.8 (what TIA Portal Openness V16–V20 runs on). Built by
  `node scripts/build-tia-bridge.cjs` into `resources/tia-bridge/`, shipped next to the app
  (`package.json` → `build.extraResources`).
- **No Siemens file is shipped or referenced at build time.** The bridge finds `Siemens.Engineering.dll`
  of the installed TIA Portal in the registry key Siemens documents
  (`HKLM\SOFTWARE\Siemens\Automation\Openness\<version>\PublicAPI\<assembly version>`, values
  `Siemens.Engineering` and `PublicKeyToken`) and loads it when a command needs it.
- Every request, answer and Openness call is written to `<user data>\logs\tia-bridge.log`
  (the dialog shows the path; users can send it to us). It starts again above 5 MB (the old one is kept as `.old`).

## Protocol (`src/Protocol.cs`, app side `electron/tiaBridge.cjs`)

One long-lived process; stdin / stdout, one JSON object per line, UTF-8.

| Direction | Message |
|---|---|
| bridge → app, once | `{"ready":true,"protocol":1,"version":"0.1.0"}` |
| app → bridge | `{"id":7,"cmd":"detect","args":{}}` |
| bridge → app, any number | `{"id":7,"progress":"Looking for TIA Portal…"}` |
| bridge → app, once per request | `{"id":7,"ok":true,"result":{…}}` or `{"id":7,"ok":false,"error":"plain words"}` |

Requests run one at a time in the order sent. `quit` ends the bridge. Errors are messages the user can act
on (`BridgeError`), or "TIA Portal reported: …" with the innermost cause.

### Commands

| Command | Result |
|---|---|
| `ping` | `{pong: true}` |
| `detect` | `{ready, installed: ["V19"], openness: [{version, assemblyVersion, dll}], inOpennessGroup, user, steps: [...]}`: what this PC has, and what to do when something is missing (install TIA Openness; add the user to the "Siemens TIA Openness" group, then sign out and in). |
| `portals` `{version?}` | `{version, portals: [{processId, project}]}`: the TIA Portals running now. |
| `open` `{version?, processId?, dir?, name}` | Attaches to that TIA Portal (keeping its open project) or starts one; opens the project `dir\name` or creates it (default folder: Documents\ISA Auto Programmer\TIA). `{version, project, plc}`. TIA Portal asks the user once whether to allow the bridge; a refusal comes back in words. |
| `firmware` `{orderNumber}` | `{versions: ["V4.6", …]}` from TIA Portal's hardware catalog, newest first. Openness cannot read the firmware of a connected PLC: the user picks it (the CPU's label, or Accessible devices). |
| `plc` `{orderNumber, firmware?, name, modules: [{orderNumber, slot}]}` | Adds the CPU (newest firmware unless given) and its local modules. A project that already has this CPU keeps it; another CPU is refused in words. `{plc, added, problems}` (a module not in the catalog or not fitting its slot is a problem, not a failure). Saves. |
| `tags` `{tags: [{name, dataType, logicalAddress, comment}]}` | Writes them into the app's own tag table "ISA Auto Programmer" (created when missing; the user's tables are not touched): new ones created, existing ones updated. `{table, created, updated, failed: [{name, error}]}`. Saves. |
| `blocks` `{files: [{name, kind: "xml" \| "scl", text}]}` | Imports the program's files in the order sent (the app sends the global DB, the SCL helpers, the FCs, OB 1): a SimaticML block replaces the block of the same name; an SCL source replaces the external source of the same name and generates its blocks. `{imported, failed: [{name, error}]}`. Saves. |
| `compile` | Compiles the PLC software. `{errors, warnings, messages: [{severity, path, text, block, network}]}`: `block` and `network` read from the message's place in TIA's tree (the app maps them to rungs). Saves. |
| `downloadTargets` | `{plc, address, interfaces: [{name, number, targets}]}`: the PLC, its IP address in the project, and this PC's network cards (PN/IE) that reach it. |
| `download` `{confirmed: true, pcInterface, number, target, stopAllowed, startAfter, password?}` | Downloads hardware and software. **Refused without `confirmed: true`** (the app sends it only from its confirm screen). TIA Portal's questions are answered by `src/DownloadPolicy.cs` from the user's choices: stop the PLC only when `stopAllowed`, start it only when `startAfter`, the password only when given (not kept, not logged); any question it does not know **stops the download** and names it. `{state: success \| warning \| error \| refused, errors, warnings, messages, answers}`. |

Coming next: read the program back for the Upgrade page.

## Build and test

```bash
dotnet run --project tools/tia-bridge/tests            # the bridge's own tests (.NET 8, any OS)
node scripts/build-tia-bridge.cjs                      # the shipped exe (.NET Framework 4.8; on Windows)
node e2e/tiaBridge.test.cjs                            # the app's client against a fake bridge
TIA_BRIDGE_EXE=resources/tia-bridge/TiaBridge.exe node e2e/tiaBridge.test.cjs   # … and the real exe (Windows)
BASE_URL=http://localhost:5214 node e2e/send-to-tia.e2e.cjs                      # the dialog, fake bridge
```

The Windows installer workflow runs all of these on every build. TIA Portal itself cannot run on a build
server: the checks with a real TIA Portal are done by hand, below.

## Signing

The installer is not signed yet (`CSC_IDENTITY_AUTO_DISCOVERY: false`). When it is, sign `TiaBridge.exe` with
the same certificate (electron-builder `win.signExts` / a sign hook covering `resources/tia-bridge`). TIA
Portal remembers its "allow access" answer per program file, so users answer it again after each update of
the app.

## Manual checklist (a Windows PC with TIA Portal)

Run on each TIA Portal version we support (V16 … V20) before a release; note the version and the result.

1. **No Openness**: TIA Portal installed without "TIA Openness" → Send to TIA Portal → the check says
   TIA Openness is not installed and how to add it (setup → Modify → Options).
2. **Not in the group**: Openness installed, the Windows user not in "Siemens TIA Openness" → the check names the
   user, the group, the `net localgroup` command and "sign out". Add the user, sign out and in → Check again
   → "This PC is ready".
3. **Several versions** (e.g. V18 and V20): both are listed, the newest is the one used.
4. **Log**: the path shown exists and has the `detect` request with the versions found.
5. **Bridge missing**: rename `resources\tia-bridge\TiaBridge.exe` → the dialog says the bridge is not in this
   installation (no crash); rename it back.
6. **Browser**: the web version (preview) has no Send to TIA Portal button; a CLICK project has none either.
7. **New project**: no TIA Portal running → Open TIA Portal → TIA Portal starts, asks to allow ISA Auto Programmer
   (answer Yes), and the project appears in Documents\ISA Auto Programmer\TIA\<project>. Answer No once: the
   dialog says TIA Portal did not allow it.
8. **Firmware**: the list matches the versions TIA Portal offers for that CPU (Device view › change device);
   the newest is chosen; pick an older one → the CPU in TIA has that firmware.
9. **PLC and modules**: an S7-1200 with two signal modules → CPU in slot 1, modules in slots 2 and 3 (Device
   view); a module TIA does not know is listed as a problem; the project is saved.
10. **Tags**: the table "ISA Auto Programmer" has every tag of the .sdf export with address and comment; run it
    again → 0 new, all updated; a tag on an address the CPU does not have is listed with TIA's reason.
11. **Running TIA Portal**: open a project with another CPU in TIA Portal → Send to TIA Portal offers that
    TIA Portal first; after Open it says the project already has another PLC and changes nothing.
12. **Program**: after the tags, **Put the program in and compile** → Program blocks has Machine_DB, the FCs of the
    program's blocks and Main (OB 1), all in LAD (each network's comment names its rung); External source files has
    Machine_tia_helpers.scl and the small FCs it generated. The dialog says all files were imported and "Compiled: no
    errors". Run it again: the blocks are replaced, not doubled.
13. **Compile errors**: in TIA Portal, delete a PLC tag the program uses, then run step 12 again → the dialog counts
    the errors and names each with its rung (e.g. "Rung 7 (Conveyor, network 3): …"); the same as TIA Portal's Info
    › Compile tab.
14. **Download, confirm**: after a compile without errors, **Download to the PLC…** shows the PLC, its address and
    the network cards; **Download … now** stays off until "I am at the machine…" is ticked. Cancel: nothing happens
    (the log has no `download` request).
15. **Download, PLC in RUN**: leave "The PLC may be stopped" unticked → "Not downloaded" and why; tick it → the PLC
    stops, the download runs, the PLC stays in STOP unless "Start the PLC after the download" was ticked. The log
    lists each question TIA Portal asked and its answer (no password).
16. **Download, password**: a PLC with an access password → without it: "protected by a password"; with it: the
    download runs. **Something new**: when TIA Portal asks a question the app does not know, the dialog names it and
    nothing is downloaded; download that one from TIA Portal itself and send us the log.
