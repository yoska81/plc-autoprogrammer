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
| `status` | yes | `{job, from}`: progress lines from `from`, `state` (running / done / failed), `result` or `error` |
| `stop` | no | `{software}`: the bridge's own Stop |
| `logPath`, `showLog` | yes | the bridge's log, shown in Explorer |

`software` is `tia`, `click`, `codesys` or `studio5000`. The Claude app may ask the user before a call that is not
read only. `quit` is refused. Every call is written to `plc-helper.log` (passwords as `***`; status polls left
out) next to the bridges' logs (`%APPDATA%\ISA Auto Programmer\logs`).

## In the Claude desktop app

`%APPDATA%\Claude\claude_desktop_config.json`:

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

Then restart the Claude app. The next step lets the desktop app write this entry itself.

## Tests

```bash
node e2e/plcHelper.test.cjs                                  # MCP, jobs, Stop, refusals, Open dialog, log; fake bridges
APP_DIR=release/win-unpacked node e2e/plcHelper.packaged.cjs # Windows CI: the installed helper as the Claude app starts it
```
