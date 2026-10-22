# ISA PLC Helper

"Send to PLC software" from the web page (the claude.ai artifact). A page on claude.ai cannot start programs or
reach this PC (its sandbox allows no connection to 127.0.0.1, and Chrome's Local Network Access would need
claude.ai's own frame to allow it). What the artifact runtime does allow is calling a **local MCP server through
the Claude desktop app** (`host:<name>` in the page's `mcp` capability). The helper is that server.

- `electron/plcHelper.cjs`: MCP over stdio (one JSON-RPC message per line). No port is opened: only the Claude
  app that started it talks to it.
- It hosts the same four bridges as the desktop app (`tools/tia-bridge`, `click-bridge`, `codesys-bridge`,
  `studio5000-bridge`) through the same client (`electron/tiaBridge.cjs`), so the same rules hold: the bridges
  never save the user's files, Stop and the Pause key work, a download needs `confirmed: true` from the app's
  confirm screen.
- It ships in the app's installer and is updated with it: the app's own exe runs it in Node mode, from
  `resources\app.asar.unpacked\electron\plcHelper.cjs` (`asarUnpack` in package.json).

## Tools (`host:isa_plc_helper`)

| tool | read only | what it does |
| --- | --- | --- |
| `about` | yes | version, the software it sends to |
| `start` | no | `{software, cmd, args}`: one bridge command as a job, or `pickProject` (Windows' Open dialog); returns `{job}` at once |
| `look` | yes | like `start`, for the commands that only look: `detect` (all), TIA Portal `portals`, `firmware`, `downloadTargets`, Studio 5000 `info` |
| `status` | yes | `{job, from}`: progress lines from `from`, `state` (running / done / failed), `result` or `error` |
| `stop` | no | `{software}`: the bridge's own Stop |
| `logPath`, `showLog` | yes | the bridge's log, shown in Explorer |

`software` is `tia`, `click`, `codesys` or `studio5000`. The Claude app may ask the user before a call that is not
read only. `quit` is refused. Every call is written to `plc-helper.log` (passwords as `***`; status polls left
out) next to the bridges' logs (`%APPDATA%\ISA Auto Programmer\logs`).

## In the Claude desktop app

ISA Auto Programmer › **Settings › Send from the web page › Connect the Claude app** (`electron/claudeConfig.cjs`),
then close the Claude app and open it again. It adds only this entry to `%APPDATA%\Claude\claude_desktop_config.json`
(the user's other servers and settings are kept; the file as it was is copied to `.isa-backup` once; a file that is
not JSON is never overwritten); **Disconnect** takes it out:

```json
{
  "mcpServers": {
    "isa_plc_helper": {
      "command": "C:\\Users\\<you>\\AppData\\Local\\Programs\\ISA Auto Programmer\\ISA Auto Programmer.exe",
      "args": ["C:\\Users\\<you>\\AppData\\Local\\Programs\\ISA Auto Programmer\\resources\\app.asar.unpacked\\electron\\plcHelper.cjs"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```


## Test card (a Windows PC with the Claude desktop app)

1. ISA Auto Programmer › Settings › **Send from the web page**: "Not connected." → **Connect the Claude app** →
   "Connected"; `%APPDATA%\Claude\claude_desktop_config.json` has `isa_plc_helper` and everything that was there
   before (and `.isa-backup`). Close the Claude app and open it again: Settings › Developer lists `isa_plc_helper`.
2. Open the web page in the Claude app, a CLICK project (or your PLC), PLC program page › **Send to PLC software**:
   the Claude app asks to allow the ISA PLC Helper → allow → the Send to CLICK window opens and checks this PC.
3. Go on as on your PLC's test card (the bridge's README): each step that changes something may be confirmed by the
   Claude app first; **Stop** works; a download needs the confirm screen, as in the desktop app.
4. The same page in a browser tab: Send to PLC software → "To send from this page, open it in the Claude desktop app,
   or install the ISA PLC Helper once." → **Send to the desktop app** → the file is in Downloads; with ISA Auto
   Programmer open (or opened now) it asks **Open it** / **Not now**; Open → the project on the Program page.
5. If anything goes wrong: one sentence; send us `plc-helper.log` (in `%APPDATA%\ISA Auto Programmer\logs`) and the
   bridge's log.

## Tests

```bash
node e2e/plcHelper.test.cjs                                  # MCP, jobs, Stop, refusals, Open dialog, log; fake bridges
node e2e/claudeConfig.test.cjs                               # the Claude app's settings: connect, keep the rest, disconnect
BASE_URL=http://localhost:5218 node e2e/plc-helper-settings.e2e.cjs   # the Settings card
APP_DIR=release/win-unpacked node e2e/plcHelper.packaged.cjs # Windows CI: the installed helper as the Claude app starts it
```

## Any browser: hand the project over through Downloads

Without the Claude desktop app (or without the helper), the page's "Send to PLC software" window also offers
**Send to the desktop app**: the project file (the `.isap`, a zip) is saved into Downloads as
`<project>.isa-send.zip` (`.zip` is a type the page may save), and says: "Open the ISA Auto Programmer app on this PC;
it picks up the file from Downloads." While the app is open it watches Downloads (`electron/sendWatch.cjs`), and when
it starts it looks for one saved in the last 30 minutes: for each complete `*.isa-send.zip` (once, also across
restarts: `handed-over.json` in the app's data) it asks in its own window: **Open it** / **Not now**. Open: the project opens on the Program page, and the user
presses Send to PLC software there; nothing goes to the PLC software before that. Each file and answer is written
to `plc-helper.log`.

```bash
node e2e/sendWatch.test.cjs   # the Downloads watch: on start the last 30 min, a finished download once, kept across restarts
```
