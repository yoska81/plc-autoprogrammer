# Publishing the claude.ai preview

The user's preview is the claude.ai artifact https://claude.ai/artifact/DRLphqAtiQeGhRMDQ5smBn (single HTML page).

```bash
VITE_PREVIEW=1 npx vite build --config vite.preview.config.ts
python3 tools/preview/to_artifact.py dist-preview/index.html <scratchpad>/plc-autoprogrammer.html
# then publish <scratchpad>/plc-autoprogrammer.html with the Artifact tool to the URL above
```

The page's runtime capabilities (pass them on the publish that first adds or changes them; a publish without
`capabilities` keeps the stored ones):

```json
{
  "sample": {},
  "downloads": true,
  "mcp": { "servers": [{ "server": "host:isa_plc_helper", "tools": ["about", "start", "look", "status", "stop", "logPath", "showLog"] }] }
}
```

`host:isa_plc_helper` is the ISA PLC Helper on the viewer's PC (tools/plc-helper): "Send to PLC software" from the
page. It answers only in the Claude desktop app, and for now only for the artifact's owner; elsewhere the page says
"To send from this page, open it in the Claude desktop app, or install the ISA PLC Helper once."

Never import `react-dom/server` in app code: its script-tag templates make claude.ai reject the page
("artifact-pr-review machinery … too large"). Render off-screen with createRoot + flushSync instead.

Checks before publishing: `npx tsc -b`, `npx eslint src --quiet`, every `src/**/*.test.ts` with `npx tsx`,
`tools/check-all.sh` (needs `npx vite --port 5204`), `node e2e/app.e2e.cjs` (dev server on 5173) and
`BASE_URL=http://localhost:5310 node e2e/preview.e2e.cjs` against `npx http-server dist-preview -p 5310 -s`.
