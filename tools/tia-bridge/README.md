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

Coming next (one pull request each): attach to a running TIA Portal or create a project with the CPU and
modules; PLC tags; LAD blocks (SimaticML from the program export), with SCL as the fallback; compile with the
messages mapped to rungs; download to the PLC from a confirm screen only; read the program back for the
Upgrade page.

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
